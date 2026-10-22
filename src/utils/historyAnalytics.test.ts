import { describe, expect, it } from 'vitest';
import type { GameRecord, RoleId, WinTeam } from '../@types/game';
import { createInitialState, gameReducer } from '../context/GameContext';
import { lineupSetup } from './gameCalculations';
import { historyRecords, leaders, MAX_TIED, tallyRoles, winShares } from './historyAnalytics';

let nextId = 0;

/** A finished game: one player per role, in seat order; `winners` are seat indexes. */
function game(roles: RoleId[], winners: number[], extra: Partial<GameRecord> = {}): GameRecord {
  nextId += 1;
  return {
    id: `g${nextId}`,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T01:00:00.000Z',
    rounds: 3,
    poolName: null,
    winner: 'village' as WinTeam,
    players: roles.map((roleId, seat) => ({ name: `P${seat + 1}`, seat, roleId, originalRoleId: roleId, alive: true })),
    winnerSeats: winners,
    log: [],
    ...extra,
  };
}

describe('winShares', () => {
  it('gives each team its count and whole percent of all games', () => {
    const shares = winShares({ gamesModerated: 20, werewolfWins: 6, villageWins: 13, otherWins: 1 });
    expect(shares.find((s) => s.key === 'village')).toEqual({ key: 'village', wins: 13, total: 20, percent: 65 });
    expect(shares.find((s) => s.key === 'werewolf')?.percent).toBe(30);
    expect(shares.find((s) => s.key === 'other')?.percent).toBe(5);
  });

  it('is 0% with no games', () => {
    expect(winShares({ gamesModerated: 0, werewolfWins: 0, villageWins: 0, otherWins: 0 }).every((s) => s.percent === 0)).toBe(true);
  });
});

describe('tallyRoles', () => {
  it('counts games, not cards, and credits wins by the card the player was dealt', () => {
    const g = game(['werewolf', 'werewolf', 'cursed', 'seer'], [0, 1, 2]);
    // The Cursed was bitten: they won with the wolves, but the card dealt was the Cursed.
    g.players[2].roleId = 'werewolf';
    const tallies = tallyRoles([g, game(['werewolf', 'werewolf', 'seer'], [2])]);
    expect(tallies.find((r) => r.roleId === 'werewolf')).toEqual({ roleId: 'werewolf', played: 2, wins: 1 });
    expect(tallies.find((r) => r.roleId === 'cursed')).toEqual({ roleId: 'cursed', played: 1, wins: 1 });
    expect(tallies.find((r) => r.roleId === 'seer')).toEqual({ roleId: 'seer', played: 2, wins: 1 });
  });

  it('counts a win once per game when only some copies of a role won', () => {
    const g = game(['villager', 'villager', 'villager', 'werewolf'], [0]);
    expect(tallyRoles([g]).find((r) => r.roleId === 'villager')).toEqual({ roleId: 'villager', played: 1, wins: 1 });
  });
});

describe('leaders', () => {
  it('keeps every tie in input order but shows at most three', () => {
    const board = leaders([5, 9, 9, 2, 9, 9], (n) => n);
    expect(board).toEqual({ value: 9, entries: [9, 9, 9], tied: 4 });
    expect(board?.entries).toHaveLength(MAX_TIED);
  });

  it('has no record when the best score is 0', () => {
    expect(leaders([0, 0], (n) => n)).toBeNull();
    expect(leaders([], (n: number) => n)).toBeNull();
  });
});

describe('historyRecords', () => {
  it('only ranks win rates of roles with 3 or more wins', () => {
    const games = [
      // The Hunter wins its only 2 games (100%) but is below the threshold.
      game(['hunter', 'werewolf'], [0]),
      game(['hunter', 'werewolf'], [0]),
      // The Seer: 3 wins in 4 games (75%). The Witch: 3 wins in 3 games (100%).
      game(['seer', 'witch', 'werewolf'], [0, 1]),
      game(['seer', 'witch', 'werewolf'], [0, 1]),
      game(['seer', 'witch', 'werewolf'], [0, 1]),
      game(['seer', 'werewolf'], [1]),
    ];
    const records = historyRecords(games);
    expect(records.bestRate?.value).toBe(1);
    expect(records.bestRate?.entries.map((r) => r.roleId)).toEqual(['witch']);
    // The Werewolf is in all 6 games but never counts for most played.
    expect(records.mostPlayed?.entries.map((r) => r.roleId)).toEqual(['seer']);
    expect(records.mostPlayed?.value).toBe(4);
    // Seer and Witch tie on 3 wins; the Seer was played more, so it is listed first.
    expect(records.mostWins?.value).toBe(3);
    expect(records.mostWins?.entries.map((r) => r.roleId)).toEqual(['seer', 'witch']);
  });

  it('leaves Villagers and Werewolves out of most played only', () => {
    const games = Array.from({ length: 4 }, () => game(['villager', 'villager', 'werewolf', 'seer'], [0, 1, 3]));
    games.push(game(['villager', 'werewolf', 'witch'], [0, 2]));
    const records = historyRecords(games);
    expect(records.mostPlayed?.entries.map((r) => r.roleId)).toEqual(['seer']);
    expect(records.mostWins?.entries.map((r) => r.roleId)).toEqual(['villager']);
    expect(records.mostWins?.value).toBe(5);
  });

  it('has no most played role when only Villagers and Werewolves were dealt', () => {
    expect(historyRecords([game(['villager', 'werewolf'], [0])]).mostPlayed).toBeNull();
  });

  it('treats equal win rates as a tie', () => {
    const games = [
      ...Array.from({ length: 3 }, () => game(['seer', 'witch'], [0, 1])),
      ...Array.from({ length: 3 }, () => game(['seer', 'witch'], [])),
    ];
    const rate = historyRecords(games).bestRate;
    expect(rate?.value).toBe(0.5);
    expect(rate?.tied).toBe(2);
  });

  it('finds the longest and biggest games, ties included', () => {
    const a = game(['seer', 'werewolf'], [0], { rounds: 7 });
    const b = game(['seer', 'werewolf', 'villager'], [0], { rounds: 7 });
    const c = game(['seer', 'werewolf', 'villager', 'villager'], [0], { rounds: 2 });
    const records = historyRecords([a, b, c]);
    expect(records.longest?.entries.map((g) => g.id)).toEqual([a.id, b.id]);
    expect(records.biggest?.entries.map((g) => g.id)).toEqual([c.id]);
    expect(records.biggest?.value).toBe(4);
  });

  it('has no records without games', () => {
    expect(historyRecords([])).toEqual({ mostPlayed: null, mostWins: null, bestRate: null, longest: null, biggest: null });
  });
});

describe('lineupSetup', () => {
  it('seats the same names with the dealt cards, ready on the Deal board', () => {
    const g = game(['seer', 'werewolf', 'cursed', 'villager', 'villager'], [0], { poolName: 'Friday', pool: ['seer', 'werewolf', 'witch'] });
    // Stored out of seat order; the Cursed was bitten during play.
    g.players.reverse();
    g.players.find((p) => p.originalRoleId === 'cursed')!.roleId = 'werewolf';
    const setup = lineupSetup(g);
    expect(setup.names).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
    expect([...(setup.deck ?? [])].sort()).toEqual(['cursed', 'seer', 'villager', 'villager', 'werewolf']);
    expect(setup.pool).toEqual(expect.arrayContaining(['seer', 'werewolf', 'witch', 'cursed', 'villager']));
    expect(setup.step).toBe('deal');
    expect(setup.deal?.slots).toEqual([null, null, null, null, null]);
    expect(setup.deal?.tray).toEqual(setup.deck);
    expect(setup.poolName).toBe('Friday');
  });

  it('falls back to the dealt roles for games recorded without a pool', () => {
    const setup = lineupSetup(game(['seer', 'werewolf', 'villager', 'villager', 'villager'], []));
    expect([...(setup.pool ?? [])].sort()).toEqual(['seer', 'villager', 'werewolf']);
  });

  it('starts a clean game in setup, keeping only the experience', () => {
    const played = { ...createInitialState({ experience: 'veteran' }), phase: 'gameOver' as const, round: 4 };
    played.log = [{ id: 'l', round: 1, phase: 'night', key: 'log.gameStarted' }];
    const next = gameReducer(played, { type: 'LOAD_LINEUP', setup: lineupSetup(game(['seer', 'werewolf', 'villager', 'villager', 'villager'], [])) });
    expect(next.phase).toBe('setup');
    expect(next.round).toBe(0);
    expect(next.log).toEqual([]);
    expect(next.players).toEqual([]);
    expect(next.setup.step).toBe('deal');
    expect(next.setup.experience).toBe('veteran');
    expect(next.id).not.toBe(played.id);
  });
});
