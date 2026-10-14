import type {
  EliminationCause,
  GameState,
  NightActionKind,
  NightActions,
  NightReport,
  NightStep,
  Nomination,
  Player,
  RoleId,
  SeerAppearance,
  WinResult,
} from '../@types/game';
import { ORDINARY_ROLES, ROLES } from '../data/roles';
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
  cupidTargets: [],
  direWolfTarget: null,
  doppelgangerTarget: null,
  virginiaTarget: null,
  leprechaunTarget: null,
  auraSeerTarget: null,
  piTarget: null,
  priestTarget: null,
  oldHagTarget: null,
  troublemakerActor: null,
  drunkRole: null,
});

export const emptyReport = (round: number): NightReport => ({
  round,
  deaths: [],
  saved: [],
  transformed: [],
  silenced: null,
  recruited: null,
  vampireMarked: null,
  metallic: false,
  banished: null,
  lovers: [],
  wounded: [],
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
// Seating — Big Bad Wolf, Leprechaun, P.I. and Wolverine care about neighbours.
// ---------------------------------------------------------------------------

/** Living players in seat order (a ring). */
export const seatRing = (players: readonly Player[]): Player[] => alivePlayers(players).sort((a, b) => a.seat - b.seat);

/** The living players directly left and right of `id` around the table. */
export function neighbors(players: readonly Player[], id: string): Player[] {
  const ring = seatRing(players);
  const i = ring.findIndex((p) => p.id === id);
  if (i < 0 || ring.length < 2) return [];
  const left = ring[(i - 1 + ring.length) % ring.length];
  const right = ring[(i + 1) % ring.length];
  return left.id === right.id ? [left] : [left, right];
}

function ringDistance(players: readonly Player[], a: string, b: string): number {
  const ring = seatRing(players);
  const i = ring.findIndex((p) => p.id === a);
  const j = ring.findIndex((p) => p.id === b);
  if (i < 0 || j < 0) return Infinity;
  const d = Math.abs(i - j);
  return Math.min(d, ring.length - d);
}

// ---------------------------------------------------------------------------
// Night script
// ---------------------------------------------------------------------------

const INFO_ACTIONS = new Set<NightActionKind>(['masonMeet', 'minionMeet']);

/**
 * Builds tonight's wake-up order. Roles whose holders are all dead stay in the script
 * as "ghost" calls so the table can't infer who died.
 */
export function buildNightSteps(s: GameState): NightStep[] {
  const alive = alivePlayers(s.players);
  const firstNight = s.round === 1;
  const m = s.modifiers;
  // Roles in play: the dealt deck plus anything someone has become (Drunk, Doppelgänger…).
  const inPlay = new Set<RoleId>([...s.deck, ...alive.map((p) => p.roleId)]);
  const holders = (roleId: RoleId) => alive.filter((p) => p.roleId === roleId).map((p) => p.id);
  const steps: NightStep[] = [];

  if ([...inPlay].some((id) => ROLES[id].isWolf)) {
    const wolves = alive.filter(isWolfPlayer);
    // Fang Face only hunts with the pack on night 1, or once they're the last wolf standing.
    const awake = firstNight ? wolves : wolves.filter((w) => w.roleId !== 'fangFace');
    const actors = awake.length > 0 ? awake : wolves;
    const onlyFruitBrute = wolves.length > 0 && wolves.every((w) => w.roleId === 'fruitBrute');
    const bigBad = wolves.some((w) => w.roleId === 'bigBadWolf');
    const skip = m.wolvesSkipNextNight;
    steps.push({
      id: 'wolfKill',
      roleId: 'werewolf',
      action: 'wolfKill',
      kind: 'targets',
      actors: actors.map((p) => p.id),
      targetCount: wolves.length === 0 || skip || onlyFruitBrute ? 0 : m.wolvesDoubleKill || bigBad ? 2 : 1,
      ghost: wolves.length === 0,
      note: skip ? 'wolvesSkip' : onlyFruitBrute ? 'fruitBrute' : m.wolvesDoubleKill ? 'wolvesDouble' : bigBad ? 'bigBadWolf' : undefined,
    });
  }

  for (const roleId of inPlay) {
    const role = ROLES[roleId];
    const action = role.nightAction;
    if (!action || action === 'wolfKill') continue;
    if (role.firstNightOnly && !firstNight) continue;
    if (action === 'drunkSober' && s.round !== 3) continue;

    const actors = holders(roleId);
    const used =
      (action === 'piInspect' && m.piUsed) ||
      (action === 'priestBless' && m.priestUsed) ||
      (action === 'troublemakerStir' && m.troublemakerUsed);
    const noPotions = action === 'witchPotion' && m.witchHealUsed && m.witchKillUsed;
    const kind: NightStep['kind'] = INFO_ACTIONS.has(action)
      ? 'info'
      : action === 'drunkSober'
        ? 'role'
        : action === 'troublemakerStir'
          ? 'toggle'
          : 'targets';
    const active = actors.length > 0 && !used && !noPotions;
    steps.push({
      id: roleId,
      roleId,
      action,
      kind,
      actors,
      targetCount: !active || kind === 'info' ? 0 : action === 'cupidLink' ? 2 : 1,
      ghost: actors.length === 0,
      note: noPotions ? 'noPotions' : used ? 'used' : undefined,
    });
  }

  return steps.sort((a, b) => (ROLES[a.roleId].nightOrder ?? 99) - (ROLES[b.roleId].nightOrder ?? 99));
}

/**
 * The wolves' victims after the Leprechaun's redirect (which happens before the Witch
 * wakes, so she sees the real victim).
 */
export function effectiveWolfTargets(s: GameState): string[] {
  const targets = [...new Set(s.nightActions.wolfTargets)];
  const redirect = s.nightActions.leprechaunTarget;
  const leprechaunAlive = s.players.some((p) => p.alive && p.roleId === 'leprechaun');
  if (leprechaunAlive && redirect && targets[0] && !targets.includes(redirect)) {
    if (neighbors(s.players, targets[0]).some((p) => p.id === redirect)) targets[0] = redirect;
  }
  return targets;
}

export type WitchMode = 'save' | 'kill';

/** Players a night step may legally target. */
export function eligibleTargets(s: GameState, step: NightStep, witchMode: WitchMode = 'kill'): Player[] {
  const alive = alivePlayers(s.players);
  const actors = new Set(step.actors);
  const others = alive.filter((p) => !actors.has(p.id));
  const a = s.nightActions;
  switch (step.action) {
    case 'wolfKill': {
      const prey = alive.filter((p) => !isWolfPlayer(p));
      // Big Bad Wolf: the second victim must sit next to the first.
      if (step.note === 'bigBadWolf' && a.wolfTargets.length > 0) {
        const adjacent = new Set(neighbors(s.players, a.wolfTargets[0]).map((p) => p.id));
        return prey.filter((p) => a.wolfTargets.includes(p.id) || adjacent.has(p.id));
      }
      return prey;
    }
    case 'seerInspect':
    case 'sorceressInspect':
    case 'spellcasterSilence':
    case 'auraInspect':
    case 'piInspect':
    case 'oldHagBanish':
    case 'direWolfCompanion':
    case 'doppelgangerCopy':
    case 'virginiaFear':
      return others;
    case 'cupidLink':
    case 'priestBless':
      return alive;
    case 'bodyguardProtect':
      return alive.filter((p) => p.id !== s.modifiers.bodyguardLastTarget);
    case 'vampireBite':
      return alive.filter((p) => p.roleId !== 'vampire');
    case 'cultRecruit':
      return others.filter((p) => !p.status.inCult);
    case 'leprechaunRedirect':
      return a.wolfTargets[0] ? neighbors(s.players, a.wolfTargets[0]).filter((p) => !isWolfPlayer(p)) : [];
    case 'witchPotion':
      if (witchMode === 'save') {
        if (s.modifiers.witchHealUsed) return [];
        const victims = effectiveWolfTargets(s);
        return alive.filter((p) => victims.includes(p.id));
      }
      return s.modifiers.witchKillUsed ? [] : others;
    case 'masonMeet':
    case 'minionMeet':
    case 'troublemakerStir':
    case 'drunkSober':
      return [];
  }
}

export const seerResult = (p: Player): SeerAppearance => ROLES[p.roleId].seerAppearance;
export const sorceressResult = (p: Player): boolean => p.roleId === 'seer';
/** Aura Seer: true when the player is NOT a plain Werewolf or Villager. */
export const auraResult = (p: Player): boolean => !ORDINARY_ROLES.has(p.roleId);
/** P.I.: true when the player or one of their living neighbours looks like a Werewolf. */
export const piResult = (s: GameState, id: string): boolean => {
  const p = findPlayer(s, id);
  if (!p) return false;
  return [p, ...neighbors(s.players, id)].some((x) => seerResult(x) === 'werewolf');
};

// ---------------------------------------------------------------------------
// Eliminations & win checks
// ---------------------------------------------------------------------------

type DeathSink = { playerId: string; cause: EliminationCause }[];

/**
 * Mutates the draft and fires every death rattle: Hunter, Wolf Cub, Apprentice Seer
 * promotion, Doppelgänger copy, Tanner win, and the linked deaths (lovers, Dire Wolf
 * companion, Virginia Woolf). Cascaded deaths are appended to `sink` when given.
 */
function killPlayer(s: GameState, id: string, cause: EliminationCause, when: 'night' | 'day', sink?: DeathSink): boolean {
  const p = findPlayer(s, id);
  if (!p || !p.alive) return false;
  p.alive = false;
  p.eliminated = { round: s.round, phase: when, cause };
  p.status.vampireMarked = false;
  p.status.protected = false;
  p.status.woundedRound = null;
  sink?.push({ playerId: p.id, cause });
  pushLog(s, `log.eliminated.${cause}`, { name: p.name, role: p.roleId });

  if (p.roleId === 'wolfCub') {
    s.modifiers.wolvesDoubleKill = true;
    pushLog(s, 'log.wolfCubRage');
  }
  if (p.roleId === 'hunter') {
    s.pendingTriggers.push({ id: createId('trg'), kind: 'hunterShot', sourcePlayerId: p.id });
  }
  if (p.roleId === 'tanner' && !s.modifiers.tannerWinner) {
    s.modifiers.tannerWinner = p.id;
  }
  if (p.roleId === 'seer') {
    const apprentice = s.players.find((x) => x.alive && x.roleId === 'apprenticeSeer');
    if (apprentice) {
      apprentice.roleId = 'seer';
      pushLog(s, 'log.apprenticePromoted', { name: apprentice.name, role: 'apprenticeSeer' });
    }
  }
  if (s.modifiers.doppelgangerTarget === p.id) {
    const doppel = s.players.find((x) => x.alive && x.roleId === 'doppelganger');
    if (doppel) {
      doppel.roleId = p.roleId;
      pushLog(s, 'log.doppelgangerCopied', { name: doppel.name, role: p.roleId });
    }
    s.modifiers.doppelgangerTarget = null;
  }

  // Linked deaths — recursion stops because dead players are skipped.
  if (p.status.lover) {
    const other = s.players.find((x) => x.alive && x.status.lover && x.id !== p.id);
    if (other) killPlayer(s, other.id, 'heartbreak', when, sink);
  }
  if (s.modifiers.direWolfCompanion === p.id) {
    const dire = s.players.find((x) => x.alive && x.roleId === 'direWolf');
    if (dire) killPlayer(s, dire.id, 'linked', when, sink);
  }
  if (p.roleId === 'virginiaWoolf' && s.modifiers.virginiaTarget) {
    killPlayer(s, s.modifiers.virginiaTarget, 'linked', when, sink);
  }
  return true;
}

export function evaluateWinner(players: readonly Player[], tannerWinner: string | null = null): WinResult | null {
  const alive = alivePlayers(players);

  // The Couple exists only when Cupid links players from two different teams. Those lovers
  // leave their original teams: they win together as the last team standing, or not at all.
  const lovers = players.filter((p) => p.status.lover);
  const mixedCouple = lovers.length === 2 && ROLES[lovers[0].roleId].winTeam !== ROLES[lovers[1].roleId].winTeam;
  const coupleIds = new Set(mixedCouple ? lovers.map((p) => p.id) : []);
  const onTeam = (team: string) =>
    players.filter((p) => ROLES[p.roleId].winTeam === team && !coupleIds.has(p.id)).map((p) => p.id);

  if (tannerWinner) return { team: 'tanner', winnerIds: [tannerWinner] };
  if (alive.length === 0) return { team: 'draw', winnerIds: [] };

  // Lovers die together, so a living mixed couple means both are alive: no other team can
  // win until the couple falls, and the couple wins once everyone else is gone.
  if (mixedCouple && lovers.every((p) => p.alive)) {
    return alive.length === 2 ? { team: 'couple', winnerIds: lovers.map((p) => p.id) } : null;
  }

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
  const winner = evaluateWinner(s.players, s.modifiers.tannerWinner);
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
  for (const p of s.players) {
    p.status.silenced = false;
    p.status.banished = false;
  }
  pushLog(s, 'log.nightFalls', { round: s.round });
  return s;
}

export function resolveNight(state: GameState): GameState {
  const s = clone(state);
  const a = s.nightActions;
  const m = s.modifiers;
  const report = emptyReport(s.round);

  logNightActions(s);

  // Tonight's modifiers are spent; deaths below may arm new ones for tomorrow night.
  m.wolvesSkipNextNight = false;
  m.wolvesDoubleKill = false;

  const shielded = new Set([a.bodyguardTarget, a.priestTarget].filter((x): x is string => !!x));
  const dying: { playerId: string; cause: EliminationCause }[] = [];
  const willDie = (id: string) => dying.some((d) => d.playerId === id);

  // First-night bonds.
  if (a.cupidTargets.length === 2) {
    for (const id of a.cupidTargets) {
      const p = findPlayer(s, id);
      if (p) p.status.lover = true;
    }
    report.lovers = [...a.cupidTargets];
  }
  if (a.direWolfTarget) m.direWolfCompanion = a.direWolfTarget;
  if (a.doppelgangerTarget) m.doppelgangerTarget = a.doppelgangerTarget;
  if (a.virginiaTarget) m.virginiaTarget = a.virginiaTarget;

  // Tough Guys wounded last night succumb now.
  for (const p of s.players) {
    if (p.alive && p.status.woundedRound !== null && p.status.woundedRound < s.round) {
      dying.push({ playerId: p.id, cause: 'wolves' });
    }
  }

  // Leprechaun may have pushed the wolves' first target to an adjacent player.
  const wolfTargets = effectiveWolfTargets(s);

  // Wolverine: the table hears a metallic sound if it was the closest wolf to the victim.
  const wolverine = s.players.find((p) => p.alive && p.roleId === 'wolverine');
  if (wolverine && wolfTargets[0]) {
    const wolves = alivePlayers(s.players).filter(isWolfPlayer);
    const closest = Math.min(...wolves.map((w) => ringDistance(s.players, w.id, wolfTargets[0])));
    report.metallic = ringDistance(s.players, wolverine.id, wolfTargets[0]) <= closest;
  }

  for (const targetId of wolfTargets) {
    const p = findPlayer(s, targetId);
    if (!p?.alive) continue;
    if (shielded.has(targetId) || targetId === a.witchSaveTarget) {
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
    if (p.roleId === 'toughGuy' && p.status.woundedRound === null) {
      p.status.woundedRound = s.round;
      report.wounded.push(p.id);
      pushLog(s, 'log.toughGuyWounded', { name: p.name, role: p.roleId });
      continue;
    }
    if (!willDie(targetId)) dying.push({ playerId: targetId, cause: 'wolves' });
    if (p.roleId === 'diseased') {
      m.wolvesSkipNextNight = true;
      pushLog(s, 'log.diseasedEaten');
    }
  }

  if (a.witchKillTarget) {
    if (shielded.has(a.witchKillTarget)) {
      if (!report.saved.includes(a.witchKillTarget)) report.saved.push(a.witchKillTarget);
    } else if (!willDie(a.witchKillTarget)) {
      dying.push({ playerId: a.witchKillTarget, cause: 'witch' });
    }
  }
  if (a.witchSaveTarget) m.witchHealUsed = true;
  if (a.witchKillTarget) m.witchKillUsed = true;
  if (a.priestTarget) m.priestUsed = true;
  if (a.piTarget) m.piUsed = true;
  if (a.troublemakerActor) {
    m.troublemakerUsed = true;
    m.extraExecution = true;
  }

  // The Ghost leaves the living on night 1, by design.
  if (s.round === 1) {
    for (const p of s.players) if (p.alive && p.roleId === 'ghost' && !willDie(p.id)) dying.push({ playerId: p.id, cause: 'ghost' });
  }

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
  const exiled = findPlayer(s, a.oldHagTarget);
  if (exiled?.alive) {
    exiled.status.banished = true;
    report.banished = exiled.id;
  }
  const recruit = findPlayer(s, a.cultTarget);
  if (recruit?.alive) {
    recruit.status.inCult = true;
    report.recruited = recruit.id;
  }
  if (a.drunkRole && a.drunkRole in ROLES) {
    for (const p of s.players) {
      if (p.alive && p.roleId === 'drunk') {
        p.roleId = a.drunkRole as RoleId;
        pushLog(s, 'log.drunkSober', { name: p.name, role: p.roleId });
      }
    }
  }
  m.bodyguardLastTarget = a.bodyguardTarget;

  for (const d of dying) killPlayer(s, d.playerId, d.cause, 'night', report.deaths);
  for (const p of s.players) p.status.protected = false;

  s.lastReport = report;
  s.phase = 'dawn';
  s.nightStepIndex = 0;
  s.nightActions = emptyNightActions();
  pushLog(s, 'log.dawn', { deaths: report.deaths.length });
  if (report.metallic) pushLog(s, 'log.metallic');
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
  const log = (key: string, roleId: RoleId, targetId: string | null) => {
    const who = actor(roleId);
    const whom = target(targetId);
    if (who && whom) pushLog(s, key, { ...who, ...whom });
  };

  if (a.cupidTargets.length === 2) {
    const [x, y] = a.cupidTargets.map((id) => findPlayer(s, id));
    const who = actor('cupid');
    if (x && y && who) pushLog(s, 'log.night.cupid', { ...who, name: x.name, role: x.roleId, name2: y.name, role2: y.roleId });
  }
  log('log.night.doppelganger', 'doppelganger', a.doppelgangerTarget);
  log('log.night.virginia', 'virginiaWoolf', a.virginiaTarget);
  for (const id of a.wolfTargets) {
    const whom = target(id);
    if (whom) pushLog(s, 'log.night.wolves', whom);
  }
  log('log.night.direWolf', 'direWolf', a.direWolfTarget);
  log('log.night.leprechaun', 'leprechaun', a.leprechaunTarget);
  const seerTarget = findPlayer(s, a.seerTarget);
  if (seerTarget) log(seerResult(seerTarget) === 'werewolf' ? 'log.night.seerWolf' : 'log.night.seerVillage', 'seer', a.seerTarget);
  const auraTarget = findPlayer(s, a.auraSeerTarget);
  if (auraTarget) log(auraResult(auraTarget) ? 'log.night.auraSpecial' : 'log.night.auraOrdinary', 'auraSeer', a.auraSeerTarget);
  if (a.piTarget) log(piResult(s, a.piTarget) ? 'log.night.piFound' : 'log.night.piClear', 'pi', a.piTarget);
  log('log.night.sorceress', 'sorceress', a.sorceressTarget);
  log('log.night.bodyguard', 'bodyguard', a.bodyguardTarget);
  log('log.night.priest', 'priest', a.priestTarget);
  log('log.night.vampire', 'vampire', a.vampireTarget);
  log('log.night.witchSave', 'witch', a.witchSaveTarget);
  log('log.night.witchKill', 'witch', a.witchKillTarget);
  log('log.night.oldHag', 'oldHag', a.oldHagTarget);
  log('log.night.spellcaster', 'spellcaster', a.spellcasterTarget);
  const stirrer = actor('troublemaker');
  if (a.troublemakerActor && stirrer) pushLog(s, 'log.night.troublemaker', stirrer);
  log('log.night.cult', 'cultLeader', a.cultTarget);
}

export function startDay(state: GameState): GameState {
  const s = clone(state);
  s.phase = 'day';
  s.dayStep = 'discussion';
  s.nominations = [];
  s.executedToday = null;
  s.executionsLeft = s.modifiers.extraExecution ? 2 : 1;
  s.modifiers.extraExecution = false;
  s.modifiers.vampireTriggeredToday = false;
  return s;
}

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

/** Mayor's vote counts twice. */
export const voteWeight = (p: Player): number => (p.roleId === 'mayor' ? 2 : 1);

/** Who may cast a vote today (the Old Hag's exile has left the village). */
export const eligibleVoters = (s: GameState): Player[] => alivePlayers(s.players).filter((p) => !p.status.banished);

/**
 * Applies the forced-vote rules: the accused and the Pacifist always count as NO,
 * the Village Idiot always counts as YES, exiled players can't vote.
 */
export function normalizeVoters(s: GameState, nom: Pick<Nomination, 'accusedId'>, voters: readonly string[]): string[] {
  const eligible = eligibleVoters(s).filter((p) => p.id !== nom.accusedId && p.roleId !== 'pacifist');
  const allowed = new Set(eligible.map((p) => p.id));
  const forced = eligible.filter((p) => p.roleId === 'villageIdiot').map((p) => p.id);
  return [...new Set([...voters, ...forced])].filter((id) => allowed.has(id));
}

export const voteCount = (s: GameState, nom: Nomination): number =>
  nom.voters.reduce((sum, id) => sum + (findPlayer(s, id) ? voteWeight(findPlayer(s, id)!) : 0), 0);

/** Strict majority of all votes the living can cast (Mayor counts double). */
export const votesNeeded = (s: GameState): number => Math.floor(eligibleVoters(s).reduce((sum, p) => sum + voteWeight(p), 0) / 2) + 1;

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
  if (accused?.alive && !accused.status.banished) {
    s.nominations.push({ id: createId('nom'), accusedId, accuserId, voters: normalizeVoters(s, { accusedId }, []) });
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
  if (nom) nom.voters = normalizeVoters(s, nom, voters);
  return s;
}

export function removeNomination(state: GameState, nominationId: string): GameState {
  const s = clone(state);
  s.nominations = s.nominations.filter((n) => n.id !== nominationId);
  return s;
}

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
  s.executionsLeft = Math.max(0, (s.executionsLeft ?? 1) - 1);
  s.nominations = s.nominations.filter((n) => n.id !== nominationId);
  // Troublemaker days allow a second elimination.
  s.dayStep = s.executionsLeft > 0 ? 'voting' : 'closed';
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
  if (s.modifiers.tannerWinner === playerId) s.modifiers.tannerWinner = null;
  if (s.phase === 'gameOver') {
    s.phase = 'day';
    s.winner = null;
  }
  pushLog(s, 'log.revived', { name: p.name, role: p.roleId });
  return s;
}
