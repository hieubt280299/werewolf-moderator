import type { Feat, FeatKind, FeatSource, GameRecord, GameState, RoleId } from '../@types/game';
import { ROLES } from '../data/roles';
import { recordPlayerId, replayTimeline } from './timelineReplay';

/**
 * MVP scoring (v1.4.0). The rules engine records feats as they happen (gameRules); this turns
 * them, the result and the moderator's pick into points. Pure: the game screen and History
 * both score from the same data.
 *
 *   Score = Result + Kills + Saves + Intel + Votes + Moderator's pick
 *
 * Kills and saves are worth the victim's value: stronger roles are worth more to remove (or to
 * keep alive). Informed teams act together, so the pack and the Vampires share each kill.
 */
export const SCORING = {
  /** On the winning side. */
  win: 8,
  /** Alive at the end. */
  alive: 4,
  /**
   * A role's value: this, plus half of what the card is worth to its own team, rounded up,
   * kept between `valueMin` and `valueMax`.
   */
  valueBase: 4,
  valueMin: 3,
  valueMax: 9,
  /**
   * Saving an enemy costs this share of their value (rounded). Protectors choose blind, and the
   * save only matters because someone else's play (a Leprechaun's move, a Witch's poison)
   * aimed at that enemy; killing a teammate, a deliberate attack, costs it all.
   */
  enemySaveCost: 0.5,
  /** The Cult Leader recruits every night: a flat amount per recruit. */
  cultRecruit: 3,
  /** Exposing an enemy / clearing a teammate, by the inspecting role. */
  intel: {
    seer: { found: 4, cleared: 1 },
    auraSeer: { found: 2, cleared: 1 },
    pi: { found: 4, cleared: 2 },
    sorceress: { found: 4, cleared: 0 },
  },
  /** An enemy you exposed is eliminated later. */
  payoff: 2,
  /** Voted out an enemy / a teammate (or the standard Tanner). */
  voteEnemy: 3,
  voteAlly: -2,
  /** Extra per good vote for a role with no power of its own: the vote is all it has. */
  votePlainBonus: 1,
  /**
   * The Werewolf team knows who its enemies are, so its votes earn less. Voting out a packmate
   * costs nothing: it can be cover. Handing the standard Tanner his win still costs `voteAlly`.
   */
  wolfVoteEnemy: 2,
  wolfVoteAlly: 0,
  /** Put to the vote, drew votes, survived. */
  escape: 2,
  diseased: 5,
  toughGuy: 2,
  prince: 3,
  /**
   * The moderator's pick: base + per round played, capped (+10 in a 5-round game). Longer games
   * score more, so the pick grows with them.
   */
  pickBase: 5,
  pickPerRound: 1,
  pickMax: 12,
} as const;

export type ScoreCategory = 'result' | 'kills' | 'saves' | 'intel' | 'votes' | 'pick';
export const SCORE_CATEGORIES: readonly ScoreCategory[] = ['result', 'kills', 'saves', 'intel', 'votes', 'pick'];

const CATEGORY: Record<FeatKind, ScoreCategory> = {
  kill: 'kills',
  convert: 'kills',
  save: 'saves',
  diseased: 'saves',
  toughGuy: 'saves',
  prince: 'saves',
  intel: 'intel',
  payoff: 'intel',
  vote: 'votes',
  escape: 'votes',
};

/**
 * What a card is worth to its own team. The balance weight measures help to the Village (+)
 * against help to the Werewolves (−): a Village card keeps its sign (the Seer +7; Cupid −3,
 * whose card helps the Werewolves on balance), while every other team's card is flipped (a
 * Werewolf's −6 is its strength, 6).
 */
export const roleStrength = (roleId: RoleId): number => {
  const role = ROLES[roleId];
  return role.faction === 'village' ? role.weight : -role.weight;
};

/**
 * What a player is worth to take out, or to keep alive: 4 plus half their card's strength to
 * their own team, rounded up. From 3 (Cupid, Cursed, Troublemaker) through 5 (Villager), 7
 * (Werewolf) and 8 (Seer) to 9 (Big Bad Wolf).
 */
export const roleValue = (roleId: RoleId): number =>
  Math.min(SCORING.valueMax, Math.max(SCORING.valueMin, SCORING.valueBase + Math.ceil(roleStrength(roleId) / 2)));

/** A wolf attack on the Cursed turns them: one Villager fewer, one Werewolf more. Turning them, or saving them from it, is worth a Werewolf. */
const turnedValue = (): number => roleValue('werewolf');

/** A role with no night power and no special ability: its vote is its only weapon. */
export const isPlainRole = (roleId: RoleId): boolean => {
  const role = ROLES[roleId];
  return role.abilities.length === 0 && (!role.nightAction || role.nightAction === 'masonMeet' || role.nightAction === 'minionMeet');
};

/** A role that votes with the Werewolf team's knowledge: the pack, the Minion, the Sorceress, the Lone Wolf. */
export const isWolfSide = (roleId: RoleId): boolean => {
  const team = ROLES[roleId].winTeam;
  return team === 'werewolf' || team === 'loneWolf';
};

/** What the moderator's pick is worth in a game of this many rounds. */
export const pickPoints = (rounds: number): number =>
  Math.min(SCORING.pickMax, SCORING.pickBase + SCORING.pickPerRound * Math.max(1, rounds));

/** One share of a kill split between `shared` players (at least 1 point each). */
const share = (value: number, shared = 1) => (shared > 1 ? Math.max(1, Math.round(value / shared)) : value);

/** Points for one feat (0: the feat earns nothing and is left out of the breakdown). */
export function featPoints(f: Feat): number {
  const value = f.targetRole ? roleValue(f.targetRole) : 0;
  const good = f.against === 'enemy';
  switch (f.kind) {
    case 'kill':
      if (good) return share(value, f.shared);
      // The reworked Tanner doesn't choose who touches him: only enemies he takes down count.
      return f.via === 'tanner' ? 0 : -share(value, f.shared);
    case 'convert':
      if (f.via === 'cult') return SCORING.cultRecruit;
      return good ? share(turnedValue(), f.shared) : -share(turnedValue(), f.shared);
    case 'save': {
      const saved = f.turning ? turnedValue() : value;
      // Saving the standard Tanner keeps him from his win: that's good for everyone else.
      return good ? -Math.round(saved * SCORING.enemySaveCost) : saved;
    }
    case 'intel': {
      const table = f.via ? (SCORING.intel as Partial<Record<FeatSource, { found: number; cleared: number }>>)[f.via] : undefined;
      return table ? (f.found ? table.found : table.cleared) : 0;
    }
    case 'payoff':
      return SCORING.payoff;
    case 'vote':
      if (isWolfSide(f.actorRole)) return good ? SCORING.wolfVoteEnemy : f.against === 'tanner' ? SCORING.voteAlly : SCORING.wolfVoteAlly;
      return good ? SCORING.voteEnemy + (isPlainRole(f.actorRole) ? SCORING.votePlainBonus : 0) : SCORING.voteAlly;
    case 'escape':
      return SCORING.escape;
    case 'diseased':
      return SCORING.diseased;
    case 'toughGuy':
      return SCORING.toughGuy;
    case 'prince':
      return SCORING.prince;
  }
}

/** The i18n key of a feat's line in the breakdown. */
export function featLineKey(f: Feat): string {
  switch (f.kind) {
    case 'kill':
      return `score.kill.${f.via}`;
    case 'convert':
      return f.via === 'cult' ? 'score.convert.cult' : 'score.convert.cursed';
    case 'save':
      return `score.save.${f.via}`;
    case 'intel':
      return `score.intel.${f.via}.${f.found ? 'found' : 'cleared'}`;
    default:
      return `score.${f.kind}`;
  }
}

/** Why a play cost points: it hit a teammate, handed the Tanner his win, or saved an enemy. */
export type ScoreNote = 'teammate' | 'tanner' | 'enemy';

export interface ScoreLine {
  category: ScoreCategory;
  /** i18n key; `params` may name the target ({name}) and their role ({role}). */
  key: string;
  params?: { name: string; role: RoleId };
  points: number;
  /** When it happened (none for the result and the pick). */
  round?: number;
  phase?: 'night' | 'day';
  note?: ScoreNote;
  /** The kill was split between this many players. */
  shared?: number;
}

export interface ScorePlayer {
  id: string;
  name: string;
  seat: number;
  /** The role they ended the game with. */
  roleId: RoleId;
  alive: boolean;
}

export interface PlayerScore {
  player: ScorePlayer;
  won: boolean;
  /** The moderator's pick. */
  picked: boolean;
  total: number;
  byCategory: Record<ScoreCategory, number>;
  /** Plays in the order they happened, then the result and the pick. */
  lines: ScoreLine[];
}

export interface ScoreBoard {
  /** Highest total first; ties go to the winning side, then seat order. */
  ranking: PlayerScore[];
  /** The MVP — more than one on an exact tie. Empty when nobody scored above zero. */
  mvpIds: string[];
  /** What the moderator's pick was worth in this game. */
  pickPoints: number;
  /** Rebuilt from the timeline of a game recorded before scores were kept. */
  fromTimeline?: boolean;
}

export interface ScoreInput {
  players: readonly ScorePlayer[];
  winnerIds: readonly string[];
  feats: readonly Feat[];
  /** The moderator's pick; undefined or null for none. */
  pick?: string | null;
  rounds: number;
}

const emptyCategories = (): Record<ScoreCategory, number> => ({ result: 0, kills: 0, saves: 0, intel: 0, votes: 0, pick: 0 });

const noteOf = (f: Feat, points: number): ScoreNote | undefined => {
  if (points >= 0) return undefined;
  if (f.kind === 'save') return 'enemy';
  return f.against === 'tanner' ? 'tanner' : 'teammate';
};

/** Every player's score, the ranking and the MVP. */
export function scoreGame(input: ScoreInput): ScoreBoard {
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const winners = new Set(input.winnerIds);
  const bonus = pickPoints(input.rounds);
  // The pick goes to someone on the winning side; any other is ignored.
  const pick = input.pick && winners.has(input.pick) ? input.pick : null;
  const scores = new Map<string, PlayerScore>(
    input.players.map((p) => [p.id, { player: p, won: winners.has(p.id), picked: pick === p.id, total: 0, byCategory: emptyCategories(), lines: [] }]),
  );
  const add = (playerId: string, line: ScoreLine) => {
    const score = scores.get(playerId);
    if (!score) return;
    score.lines.push(line);
    score.total += line.points;
    score.byCategory[line.category] += line.points;
  };

  for (const f of input.feats) {
    const points = featPoints(f);
    if (points === 0) continue;
    const target = f.targetId ? byId.get(f.targetId) : undefined;
    add(f.playerId, {
      category: CATEGORY[f.kind],
      key: featLineKey(f),
      ...(target ? { params: { name: target.name, role: f.targetRole ?? target.roleId } } : {}),
      points,
      round: f.round,
      phase: f.phase,
      note: noteOf(f, points),
      ...(f.shared && f.shared > 1 ? { shared: f.shared } : {}),
    });
  }
  for (const p of input.players) {
    if (winners.has(p.id)) add(p.id, { category: 'result', key: 'score.win', points: SCORING.win });
    if (p.alive) add(p.id, { category: 'result', key: 'score.alive', points: SCORING.alive });
    if (pick === p.id) add(p.id, { category: 'pick', key: 'score.pick', points: bonus });
  }

  const ranking = [...scores.values()].sort((a, b) => b.total - a.total || Number(b.won) - Number(a.won) || a.player.seat - b.player.seat);
  const [top] = ranking;
  const mvpIds = top && top.total > 0 ? ranking.filter((s) => s.total === top.total && s.won === top.won).map((s) => s.player.id) : [];
  return { ranking, mvpIds, pickPoints: bonus };
}

/** Scores a game in progress or just finished. */
export const scoreInputOf = (s: GameState): ScoreInput => ({
  players: s.players.map(({ id, name, seat, roleId, alive }) => ({ id, name, seat, roleId, alive })),
  winnerIds: s.winner?.winnerIds ?? [],
  feats: s.feats ?? [],
  pick: s.mvpPick,
  rounds: s.round,
});

/**
 * Scores a finished game from History. A game recorded before v1.4.0 kept no feats: they are
 * rebuilt from its timeline (see timelineReplay), and it has no moderator's pick. Null when
 * that timeline can't be replayed to the recorded result.
 */
export function recordScoreInput(record: GameRecord): (ScoreInput & { fromTimeline: boolean }) | null {
  const fromTimeline = !record.feats;
  const feats = record.feats ?? replayTimeline(record);
  if (!feats) return null;
  const players: ScorePlayer[] = record.players.map((p) => ({ id: recordPlayerId(p), name: p.name, seat: p.seat, roleId: p.roleId, alive: p.alive }));
  const winners = new Set(record.winnerSeats);
  return {
    players,
    winnerIds: players.filter((p) => winners.has(p.seat)).map((p) => p.id),
    feats,
    pick: fromTimeline ? null : record.mvpPick,
    rounds: record.rounds,
    fromTimeline,
  };
}

/** Scoreboards already worked out, per record (a replayed timeline is worth keeping). */
const boards = new WeakMap<GameRecord, ScoreBoard | null>();

/** A finished game's scoreboard from History; null if it can't be scored. */
export function recordScoreBoard(record: GameRecord): ScoreBoard | null {
  if (boards.has(record)) return boards.get(record)!;
  const input = recordScoreInput(record);
  const board = input ? { ...scoreGame(input), ...(input.fromTimeline ? { fromTimeline: true } : {}) } : null;
  boards.set(record, board);
  return board;
}

/** Ranks that share equal totals: 1, 2, 2, 4… */
export const standings = (ranking: readonly PlayerScore[]): number[] =>
  ranking.map((s) => ranking.findIndex((x) => x.total === s.total) + 1);
