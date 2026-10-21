import {
  NO_REBALANCES,
  type EliminationCause,
  type GameState,
  type NightActionKind,
  type NightActions,
  type NightReport,
  type NightStep,
  type Nomination,
  type Player,
  type RebalanceRules,
  type RoleId,
  type SeerAppearance,
  type WinResult,
} from '../@types/game';
import { NIGHT_ORDER, nightGroup, ORDINARY_ROLES, ROLES, roleWinTeam } from '../data/roles';
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
  hookerTarget: null,
  hunterTarget: null,
  bigBadWolfTarget: null,
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

/** The house rules this game was dealt with. */
export const rulesOf = (s: Pick<GameState, 'rules'>): RebalanceRules => s.rules ?? NO_REBALANCES;

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
// The Hooker — a seduced player's own night power fails that night
// ---------------------------------------------------------------------------

/**
 * Night powers a seduction cancels, by the role that holds them. Night-1 setup (Cupid,
 * Doppelgänger, Virginia Woolf, Masons) wakes before the Hooker and is never affected, and
 * neither are the Dire Wolf's and Minion's first-night bonds.
 */
const SEDUCIBLE: Partial<Record<NightActionKind, RoleId>> = {
  bodyguardProtect: 'bodyguard',
  priestBless: 'priest',
  vampireBite: 'vampire',
  bigBadWolfStrike: 'bigBadWolf',
  sorceressInspect: 'sorceress',
  leprechaunRedirect: 'leprechaun',
  seerInspect: 'seer',
  auraInspect: 'auraSeer',
  piInspect: 'pi',
  hunterLink: 'hunter',
  witchPotion: 'witch',
  oldHagBanish: 'oldHag',
  spellcasterSilence: 'spellcaster',
  troublemakerStir: 'troublemaker',
  cultRecruit: 'cultLeader',
};

/** The player the Hooker seduced tonight, if any. */
export const seducedPlayer = (s: GameState): Player | undefined => findPlayer(s, s.nightActions.hookerTarget);

/** A seduced Werewolf ruins the pack's kill — except the Fruit Brute, who is immune. */
export function packSeduced(s: GameState): boolean {
  const p = seducedPlayer(s);
  return !!p && isWolfPlayer(p) && p.roleId !== 'fruitBrute';
}

/** True when tonight's seduction cancels this night power. */
export function actionSeduced(s: GameState, action: NightActionKind): boolean {
  if (action === 'wolfKill') return packSeduced(s);
  const roleId = SEDUCIBLE[action];
  return !!roleId && seducedPlayer(s)?.roleId === roleId;
}

// ---------------------------------------------------------------------------
// Night script
// ---------------------------------------------------------------------------

const INFO_ACTIONS = new Set<NightActionKind>(['masonMeet', 'minionMeet']);

/**
 * Builds tonight's wake-up order (see NIGHT_ORDER): night-1 setup → transformations →
 * protection & distraction → threats → everyone else. Roles whose holders are all dead stay
 * in the script as "ghost" calls so the table can't infer who died.
 */
export function buildNightSteps(s: GameState): NightStep[] {
  const alive = alivePlayers(s.players);
  const firstNight = s.round === 1;
  const m = s.modifiers;
  const rules = rulesOf(s);
  // Roles in play: the dealt deck plus anything someone has become (Drunk, Doppelgänger…).
  const inPlay = new Set<RoleId>([...s.deck, ...alive.map((p) => p.roleId)]);
  const holders = (roleId: RoleId) => alive.filter((p) => p.roleId === roleId).map((p) => p.id);
  const steps: NightStep[] = [];
  const push = (step: Omit<NightStep, 'group'>) => steps.push({ ...step, group: nightGroup(step.action) });

  // Transformations: wake whoever changed role since they last slept.
  const waking = (kind: 'cursed' | 'doppelganger') =>
    (m.pendingAwakenings ?? [])
      .filter((w) => w.kind === kind && w.round <= s.round && alive.some((p) => p.id === w.playerId))
      .map((w) => w.playerId);
  const bitten = waking('cursed');
  if (bitten.length > 0) {
    push({ id: 'cursedAwaken', roleId: 'cursed', action: 'cursedAwaken', kind: 'info', actors: bitten, targetCount: 0, ghost: false });
  }
  const copied = waking('doppelganger');
  if (copied.length > 0) {
    push({ id: 'doppelgangerAwaken', roleId: 'doppelganger', action: 'doppelgangerAwaken', kind: 'info', actors: copied, targetCount: 0, ghost: false });
  }

  if ([...inPlay].some((id) => ROLES[id].isWolf)) {
    const wolves = alive.filter(isWolfPlayer);
    // Fang Face only hunts with the pack on night 1, or once they're the last wolf standing.
    const awake = firstNight ? wolves : wolves.filter((w) => w.roleId !== 'fangFace');
    const actors = awake.length > 0 ? awake : wolves;
    const onlyFruitBrute = wolves.length > 0 && wolves.every((w) => w.roleId === 'fruitBrute');
    // House rule: the Big Bad Wolf strikes on its own turn instead of doubling the pack's kill.
    const bigBadTurn = rules.bigBadWolf;
    const bigBad = !bigBadTurn && wolves.some((w) => w.roleId === 'bigBadWolf');
    const skip = m.wolvesSkipNextNight;
    push({
      id: 'wolfKill',
      roleId: 'werewolf',
      action: 'wolfKill',
      kind: 'targets',
      actors: actors.map((p) => p.id),
      targetCount: wolves.length === 0 || skip || onlyFruitBrute ? 0 : m.wolvesDoubleKill || bigBad ? 2 : 1,
      ghost: wolves.length === 0,
      note: skip ? 'wolvesSkip' : onlyFruitBrute ? 'fruitBrute' : m.wolvesDoubleKill ? 'wolvesDouble' : bigBad ? 'bigBadWolf' : undefined,
    });
    if (bigBadTurn && inPlay.has('bigBadWolf')) {
      const bbw = holders('bigBadWolf');
      push({
        id: 'bigBadWolfStrike',
        roleId: 'bigBadWolf',
        action: 'bigBadWolfStrike',
        kind: 'targets',
        actors: bbw,
        targetCount: bbw.length > 0 && !skip ? 1 : 0,
        ghost: bbw.length === 0,
        note: skip ? 'wolvesSkip' : undefined,
      });
    }
  }

  // House rule: the Hunter links to a player each night.
  if (rules.hunter && inPlay.has('hunter')) {
    const hunters = holders('hunter');
    push({ id: 'hunterLink', roleId: 'hunter', action: 'hunterLink', kind: 'targets', actors: hunters, targetCount: hunters.length > 0 ? 1 : 0, ghost: hunters.length === 0 });
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
    push({
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

  return steps.sort((a, b) => NIGHT_ORDER[a.action] - NIGHT_ORDER[b.action]);
}

export interface WolfAttack {
  targetId: string;
  /** The pack's kill, or the Big Bad Wolf's own strike (house rule). */
  by: 'pack' | 'bigBadWolf';
}

/**
 * Tonight's wolf attacks that will land: after the Leprechaun's redirect (which happens
 * before the Witch wakes, so she sees the real victim), minus any a seduction cancelled.
 * `attempted` keeps the cancelled ones too (they still count as touching the Tanner).
 */
export function wolfAttacks(s: GameState, { attempted = false } = {}): WolfAttack[] {
  const a = s.nightActions;
  const attacks: WolfAttack[] = [];
  if (attempted || !packSeduced(s)) {
    const targets = [...new Set(a.wolfTargets)];
    const redirect = a.leprechaunTarget;
    const leprechaunAlive = s.players.some((p) => p.alive && p.roleId === 'leprechaun');
    if (leprechaunAlive && !actionSeduced(s, 'leprechaunRedirect') && redirect && targets[0] && !targets.includes(redirect)) {
      if (neighbors(s.players, targets[0]).some((p) => p.id === redirect)) targets[0] = redirect;
    }
    attacks.push(...targets.map((targetId) => ({ targetId, by: 'pack' as const })));
  }
  const strike = a.bigBadWolfTarget;
  const bigBadAlive = s.players.some((p) => p.alive && p.roleId === 'bigBadWolf');
  const strikeLands = attempted || !actionSeduced(s, 'bigBadWolfStrike');
  if (rulesOf(s).bigBadWolf && strike && bigBadAlive && strikeLands && !attacks.some((x) => x.targetId === strike)) {
    attacks.push({ targetId: strike, by: 'bigBadWolf' });
  }
  return attacks;
}

/** The players the wolves will really attack tonight. */
export const effectiveWolfTargets = (s: GameState): string[] => wolfAttacks(s).map((x) => x.targetId);

/** House rule: once the Healing Potion is used, the Witch no longer learns the wolves' victim. */
export const witchSeesVictims = (s: GameState): boolean => !(rulesOf(s).witch && s.modifiers.witchHealUsed);

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
    case 'bigBadWolfStrike': {
      // House rule: a second victim seated directly next to the pack's (first) target.
      const primary = a.wolfTargets[0];
      if (!primary) return [];
      return neighbors(s.players, primary).filter((p) => !isWolfPlayer(p) && !a.wolfTargets.includes(p.id));
    }
    case 'hookerSeduce':
      // Each player can be seduced only once per game.
      return others.filter((p) => !s.modifiers.hookerVisited.includes(p.id));
    case 'seerInspect':
    case 'sorceressInspect':
    case 'spellcasterSilence':
    case 'auraInspect':
    case 'piInspect':
    case 'oldHagBanish':
    case 'direWolfCompanion':
    case 'doppelgangerCopy':
    case 'virginiaFear':
    case 'hunterLink':
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
    case 'cursedAwaken':
    case 'doppelgangerAwaken':
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

export type InspectAction = 'seerInspect' | 'auraInspect' | 'piInspect' | 'sorceressInspect';

/**
 * What an inspecting role is told about a player: Werewolf (Seer), not ordinary (Aura Seer),
 * a Werewolf nearby (P.I.), is the Seer (Sorceress). A seduced inspector is told the
 * opposite, e.g. a Seduced Seer sees a Villager as a Werewolf.
 */
export function inspectionResult(s: GameState, action: InspectAction, targetId: string): boolean | null {
  const p = findPlayer(s, targetId);
  if (!p) return null;
  const truth =
    action === 'seerInspect'
      ? seerResult(p) === 'werewolf'
      : action === 'auraInspect'
        ? auraResult(p)
        : action === 'piInspect'
          ? piResult(s, targetId)
          : sorceressResult(p);
  return actionSeduced(s, action) ? !truth : truth;
}

// ---------------------------------------------------------------------------
// Eliminations & win checks
// ---------------------------------------------------------------------------

type DeathSink = { playerId: string; cause: EliminationCause }[];

/**
 * Mutates the draft and fires every death rattle: Hunter, Wolf Cub, Apprentice Seer
 * promotion, Doppelgänger copy, Tanner win, and the linked deaths (lovers, Dire Wolf
 * companion, Virginia Woolf, the Hunter's night link). Cascaded deaths are appended to
 * `sink` when given.
 */
function killPlayer(s: GameState, id: string, cause: EliminationCause, when: 'night' | 'day', sink?: DeathSink): boolean {
  const p = findPlayer(s, id);
  if (!p || !p.alive) return false;
  const rules = rulesOf(s);
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
  // House rule: the Hunter's night link replaces the revenge shot.
  if (p.roleId === 'hunter' && !rules.hunter) {
    s.pendingTriggers.push({ id: createId('trg'), kind: 'hunterShot', sourcePlayerId: p.id });
  }
  // The reworked Tanner is a Villager: being eliminated is no longer a win.
  if (p.roleId === 'tanner' && !rules.tanner && !s.modifiers.tannerWinner) {
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
      // She's woken next night to see her new role.
      s.modifiers.pendingAwakenings.push({ playerId: doppel.id, kind: 'doppelganger', round: s.round + 1 });
    }
    s.modifiers.doppelgangerTarget = null;
  }

  // Linked deaths — recursion stops because dead players are skipped. A broken heart
  // ignores every shield and potion.
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
  // House rule: a Hunter dying at night takes their linked player — unless seduced tonight.
  const link = s.nightActions.hunterTarget;
  if (p.roleId === 'hunter' && rules.hunter && s.phase === 'night' && link && s.nightActions.hookerTarget !== p.id) {
    killPlayer(s, link, 'linked', when, sink);
  }
  return true;
}

export function evaluateWinner(
  players: readonly Player[],
  tannerWinner: string | null = null,
  rules?: Partial<RebalanceRules> | null,
): WinResult | null {
  const alive = alivePlayers(players);
  const team = (p: Player) => roleWinTeam(p.roleId, rules);

  // The Couple exists only when Cupid links players from two different teams. Those lovers
  // leave their original teams: they win together as the last team standing, or not at all.
  const lovers = players.filter((p) => p.status.lover);
  const mixedCouple = lovers.length === 2 && team(lovers[0]) !== team(lovers[1]);
  const coupleIds = new Set(mixedCouple ? lovers.map((p) => p.id) : []);
  const onTeam = (name: string) => players.filter((p) => team(p) === name && !coupleIds.has(p.id)).map((p) => p.id);

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
  const winner = evaluateWinner(s.players, s.modifiers.tannerWinner, rulesOf(s));
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

/** Strongest first: the lowest (most wolf-favouring) balance weight, then seat order. */
const strongest = (players: Player[]): Player[] =>
  [...players].sort((a, b) => ROLES[a.roleId].weight - ROLES[b.roleId].weight || a.seat - b.seat).slice(0, 1);

export function resolveNight(state: GameState): GameState {
  const s = clone(state);
  const a = s.nightActions;
  const m = s.modifiers;
  const rules = rulesOf(s);
  const report = emptyReport(s.round);

  logNightActions(s);

  // Seductions are fixed before anything changes roles tonight (a seduced Cursed who turns
  // doesn't retroactively spoil the pack's kill).
  const cancelled = new Set((Object.keys(NIGHT_ORDER) as NightActionKind[]).filter((x) => actionSeduced(s, x)));
  const attacks = wolfAttacks(s);
  if (a.hookerTarget && !m.hookerVisited.includes(a.hookerTarget)) m.hookerVisited.push(a.hookerTarget);
  // Tonight's awakenings have been called; ones queued from here on are for a later night.
  m.pendingAwakenings = m.pendingAwakenings.filter((w) => w.round > s.round);

  // Tonight's modifiers are spent; deaths below may arm new ones for tomorrow night.
  m.wolvesSkipNextNight = false;
  m.wolvesDoubleKill = false;

  // Bodyguard and Priest only stop Werewolf attacks.
  const shielded = new Set(
    [cancelled.has('bodyguardProtect') ? null : a.bodyguardTarget, cancelled.has('priestBless') ? null : a.priestTarget].filter(
      (x): x is string => !!x,
    ),
  );
  // A seduced Witch's potions are spent with no effect.
  const witchWorks = !cancelled.has('witchPotion');
  const witchSave = witchWorks ? a.witchSaveTarget : null;
  const witchKill = witchWorks ? a.witchKillTarget : null;

  const dying: { playerId: string; cause: EliminationCause }[] = [];
  const willDie = (id: string) => dying.some((d) => d.playerId === id);
  const doom = (id: string, cause: EliminationCause) => {
    if (!willDie(id)) dying.push({ playerId: id, cause });
  };

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
    if (p.alive && p.status.woundedRound !== null && p.status.woundedRound < s.round) doom(p.id, 'wolves');
  }

  // House rule — the reworked Tanner: anyone whose power touches the Tanner tonight dies with
  // them, through every shield, even if the Hooker seduced them (a seduced power still
  // reached the Tanner). A wolf attack takes down the pack's strongest wolf.
  if (rules.tanner) {
    const living = alivePlayers(s.players);
    const tanners = new Set(living.filter((p) => p.roleId === 'tanner').map((p) => p.id));
    const holdersOf = (roleId: RoleId) => living.filter((p) => p.roleId === roleId);
    const touch = (targetId: string | null, interactors: Player[]) => {
      if (!targetId || !tanners.has(targetId) || interactors.length === 0) return;
      doom(targetId, 'tanner');
      for (const p of interactors) if (p.id !== targetId) doom(p.id, 'tanner');
    };
    const acted = (roleId: RoleId, targetId: string | null) => touch(targetId, holdersOf(roleId));
    for (const id of a.cupidTargets) acted('cupid', id);
    acted('doppelganger', a.doppelgangerTarget);
    acted('virginiaWoolf', a.virginiaTarget);
    acted('hooker', a.hookerTarget);
    acted('bodyguard', a.bodyguardTarget);
    acted('priest', a.priestTarget);
    touch(a.vampireTarget, strongest(holdersOf('vampire')));
    for (const attack of wolfAttacks(s, { attempted: true })) {
      touch(attack.targetId, attack.by === 'pack' ? strongest(living.filter(isWolfPlayer)) : holdersOf('bigBadWolf'));
    }
    acted('direWolf', a.direWolfTarget);
    acted('sorceress', a.sorceressTarget);
    acted('leprechaun', a.leprechaunTarget);
    acted('seer', a.seerTarget);
    acted('auraSeer', a.auraSeerTarget);
    acted('pi', a.piTarget);
    acted('hunter', a.hunterTarget);
    acted('witch', a.witchSaveTarget);
    acted('witch', a.witchKillTarget);
    acted('oldHag', a.oldHagTarget);
    acted('spellcaster', a.spellcasterTarget);
    acted('cultLeader', a.cultTarget);
  }

  // Wolverine: the table hears a metallic sound if it was the closest wolf to the victim.
  const firstVictim = attacks.find((x) => x.by === 'pack')?.targetId;
  const wolverine = s.players.find((p) => p.alive && p.roleId === 'wolverine');
  if (wolverine && firstVictim) {
    const wolves = alivePlayers(s.players).filter(isWolfPlayer);
    const closest = Math.min(...wolves.map((w) => ringDistance(s.players, w.id, firstVictim)));
    report.metallic = ringDistance(s.players, wolverine.id, firstVictim) <= closest;
  }

  for (const { targetId } of attacks) {
    const p = findPlayer(s, targetId);
    if (!p?.alive || willDie(targetId)) continue;
    if (shielded.has(targetId) || targetId === witchSave) {
      report.saved.push(targetId);
      continue;
    }
    if (p.roleId === 'cursed') {
      p.roleId = 'werewolf';
      p.status.transformed = true;
      report.transformed.push(p.id);
      pushLog(s, 'log.cursedTurned', { name: p.name, role: 'cursed' });
      // Woken next night to learn they're a Werewolf now.
      m.pendingAwakenings.push({ playerId: p.id, kind: 'cursed', round: s.round + 1 });
      continue;
    }
    if (p.roleId === 'toughGuy' && p.status.woundedRound === null) {
      p.status.woundedRound = s.round;
      report.wounded.push(p.id);
      pushLog(s, 'log.toughGuyWounded', { name: p.name, role: p.roleId });
      continue;
    }
    doom(targetId, 'wolves');
    if (p.roleId === 'diseased') {
      m.wolvesSkipNextNight = true;
      pushLog(s, 'log.diseasedEaten');
    }
  }

  // Poison goes straight past the Bodyguard's and Priest's protection.
  if (witchKill) doom(witchKill, 'witch');
  // Powers spent tonight stay spent, even if a seduction made them fizzle.
  if (a.witchSaveTarget) m.witchHealUsed = true;
  if (a.witchKillTarget) m.witchKillUsed = true;
  if (a.priestTarget) m.priestUsed = true;
  if (a.piTarget) m.piUsed = true;
  if (a.troublemakerActor) {
    m.troublemakerUsed = true;
    if (!cancelled.has('troublemakerStir')) m.extraExecution = true;
  }

  // The Ghost leaves the living on night 1, by design.
  if (s.round === 1) {
    for (const p of s.players) if (p.alive && p.roleId === 'ghost') doom(p.id, 'ghost');
  }

  const bitten = cancelled.has('vampireBite') ? undefined : findPlayer(s, a.vampireTarget);
  if (bitten?.alive) {
    bitten.status.vampireMarked = true;
    report.vampireMarked = bitten.id;
  }
  const hushed = cancelled.has('spellcasterSilence') ? undefined : findPlayer(s, a.spellcasterTarget);
  if (hushed?.alive) {
    hushed.status.silenced = true;
    report.silenced = hushed.id;
  }
  const exiled = cancelled.has('oldHagBanish') ? undefined : findPlayer(s, a.oldHagTarget);
  if (exiled?.alive) {
    exiled.status.banished = true;
    report.banished = exiled.id;
  }
  const recruit = cancelled.has('cultRecruit') ? undefined : findPlayer(s, a.cultTarget);
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

/** Writes who did what tonight into the timeline, in call order (before deaths are applied). */
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
  const inspected = (action: InspectAction, targetId: string | null) => (targetId ? inspectionResult(s, action, targetId) : null);

  // 1 — night-1 setup
  if (a.cupidTargets.length === 2) {
    const [x, y] = a.cupidTargets.map((id) => findPlayer(s, id));
    const who = actor('cupid');
    if (x && y && who) pushLog(s, 'log.night.cupid', { ...who, name: x.name, role: x.roleId, name2: y.name, role2: y.roleId });
  }
  log('log.night.doppelganger', 'doppelganger', a.doppelgangerTarget);
  log('log.night.virginia', 'virginiaWoolf', a.virginiaTarget);
  // 3 — protection & distraction
  log('log.night.hooker', 'hooker', a.hookerTarget);
  log('log.night.bodyguard', 'bodyguard', a.bodyguardTarget);
  log('log.night.priest', 'priest', a.priestTarget);
  // 4 — threats
  log('log.night.vampire', 'vampire', a.vampireTarget);
  for (const id of a.wolfTargets) {
    const whom = target(id);
    if (whom) pushLog(s, 'log.night.wolves', whom);
  }
  log('log.night.bigBadWolf', 'bigBadWolf', a.bigBadWolfTarget);
  log('log.night.direWolf', 'direWolf', a.direWolfTarget);
  log('log.night.sorceress', 'sorceress', a.sorceressTarget);
  // 5 — everyone else
  log('log.night.leprechaun', 'leprechaun', a.leprechaunTarget);
  const seer = inspected('seerInspect', a.seerTarget);
  if (seer !== null) log(seer ? 'log.night.seerWolf' : 'log.night.seerVillage', 'seer', a.seerTarget);
  const aura = inspected('auraInspect', a.auraSeerTarget);
  if (aura !== null) log(aura ? 'log.night.auraSpecial' : 'log.night.auraOrdinary', 'auraSeer', a.auraSeerTarget);
  const pi = inspected('piInspect', a.piTarget);
  if (pi !== null) log(pi ? 'log.night.piFound' : 'log.night.piClear', 'pi', a.piTarget);
  log('log.night.hunterLink', 'hunter', a.hunterTarget);
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

/**
 * Only one player may be nominated at a time: a new nomination opens once the current one
 * is withdrawn, or after an elimination on a Troublemaker day (two eliminations allowed).
 */
export const canNominate = (s: GameState): boolean =>
  s.phase === 'day' && s.dayStep !== 'closed' && s.nominations.length === 0 && (s.executionsLeft ?? 1) > 0;

/** First nomination of the day also collects any Vampire victims. */
export function nominate(state: GameState, accusedId: string, accuserIds: readonly string[] = []): GameState {
  if (!canNominate(state)) return state;
  const s = clone(state);
  if (!s.modifiers.vampireTriggeredToday) {
    s.modifiers.vampireTriggeredToday = true;
    for (const p of s.players) {
      if (p.alive && p.status.vampireMarked) killPlayer(s, p.id, 'vampire', 'day');
    }
  }
  const accused = findPlayer(s, accusedId);
  if (accused?.alive && !accused.status.banished) {
    const accusers = [...new Set(accuserIds)]
      .filter((id) => id !== accusedId)
      .map((id) => findPlayer(s, id))
      .filter((p): p is Player => !!p?.alive);
    s.nominations.push({ id: createId('nom'), accusedId, accuserIds: accusers.map((p) => p.id), voters: normalizeVoters(s, { accusedId }, []) });
    if (accusers.length === 0) pushLog(s, 'log.nominated', { name: accused.name, role: accused.roleId });
    // One timeline line per accuser, so each keeps their role tag.
    for (const accuser of accusers) {
      pushLog(s, 'log.nominatedBy', { name: accused.name, role: accused.roleId, actor: accuser.name, actorRole: accuser.roleId });
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
