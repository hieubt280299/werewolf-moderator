import {
  NO_REBALANCES,
  type Feat,
  type GameLogEntry,
  type GameRecord,
  type GameRecordPlayer,
  type GameState,
  type NightActionField,
  type NightActions,
  type Phase,
  type Player,
  type RebalanceRules,
  type RoleId,
} from '../@types/game';
import { ROLES } from '../data/roles';
import { EMPTY_STATUS } from './gameCalculations';
import * as rules from './gameRules';

/**
 * Scores for games recorded before v1.4.0, which kept no feats. Their timeline still names
 * every night call, vote and elimination, so the game is played again through today's rules
 * engine from the timeline, and the engine records the feats as it would live.
 *
 * What the timeline can't tell is left out: the voters on an accusation that was withdrawn
 * (so no "talked their way out"), and before v1.1.0 the voters at all (those timelines name
 * who made the accusation, not who voted).
 *
 * Rules have changed since some of these games were played, so the replay doesn't stop where
 * today's win check would end the game; it plays the timeline to its end. It then checks every
 * player's fate and role against the record. A game that doesn't come out the same isn't scored.
 */

/** The id a record's player is scored under: their game id, or their seat on records from before v1.4.0. */
export const recordPlayerId = (p: Pick<GameRecordPlayer, 'id' | 'seat'>): string => p.id ?? `seat-${p.seat}`;

class Unreplayable extends Error {}

/** Night calls in the timeline, and the night action field each one recorded. */
const NIGHT_FIELDS: Record<string, NightActionField> = {
  'log.night.doppelganger': 'doppelgangerTarget',
  'log.night.virginia': 'virginiaTarget',
  'log.night.direWolf': 'direWolfTarget',
  'log.night.hooker': 'hookerTarget',
  'log.night.bodyguard': 'bodyguardTarget',
  'log.night.priest': 'priestTarget',
  'log.night.vampire': 'vampireTarget',
  'log.night.bigBadWolf': 'bigBadWolfTarget',
  'log.night.sorceress': 'sorceressTarget',
  'log.night.seerWolf': 'seerTarget',
  'log.night.seerVillage': 'seerTarget',
  'log.night.auraSpecial': 'auraSeerTarget',
  'log.night.auraOrdinary': 'auraSeerTarget',
  'log.night.piFound': 'piTarget',
  'log.night.piClear': 'piTarget',
  'log.night.hunterLink': 'hunterTarget',
  'log.night.witchSave': 'witchSaveTarget',
  'log.night.witchKill': 'witchKillTarget',
  'log.night.oldHag': 'oldHagTarget',
  'log.night.spellcaster': 'spellcasterTarget',
  'log.night.cult': 'cultTarget',
};

/** A day's elimination by vote, the vote that revealed a Prince, and an accusation that ended without one. */
const VOTED_OUT = new Set(['log.eliminated.vote', 'log.eliminated.voteVoted', 'log.eliminated.voteAccused']);
const PRINCE_VOTE = new Set(['log.princeRevealed', 'log.princeRevealedVoted', 'log.princeRevealedAccused']);
const WITHDRAWN = new Set(['log.accusationWithdrawn', 'log.accusationWithdrawnAccused']);

/**
 * The house rules a game was dealt with, read from its timeline (records don't keep them):
 * the Hunter's night link and the Big Bad Wolf's own strike leave their own lines; a Tanner
 * who died without winning was the reworked, Village one.
 */
function inferRules(record: GameRecord): RebalanceRules {
  const has = (key: string) => record.log.some((e) => e.key === key);
  const tannerDied = record.players.some((p) => p.originalRoleId === 'tanner' && !p.alive);
  return {
    ...NO_REBALANCES,
    hunter: has('log.night.hunterLink'),
    bigBadWolf: has('log.night.bigBadWolf'),
    tanner: has('log.eliminated.tanner') || (tannerDied && record.winner !== 'tanner'),
  };
}

/** The game as dealt: every player alive with the card they were dealt, night 1 begun. */
function dealtGame(record: GameRecord): GameState {
  const players: Player[] = [...record.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({
      id: recordPlayerId(p),
      name: p.name,
      seat: p.seat,
      roleId: p.originalRoleId,
      originalRoleId: p.originalRoleId,
      alive: true,
      status: { ...EMPTY_STATUS },
    }));
  const deck = players.map((p) => p.originalRoleId);
  return rules.startNight({
    version: 1,
    id: record.id,
    phase: 'setup',
    round: 0,
    dayStep: 'discussion',
    players,
    deck,
    nightStepIndex: 0,
    nightActions: rules.emptyNightActions(),
    modifiers: rules.emptyModifiers(),
    lastReport: null,
    nominations: [],
    executedToday: null,
    executionsLeft: 1,
    pendingTriggers: [],
    winner: null,
    log: [],
    setup: { names: players.map((p) => p.name), deck, pool: record.pool ?? [], experience: 'standard' },
    rules: inferRules(record),
    fullPoolCalls: false,
    feats: [],
    createdAt: 0,
    updatedAt: 0,
  });
}

/**
 * The feats of a recorded game, rebuilt from its timeline, with players under
 * `recordPlayerId`. Null when the timeline can't be replayed to the recorded result.
 */
export function replayTimeline(record: GameRecord): Feat[] | null {
  try {
    return replay(record);
  } catch (err) {
    if (err instanceof Unreplayable) return null;
    throw err;
  }
}

function replay(record: GameRecord): Feat[] | null {
  // Timelines name players. Two players may share a name: then the role the line names tells
  // them apart.
  const byName = new Map<string, GameRecordPlayer[]>();
  for (const p of record.players) byName.set(p.name, [...(byName.get(p.name) ?? []), p]);
  const idOf = (name: unknown, role?: unknown): string => {
    const named = typeof name === 'string' ? (byName.get(name) ?? []) : [];
    const found = named.length > 1 ? named.filter((p) => p.roleId === role || p.originalRoleId === role) : named;
    if (found.length !== 1) throw new Unreplayable();
    return recordPlayerId(found[0]);
  };
  const target = (e: GameLogEntry) => idOf(e.params?.name, e.params?.role);

  let s = dealtGame(record);
  // Today's win check may end a game the rules of its time played on: play on to the timeline's end.
  const reopen = (next: GameState, phase: Phase): GameState => (next.phase === 'gameOver' ? { ...next, phase, winner: null } : next);

  // Tonight's calls, applied all at once at dawn (the timeline lists them before the deaths).
  let night: Partial<NightActions> = {};
  let wolfTargets: string[] = [];
  let cupidTargets: string[] = [];
  let drunkRole: RoleId | null = null;
  // Before v1.2.0 the Leprechaun picked a player; it is replayed as the move onto them.
  let leprechaunPick: string | null = null;

  const resolve = () => {
    // A Hunter the moderator took out tonight who held fire (the app waits for that choice).
    settle();
    if (drunkRole) s = rules.chooseDrunkRole(s, drunkRole);
    let move = night.leprechaunMove ?? null;
    if (!move && leprechaunPick && wolfTargets.length > 0) {
      move = (['left', 'right'] as const).find((d) => rules.neighborToward(s.players, wolfTargets[0], d)?.id === leprechaunPick) ?? null;
    }
    s = { ...s, nightActions: { ...s.nightActions, ...night, leprechaunMove: move, wolfTargets, cupidTargets } };
    s = reopen(rules.resolveNight(s), 'dawn');
    night = {};
    wolfTargets = [];
    cupidTargets = [];
    drunkRole = null;
    leprechaunPick = null;
  };

  // A Hunter's shot is logged as the death it caused; a Hunter who held fire leaves no line.
  const shoot = (targetId: string | null) => {
    const trigger = s.pendingTriggers[0];
    if (trigger) s = reopen(rules.resolveHunterShot(s, trigger.id, targetId), s.phase);
  };
  const settle = () => {
    while (s.pendingTriggers.length > 0) shoot(null);
  };
  const toDay = () => {
    settle();
    if (s.phase === 'dawn') s = rules.startDay(s);
    if (s.phase !== 'day') throw new Unreplayable();
  };
  /** Puts a player to the vote; the open nomination, if there is one (a hidden Prince is revealed instead). */
  const accuse = (id: string) => {
    toDay();
    s = reopen(rules.nominate(s, id), 'day');
    return s.nominations.find((n) => n.accusedId === id);
  };
  /** Moderator's actions, logged when made, in any phase. */
  const ruling = (e: GameLogEntry): boolean => {
    if (e.key === 'log.eliminated.moderator') s = reopen(rules.moderatorEliminate(s, target(e)), s.phase);
    else if (e.key === 'log.revived') s = rules.revivePlayer(s, target(e));
    else if (e.key === 'log.eliminated.hunter' && s.pendingTriggers.length > 0) shoot(target(e));
    else return false;
    return true;
  };

  for (const e of record.log) {
    if (e.key === 'log.gameOver') break;
    if (e.key === 'log.gameStarted') continue;
    if (s.phase === 'night') {
      if (e.phase === 'night') {
        if (ruling(e)) continue;
        const p = e.params ?? {};
        const field = NIGHT_FIELDS[e.key];
        if (field) night = { ...night, [field]: target(e) };
        else if (e.key === 'log.night.wolves') wolfTargets.push(target(e));
        else if (e.key === 'log.night.cupid') cupidTargets = [target(e), idOf(p.name2, p.role2)];
        else if (e.key.startsWith('log.night.leprechaunLeft')) night.leprechaunMove = 'left';
        else if (e.key.startsWith('log.night.leprechaunRight')) night.leprechaunMove = 'right';
        else if (e.key === 'log.night.leprechaun') leprechaunPick = target(e);
        else if (e.key === 'log.night.troublemaker') night.troublemakerActor = 'timeline';
        else if (e.key === 'log.drunkSober' && typeof p.role === 'string' && p.role in ROLES) drunkRole = p.role as RoleId;
        // Everything else is what the night led to (deaths, a turned Cursed…): the engine repeats it.
        continue;
      }
      resolve();
    }
    if (ruling(e)) continue;
    if (e.key === 'log.nightFalls') {
      settle();
      if (s.phase === 'dawn') s = rules.startDay(s);
      s = rules.startNight(s);
    } else if (e.key === 'log.princeNominated') {
      accuse(target(e));
    } else if (WITHDRAWN.has(e.key)) {
      const nom = accuse(target(e));
      if (nom) s = rules.removeNomination(s, nom.id);
    } else if (VOTED_OUT.has(e.key) || PRINCE_VOTE.has(e.key)) {
      const nom = accuse(target(e));
      if (nom) {
        // Only the `…Voted` wording names the voters; the older `…Accused` one names the accusers.
        if (e.key.endsWith('Voted')) s = rules.setVoters(s, nom.id, (e.people ?? []).map((v) => idOf(v.name, v.role)));
        s = reopen(rules.executeNomination(s, nom.id), 'day');
      }
    } else if (e.key === 'log.noExecution') {
      toDay();
      if (s.dayStep !== 'closed') s = rules.closeDayWithoutExecution(s);
    }
    // Other lines are what the day led to (Vampire victims, broken hearts, links), or older
    // accusation lines whose outcome follows: the engine repeats them.
  }
  if (s.phase === 'night') resolve();

  // The replay must come out as the game did: who lived, and as what.
  const replayed = new Map(s.players.map((p) => [p.id, p]));
  const same = record.players.every((p) => {
    const r = replayed.get(recordPlayerId(p));
    return !!r && r.alive === p.alive && r.roleId === p.roleId;
  });
  return same ? s.feats : null;
}
