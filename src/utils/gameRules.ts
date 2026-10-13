import type {
  EliminationCause,
  GameState,
  NightActions,
  NightReport,
  NightStep,
  Player,
  RoleId,
  SeerAppearance,
  WinResult,
} from '../@types/game';
import { ROLES } from '../data/roles';
import { createId } from './gameCalculations';

/**
 * Pure game-state transitions. Every exported transition takes a GameState and
 * returns a new one; nothing here touches React, storage or the network.
 */

export const emptyNightActions = (): NightActions => ({
  wolfTargets: [],
  seerTarget: null,
  sorceressTarget: null,
  bodyguardTarget: null,
  vampireTarget: null,
  witchSaveTarget: null,
  witchKillTarget: null,
  spellcasterTarget: null,
  cultTarget: null,
});

export const isWolfPlayer = (p: Player): boolean => ROLES[p.roleId].isWolf;
export const alivePlayers = (players: readonly Player[]): Player[] => players.filter((p) => p.alive);
export const findPlayer = (s: GameState, id: string | null | undefined): Player | undefined =>
  id ? s.players.find((p) => p.id === id) : undefined;

const clone = (s: GameState): GameState => structuredClone(s);

function pushLog(s: GameState, key: string, params?: Record<string, string | number>) {
  s.log.push({ id: createId('log'), round: s.round, phase: s.phase, key, params });
}

// ---------------------------------------------------------------------------
// Night script
// ---------------------------------------------------------------------------

const SOLO_NIGHT_ROLES: RoleId[] = ['seer', 'sorceress', 'bodyguard', 'vampire', 'witch', 'spellcaster', 'cultLeader'];

/**
 * Builds tonight's wake-up order from the deck. Roles whose holders are all dead
 * stay in the script as "ghost" calls so the table can't infer who died.
 */
export function buildNightSteps(s: GameState): NightStep[] {
  const alive = alivePlayers(s.players);
  const deck = new Set<RoleId>(s.deck);
  const steps: NightStep[] = [];

  if (s.deck.some((id) => ROLES[id].isWolf)) {
    const wolves = alive.filter(isWolfPlayer);
    const { wolvesSkipNextNight: skip, wolvesDoubleKill: double } = s.modifiers;
    steps.push({
      id: 'wolfKill',
      roleId: 'werewolf',
      action: 'wolfKill',
      actors: wolves.map((p) => p.id),
      targetCount: wolves.length === 0 || skip ? 0 : double ? 2 : 1,
      ghost: wolves.length === 0,
      note: skip ? 'wolvesSkip' : double ? 'wolvesDouble' : undefined,
    });
  }

  for (const roleId of SOLO_NIGHT_ROLES) {
    if (!deck.has(roleId)) continue;
    const role = ROLES[roleId];
    const actors = alive.filter((p) => p.roleId === roleId).map((p) => p.id);
    const noPotions = roleId === 'witch' && s.modifiers.witchHealUsed && s.modifiers.witchKillUsed;
    steps.push({
      id: roleId,
      roleId,
      action: role.nightAction!,
      actors,
      targetCount: actors.length === 0 || noPotions ? 0 : 1,
      ghost: actors.length === 0,
      note: noPotions ? 'noPotions' : undefined,
    });
  }

  return steps.sort((a, b) => (ROLES[a.roleId].nightOrder ?? 99) - (ROLES[b.roleId].nightOrder ?? 99));
}

export type WitchMode = 'save' | 'kill';

/** Players a night step may legally target. */
export function eligibleTargets(s: GameState, step: NightStep, witchMode: WitchMode = 'kill'): Player[] {
  const alive = alivePlayers(s.players);
  const actors = new Set(step.actors);
  switch (step.action) {
    case 'wolfKill':
      return alive.filter((p) => !isWolfPlayer(p));
    case 'seerInspect':
    case 'sorceressInspect':
    case 'spellcasterSilence':
      return alive.filter((p) => !actors.has(p.id));
    case 'bodyguardProtect':
      return alive.filter((p) => p.id !== s.modifiers.bodyguardLastTarget);
    case 'vampireBite':
      return alive.filter((p) => p.roleId !== 'vampire');
    case 'cultRecruit':
      return alive.filter((p) => !actors.has(p.id) && !p.status.inCult);
    case 'witchPotion':
      if (witchMode === 'save') {
        if (s.modifiers.witchHealUsed) return [];
        return alive.filter((p) => s.nightActions.wolfTargets.includes(p.id));
      }
      return s.modifiers.witchKillUsed ? [] : alive.filter((p) => !actors.has(p.id));
  }
}

export const seerResult = (p: Player): SeerAppearance => ROLES[p.roleId].seerAppearance;
export const sorceressResult = (p: Player): boolean => p.roleId === 'seer';

// ---------------------------------------------------------------------------
// Eliminations & win checks
// ---------------------------------------------------------------------------

/** Mutates the draft; fires death rattles (Hunter, Wolf Cub). */
function killPlayer(s: GameState, id: string, cause: EliminationCause, when: 'night' | 'day'): boolean {
  const p = findPlayer(s, id);
  if (!p || !p.alive) return false;
  p.alive = false;
  p.eliminated = { round: s.round, phase: when, cause };
  p.status.vampireMarked = false;
  p.status.protected = false;
  pushLog(s, `log.eliminated.${cause}`, { name: p.name, role: p.roleId });
  if (p.roleId === 'wolfCub') {
    s.modifiers.wolvesDoubleKill = true;
    pushLog(s, 'log.wolfCubRage');
  }
  if (p.roleId === 'hunter') {
    s.pendingTriggers.push({ id: createId('trg'), kind: 'hunterShot', sourcePlayerId: p.id });
  }
  return true;
}

export function evaluateWinner(players: readonly Player[]): WinResult | null {
  const alive = alivePlayers(players);
  const onTeam = (team: string) =>
    players.filter((p) => ROLES[p.roleId].winTeam === team).map((p) => p.id);

  if (alive.length === 0) return { team: 'draw', winnerIds: [] };

  const leader = alive.find((p) => p.roleId === 'cultLeader');
  if (leader && alive.every((p) => p.id === leader.id || p.status.inCult)) {
    return { team: 'cult', winnerIds: [leader.id] };
  }

  if (alive.length === 1 && alive[0].roleId === 'loneWolf') {
    return { team: 'loneWolf', winnerIds: [alive[0].id] };
  }

  const wolves = alive.filter(isWolfPlayer);
  const pack = wolves.filter((p) => p.roleId !== 'loneWolf');
  const vampires = alive.filter((p) => p.roleId === 'vampire');

  if (wolves.length === 0 && vampires.length === 0) {
    return { team: 'village', winnerIds: onTeam('village') };
  }
  if (vampires.length === 0 && pack.length > 0 && wolves.length >= alive.length - wolves.length) {
    return { team: 'werewolf', winnerIds: onTeam('werewolf') };
  }
  if (wolves.length === 0 && vampires.length >= alive.length - vampires.length) {
    return { team: 'vampire', winnerIds: onTeam('vampire') };
  }
  return null;
}

/** Runs the win check once no death rattles are waiting. */
function finalize(s: GameState): GameState {
  if (s.phase === 'gameOver' || s.phase === 'setup' || s.pendingTriggers.length > 0) return s;
  const winner = evaluateWinner(s.players);
  if (winner) {
    s.winner = winner;
    s.phase = 'gameOver';
    pushLog(s, 'log.gameOver', { team: winner.team });
  }
  return s;
}

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

export function startNight(state: GameState): GameState {
  const s = clone(state);
  if (s.phase === 'day') s.round += 1;
  if (s.round < 1) s.round = 1;
  s.phase = 'night';
  s.nightStepIndex = 0;
  s.nightActions = emptyNightActions();
  s.nominations = [];
  s.executedToday = null;
  s.modifiers.vampireTriggeredToday = false;
  for (const p of s.players) p.status.silenced = false;
  pushLog(s, 'log.nightFalls', { round: s.round });
  return s;
}

export function resolveNight(state: GameState): GameState {
  const s = clone(state);
  const a = s.nightActions;
  const report: NightReport = {
    round: s.round,
    deaths: [],
    saved: [],
    transformed: [],
    silenced: null,
    recruited: null,
    vampireMarked: null,
  };

  logNightActions(s);

  // Tonight's modifiers are spent; deaths below may arm new ones for tomorrow night.
  s.modifiers.wolvesSkipNextNight = false;
  s.modifiers.wolvesDoubleKill = false;

  const shielded = a.bodyguardTarget;
  const dying: { playerId: string; cause: EliminationCause }[] = [];

  for (const targetId of new Set(a.wolfTargets)) {
    const p = findPlayer(s, targetId);
    if (!p?.alive) continue;
    if (targetId === shielded || targetId === a.witchSaveTarget) {
      report.saved.push(targetId);
      continue;
    }
    if (p.roleId === 'cursed') {
      p.roleId = 'werewolf';
      p.status.transformed = true;
      report.transformed.push(p.id);
      pushLog(s, 'log.cursedTurned', { name: p.name, role: 'cursed' });
      continue;
    }
    dying.push({ playerId: targetId, cause: 'wolves' });
    if (p.roleId === 'diseased') {
      s.modifiers.wolvesSkipNextNight = true;
      pushLog(s, 'log.diseasedEaten');
    }
  }

  if (a.witchKillTarget) {
    if (a.witchKillTarget === shielded) {
      if (!report.saved.includes(shielded)) report.saved.push(shielded);
    } else if (!dying.some((d) => d.playerId === a.witchKillTarget)) {
      dying.push({ playerId: a.witchKillTarget, cause: 'witch' });
    }
  }
  if (a.witchSaveTarget) s.modifiers.witchHealUsed = true;
  if (a.witchKillTarget) s.modifiers.witchKillUsed = true;

  const bitten = findPlayer(s, a.vampireTarget);
  if (bitten?.alive) {
    bitten.status.vampireMarked = true;
    report.vampireMarked = bitten.id;
  }
  const hushed = findPlayer(s, a.spellcasterTarget);
  if (hushed?.alive) {
    hushed.status.silenced = true;
    report.silenced = hushed.id;
  }
  const recruit = findPlayer(s, a.cultTarget);
  if (recruit?.alive) {
    recruit.status.inCult = true;
    report.recruited = recruit.id;
  }
  s.modifiers.bodyguardLastTarget = a.bodyguardTarget;

  for (const d of dying) {
    if (killPlayer(s, d.playerId, d.cause, 'night')) report.deaths.push(d);
  }
  for (const p of s.players) p.status.protected = false;

  s.lastReport = report;
  s.phase = 'dawn';
  s.nightStepIndex = 0;
  s.nightActions = emptyNightActions();
  pushLog(s, 'log.dawn', { deaths: report.deaths.length });
  return finalize(s);
}

/** Writes who did what tonight into the timeline (before deaths are applied). */
function logNightActions(s: GameState) {
  const a = s.nightActions;
  const actor = (roleId: RoleId) => {
    const holders = alivePlayers(s.players).filter((p) => p.roleId === roleId);
    return holders.length ? { actor: holders.map((p) => p.name).join(', '), actorRole: roleId } : null;
  };
  const target = (id: string | null) => {
    const p = findPlayer(s, id);
    return p ? { name: p.name, role: p.roleId } : null;
  };
  const log = (key: string, roleId: RoleId, targetId: string | null, extra?: Record<string, string>) => {
    const who = actor(roleId);
    const whom = target(targetId);
    if (who && whom) pushLog(s, key, { ...who, ...whom, ...extra });
  };

  for (const id of a.wolfTargets) {
    const whom = target(id);
    if (whom) pushLog(s, 'log.night.wolves', whom);
  }
  const seerTarget = findPlayer(s, a.seerTarget);
  if (seerTarget) log(seerResult(seerTarget) === 'werewolf' ? 'log.night.seerWolf' : 'log.night.seerVillage', 'seer', a.seerTarget);
  log('log.night.sorceress', 'sorceress', a.sorceressTarget);
  log('log.night.bodyguard', 'bodyguard', a.bodyguardTarget);
  log('log.night.witchSave', 'witch', a.witchSaveTarget);
  log('log.night.witchKill', 'witch', a.witchKillTarget);
  log('log.night.vampire', 'vampire', a.vampireTarget);
  log('log.night.spellcaster', 'spellcaster', a.spellcasterTarget);
  log('log.night.cult', 'cultLeader', a.cultTarget);
}

export function startDay(state: GameState): GameState {
  const s = clone(state);
  s.phase = 'day';
  s.dayStep = 'discussion';
  s.nominations = [];
  s.executedToday = null;
  s.modifiers.vampireTriggeredToday = false;
  return s;
}

/** First accusation of the day also collects any Vampire victims. */
export function nominate(state: GameState, accusedId: string, accuserId: string | null): GameState {
  const s = clone(state);
  if (!s.modifiers.vampireTriggeredToday) {
    s.modifiers.vampireTriggeredToday = true;
    for (const p of s.players) {
      if (p.alive && p.status.vampireMarked) killPlayer(s, p.id, 'vampire', 'day');
    }
  }
  const accused = findPlayer(s, accusedId);
  if (accused?.alive) {
    s.nominations.push({ id: createId('nom'), accusedId, accuserId, voters: [] });
    const accuser = findPlayer(s, accuserId);
    if (accuser) {
      pushLog(s, 'log.nominatedBy', { name: accused.name, role: accused.roleId, actor: accuser.name, actorRole: accuser.roleId });
    } else {
      pushLog(s, 'log.nominated', { name: accused.name, role: accused.roleId });
    }
  }
  s.dayStep = 'voting';
  return finalize(s);
}

export function setVoters(state: GameState, nominationId: string, voters: string[]): GameState {
  const s = clone(state);
  const nom = s.nominations.find((n) => n.id === nominationId);
  // The accused can't vote on their own nomination — it always counts as NO / abstain.
  if (nom) nom.voters = [...new Set(voters)].filter((v) => v !== nom.accusedId);
  return s;
}

export function removeNomination(state: GameState, nominationId: string): GameState {
  const s = clone(state);
  s.nominations = s.nominations.filter((n) => n.id !== nominationId);
  return s;
}

/** Strict majority of the living is required to eliminate. */
export const votesNeeded = (s: GameState): number => Math.floor(alivePlayers(s.players).length / 2) + 1;

export function executeNomination(state: GameState, nominationId: string): GameState {
  const s = clone(state);
  const nom = s.nominations.find((n) => n.id === nominationId);
  const accused = findPlayer(s, nom?.accusedId);
  if (!nom || !accused?.alive) return state;
  if (accused.roleId === 'prince' && !accused.status.princeRevealed) {
    accused.status.princeRevealed = true;
    pushLog(s, 'log.princeRevealed', { name: accused.name, role: 'prince' });
  } else {
    killPlayer(s, accused.id, 'vote', 'day');
  }
  s.executedToday = accused.id;
  s.dayStep = 'closed';
  return finalize(s);
}

export function closeDayWithoutExecution(state: GameState): GameState {
  const s = clone(state);
  s.dayStep = 'closed';
  pushLog(s, 'log.noExecution');
  return s;
}

export function resolveHunterShot(state: GameState, triggerId: string, targetId: string | null): GameState {
  const s = clone(state);
  s.pendingTriggers = s.pendingTriggers.filter((t) => t.id !== triggerId);
  if (targetId) killPlayer(s, targetId, 'hunter', s.phase === 'day' ? 'day' : 'night');
  return finalize(s);
}

export function moderatorEliminate(state: GameState, playerId: string): GameState {
  const s = clone(state);
  killPlayer(s, playerId, 'moderator', s.phase === 'day' ? 'day' : 'night');
  return finalize(s);
}

export function revivePlayer(state: GameState, playerId: string): GameState {
  const s = clone(state);
  const p = findPlayer(s, playerId);
  if (!p || p.alive) return state;
  p.alive = true;
  p.eliminated = undefined;
  s.pendingTriggers = s.pendingTriggers.filter((t) => t.sourcePlayerId !== playerId);
  if (s.phase === 'gameOver') {
    s.phase = 'day';
    s.winner = null;
  }
  pushLog(s, 'log.revived', { name: p.name, role: p.roleId });
  return s;
}
