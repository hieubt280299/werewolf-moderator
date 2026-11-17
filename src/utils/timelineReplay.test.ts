import { describe, expect, it } from 'vitest';
import { NO_REBALANCES, type Feat, type GameLogEntry, type GameRecord, type GameState, type Player, type RebalanceRules, type RoleId } from '../@types/game';
import { createInitialState } from '../context/GameContext';
import { buildGameRecord, EMPTY_STATUS } from './gameCalculations';
import * as rules from './gameRules';
import { replayTimeline } from './timelineReplay';

function game(roles: RoleId[], names?: string[], house: Partial<RebalanceRules> = {}): GameState {
  const players: Player[] = roles.map((roleId, seat) => ({
    id: `p${seat}`,
    name: names?.[seat] ?? `P${seat}`,
    seat,
    roleId,
    originalRoleId: roleId,
    alive: true,
    status: { ...EMPTY_STATUS },
  }));
  return rules.startNight({ ...createInitialState(), players, deck: roles, rules: { ...NO_REBALANCES, ...house } });
}

const night = (s: GameState, a: Partial<GameState['nightActions']>): GameState =>
  rules.resolveNight({ ...s, nightActions: { ...s.nightActions, ...a } });

function vote(s: GameState, accusedId: string, voters: string[]): GameState {
  let d = s.phase === 'dawn' ? rules.startDay(s) : s;
  d = rules.nominate(d, accusedId);
  const nom = d.nominations[0];
  return nom ? rules.executeNomination(rules.setVoters(d, nom.id, voters), nom.id) : d;
}

/** The record as a version before v1.4.0 kept it: no feats, no player ids, no pick. */
function legacy(s: GameState): GameRecord {
  const { feats: _feats, mvpPick: _pick, ...rest } = buildGameRecord(s)!;
  return { ...rest, players: rest.players.map(({ id: _id, ...p }) => p) };
}

/** Feats under seat ids (the replay's), without escapes (withdrawn accusations never named their voters). */
const comparable = (feats: readonly Feat[]) =>
  feats
    .filter((f) => f.kind !== 'escape')
    .map((f) => ({ ...f, playerId: f.playerId.replace(/^p/, 'seat-'), ...(f.targetId ? { targetId: f.targetId.replace(/^p/, 'seat-') } : {}) }));

describe('replaying a timeline recorded before scores were kept', () => {
  it('rebuilds every feat of a full game: saves, intel, shared kills, votes, payoffs, poison', () => {
    let s = game(['werewolf', 'werewolf', 'seer', 'bodyguard', 'villager', 'villager', 'witch', 'hunter', 'mayor']);
    s = night(s, { wolfTargets: ['p2'], bodyguardTarget: 'p2', seerTarget: 'p0' });
    // Day 1: an accusation that comes to nothing.
    let d = rules.nominate(rules.startDay(s), 'p4');
    d = rules.setVoters(d, d.nominations[0].id, ['p0', 'p1']);
    s = rules.closeDayWithoutExecution(d);
    s = night(rules.startNight(s), { wolfTargets: ['p5'], bodyguardTarget: 'p3', seerTarget: 'p4' });
    s = vote(s, 'p0', ['p2', 'p3', 'p4', 'p6', 'p8', 'p1']);
    s = night(rules.startNight(s), { wolfTargets: ['p7'], witchSaveTarget: 'p7', seerTarget: 'p1', bodyguardTarget: 'p2' });
    s = vote(s, 'p1', ['p2', 'p3', 'p4', 'p6', 'p7', 'p8']);
    expect(s.phase).toBe('gameOver');

    const replayed = replayTimeline(legacy(s));
    expect(replayed).not.toBeNull();
    expect(replayed).toEqual(comparable(s.feats));
    // The one feat the timeline can't show: P4 talked their way out, but the voters weren't logged.
    expect(s.feats.filter((f) => f.kind === 'escape')).toHaveLength(1);
  });

  it('replays the Hunter’s shot, a moderator’s elimination and a revive', () => {
    let s = night(game(['werewolf', 'hunter', 'villager', 'villager', 'villager', 'werewolf', 'villager']), { wolfTargets: ['p1'] });
    s = rules.resolveHunterShot(s, s.pendingTriggers[0].id, 'p0');
    s = rules.startDay(s);
    s = rules.moderatorEliminate(s, 'p2');
    s = rules.revivePlayer(s, 'p2');
    s = vote(s, 'p5', ['p2', 'p3', 'p4', 'p6']);
    expect(s.phase).toBe('gameOver');
    expect(replayTimeline(legacy(s))).toEqual(comparable(s.feats));
  });

  it('plays on where today’s win check would have ended a game (the rules of its time didn’t)', () => {
    // Before v1.3.0 a tie didn't end the game: after Day 1, two Werewolves faced two Villagers
    // and play went on. The timeline is written as that version wrote it.
    let id = 0;
    const line = (round: number, phase: GameLogEntry['phase'], key: string, params?: GameLogEntry['params'], people?: GameLogEntry['people']): GameLogEntry => ({
      id: `l${id++}`,
      round,
      phase,
      key,
      ...(params ? { params } : {}),
      ...(people ? { people } : {}),
    });
    const record: GameRecord = {
      id: 'old',
      startedAt: '2025-01-01T20:00:00.000Z',
      finishedAt: '2025-01-01T21:00:00.000Z',
      rounds: 2,
      poolName: null,
      winner: 'werewolf',
      winnerSeats: [0, 1],
      players: [
        { name: 'A', seat: 0, roleId: 'werewolf', originalRoleId: 'werewolf', alive: true },
        { name: 'B', seat: 1, roleId: 'werewolf', originalRoleId: 'werewolf', alive: true },
        { name: 'C', seat: 2, roleId: 'villager', originalRoleId: 'villager', alive: false },
        { name: 'D', seat: 3, roleId: 'villager', originalRoleId: 'villager', alive: false },
        { name: 'E', seat: 4, roleId: 'villager', originalRoleId: 'villager', alive: false },
        { name: 'F', seat: 5, roleId: 'villager', originalRoleId: 'villager', alive: true },
      ],
      log: [
        line(0, 'setup', 'log.gameStarted', { count: 6 }),
        line(1, 'night', 'log.nightFalls', { round: 1 }),
        line(1, 'night', 'log.night.wolves', { name: 'C', role: 'villager' }),
        line(1, 'night', 'log.eliminated.wolves', { name: 'C', role: 'villager' }),
        line(1, 'dawn', 'log.dawn', { deaths: 1 }),
        line(1, 'day', 'log.eliminated.voteVoted', { name: 'D', role: 'villager', voters: 3 }, [
          { name: 'A', role: 'werewolf' },
          { name: 'B', role: 'werewolf' },
          { name: 'E', role: 'villager' },
        ]),
        line(2, 'night', 'log.nightFalls', { round: 2 }),
        line(2, 'night', 'log.night.wolves', { name: 'E', role: 'villager' }),
        line(2, 'night', 'log.eliminated.wolves', { name: 'E', role: 'villager' }),
        line(2, 'dawn', 'log.dawn', { deaths: 1 }),
        line(2, 'gameOver', 'log.gameOver', { team: 'werewolf' }),
      ],
    };
    const feats = replayTimeline(record)!;
    expect(feats).not.toBeNull();
    expect(feats.filter((f) => f.kind === 'kill').map((f) => [f.playerId, f.targetId, f.shared])).toEqual([
      ['seat-0', 'seat-2', 2],
      ['seat-1', 'seat-2', 2],
      ['seat-0', 'seat-4', 2],
      ['seat-1', 'seat-4', 2],
    ]);
    expect(feats.filter((f) => f.kind === 'vote').map((f) => [f.playerId, f.against])).toEqual([
      ['seat-0', 'enemy'],
      ['seat-1', 'enemy'],
      ['seat-4', 'ally'],
    ]);
  });

  it('leaves votes out of timelines that named the accusers instead (before v1.1.0)', () => {
    let s = night(game(['werewolf', 'seer', 'villager', 'villager', 'villager', 'villager']), { wolfTargets: ['p2'], seerTarget: 'p0' });
    s = vote(s, 'p0', ['p1', 'p3', 'p4']);
    const record = legacy(s);
    // As v1.0 wrote it: the same line, worded with the accusers.
    record.log = record.log.map((e) => (e.key === 'log.eliminated.voteVoted' ? { ...e, key: 'log.eliminated.voteAccused', params: { ...e.params, accusers: 1, voters: undefined! }, people: [{ name: 'P3', role: 'villager' }] } : e));
    const feats = replayTimeline(record)!;
    expect(feats.some((f) => f.kind === 'vote')).toBe(false);
    expect(feats).toEqual(comparable(s.feats).filter((f) => f.kind !== 'vote'));
    // The Seer's exposed wolf was still eliminated: the payoff stands.
    expect(feats.some((f) => f.kind === 'payoff' && f.playerId === 'seat-1')).toBe(true);
  });

  it('tells players with the same name apart by role, and gives up when it can’t', () => {
    const names = ['Lan', 'Lan', 'Minh', 'Nam', 'Oanh'];
    let s = night(game(['werewolf', 'villager', 'villager', 'villager', 'seer'], names), { wolfTargets: ['p2'], seerTarget: 'p0' });
    s = vote(s, 'p0', ['p1', 'p3', 'p4']);
    expect(s.phase).toBe('gameOver');
    expect(replayTimeline(legacy(s))).toEqual(comparable(s.feats));
    // Two Villagers called Lan: the timeline can't say which one a line means.
    let t = night(game(['villager', 'villager', 'werewolf', 'villager', 'seer'], names), { wolfTargets: ['p0'] });
    t = vote(t, 'p2', ['p1', 'p3', 'p4']);
    expect(replayTimeline(legacy(t))).toBeNull();
  });

  it('gives up on a timeline that doesn’t lead to the recorded result', () => {
    const s = vote(night(game(['werewolf', 'villager', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] }), 'p0', ['p2', 'p3']);
    const record = legacy(s);
    // A night call missing from the timeline: P1 never dies in the replay.
    const gap = { ...record, log: record.log.filter((e) => e.key !== 'log.night.wolves') };
    expect(replayTimeline(gap)).toBeNull();
    expect(replayTimeline(record)).not.toBeNull();
  });
});
