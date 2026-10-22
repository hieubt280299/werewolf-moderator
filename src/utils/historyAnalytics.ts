import type { GameRecord, LifetimeStats, RoleId } from '../@types/game';
import { ROLE_ORDER } from '../data/roles';

/** Tied records beyond this many are counted but not shown. */
export const MAX_TIED = 3;
/** A role needs at least this many wins before its win rate can hold a record. */
export const MIN_WINS_FOR_RATE = 3;

/** Roles too common to make "most played" interesting: nearly every game has them. */
export const MOST_PLAYED_EXCLUDED: readonly RoleId[] = ['villager', 'werewolf'];

/** How many games a role was dealt in, and how many of those it won. */
export interface RoleTally {
  roleId: RoleId;
  /** Games with at least one copy of the role. */
  played: number;
  /** Games where a player holding the role ended on the winning side. */
  wins: number;
}

/** The best value for a record and the entries that share it. */
export interface Leaderboard<T> {
  value: number;
  /** Up to MAX_TIED entries, in display order. */
  entries: T[];
  /** Every entry that shares the value, including those not shown. */
  tied: number;
}

export interface HistoryRecords {
  mostPlayed: Leaderboard<RoleTally> | null;
  mostWins: Leaderboard<RoleTally> | null;
  /** Win rate as a fraction (0..1), among roles with at least MIN_WINS_FOR_RATE wins. */
  bestRate: Leaderboard<RoleTally> | null;
  /** Most nights played. */
  longest: Leaderboard<GameRecord> | null;
  biggest: Leaderboard<GameRecord> | null;
}

export type WinShareKey = 'werewolf' | 'village' | 'other';

export interface WinShare {
  key: WinShareKey;
  wins: number;
  total: number;
  /** Whole percent of all games. */
  percent: number;
}

export const percentOf = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Wins per team as counts and percentages of every finished game. */
export function winShares(stats: LifetimeStats): WinShare[] {
  // Every game ends in exactly one of these, so their sum is the number of games.
  const total = stats.werewolfWins + stats.villageWins + stats.otherWins;
  return [
    { key: 'werewolf', wins: stats.werewolfWins },
    { key: 'village', wins: stats.villageWins },
    { key: 'other', wins: stats.otherWins },
  ].map((s) => ({ ...(s as { key: WinShareKey; wins: number }), total, percent: percentOf(s.wins, total) }));
}

/**
 * Per-role tallies over the given games. A role counts once per game however many copies
 * were dealt (two Werewolves in one game are one play, and one win if either won), by the
 * card the player was dealt: a bitten Cursed still counts as the Cursed. Sorted by plays,
 * then in catalogue order.
 */
export function tallyRoles(games: readonly GameRecord[]): RoleTally[] {
  const tallies = new Map<RoleId, RoleTally>();
  for (const game of games) {
    const winners = new Set(game.winnerSeats);
    const played = new Set<RoleId>();
    const won = new Set<RoleId>();
    for (const p of game.players) {
      played.add(p.originalRoleId);
      if (winners.has(p.seat)) won.add(p.originalRoleId);
    }
    for (const roleId of played) {
      const tally = tallies.get(roleId) ?? { roleId, played: 0, wins: 0 };
      tally.played += 1;
      if (won.has(roleId)) tally.wins += 1;
      tallies.set(roleId, tally);
    }
  }
  return [...tallies.values()].sort(
    (a, b) => b.played - a.played || ROLE_ORDER.indexOf(a.roleId) - ROLE_ORDER.indexOf(b.roleId),
  );
}

/**
 * The entries with the highest score, keeping the input order among ties. Null when there
 * is nothing to rank, or the best score is 0 (no record worth showing).
 */
export function leaders<T>(items: readonly T[], score: (item: T) => number): Leaderboard<T> | null {
  let best = 0;
  let top: T[] = [];
  for (const item of items) {
    const value = score(item);
    if (value > best) {
      best = value;
      top = [item];
    } else if (value === best && value > 0) {
      top.push(item);
    }
  }
  return top.length ? { value: best, entries: top.slice(0, MAX_TIED), tied: top.length } : null;
}

/** Record holders across the given games (newest first, as the history lists them). */
export function historyRecords(games: readonly GameRecord[]): HistoryRecords {
  const roles = tallyRoles(games);
  return {
    mostPlayed: leaders(
      roles.filter((r) => !MOST_PLAYED_EXCLUDED.includes(r.roleId)),
      (r) => r.played,
    ),
    mostWins: leaders(roles, (r) => r.wins),
    // Equal fractions divide to the same double (2/6 === 1/3), so ties compare exactly.
    bestRate: leaders(
      roles.filter((r) => r.wins >= MIN_WINS_FOR_RATE),
      (r) => r.wins / r.played,
    ),
    longest: leaders(games, (g) => g.rounds),
    biggest: leaders(games, (g) => g.players.length),
  };
}
