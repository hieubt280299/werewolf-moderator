import { describe, expect, it } from 'vitest';
import type { GameState, Player, RoleId } from '../@types/game';
import { createInitialState } from '../context/GameContext';
import {
  calculateBalance,
  EMPTY_STATUS,
  EXPERIENCE_TARGET,
  generateBalancedDeck,
  validateDeck,
} from './gameCalculations';
import * as rules from './gameRules';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

function game(roles: RoleId[]): GameState {
  const players: Player[] = roles.map((roleId, seat) => ({
    id: `p${seat}`,
    name: `P${seat}`,
    seat,
    roleId,
    originalRoleId: roleId,
    alive: true,
    status: { ...EMPTY_STATUS },
  }));
  return rules.startNight({ ...createInitialState(), players, deck: roles });
}

const withActions = (s: GameState, a: Partial<GameState['nightActions']>): GameState => ({
  ...s,
  nightActions: { ...s.nightActions, ...a },
});

const alive = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.alive;

describe('generateBalancedDeck', () => {
  it.each([5, 8, 12, 20])('builds a valid, near-target deck for %i players', (n) => {
    const pool: RoleId[] = ['seer', 'bodyguard', 'hunter', 'witch', 'prince', 'lycan', 'cursed', 'wolfCub', 'sorceress'];
    const deck = generateBalancedDeck({ playerCount: n, pool, experience: 'standard', random: seeded(n) });
    expect(deck).toHaveLength(n);
    expect(validateDeck(deck, n)).toEqual([]);
    expect(Math.abs(calculateBalance(deck) - EXPERIENCE_TARGET.standard)).toBeLessThanOrEqual(2);
    expect(deck.every((id) => id === 'villager' || id === 'werewolf' || pool.includes(id))).toBe(true);
  });
});

describe('night resolution', () => {
  it('kills the wolf target unless the bodyguard protects them', () => {
    const s = game(['werewolf', 'seer', 'bodyguard', 'villager', 'villager']);
    expect(alive(rules.resolveNight(withActions(s, { wolfTargets: ['p1'] })), 'p1')).toBe(false);
    expect(alive(rules.resolveNight(withActions(s, { wolfTargets: ['p1'], bodyguardTarget: 'p1' })), 'p1')).toBe(true);
  });

  it('turns the Cursed into a Werewolf instead of killing them', () => {
    const s = rules.resolveNight(withActions(game(['werewolf', 'cursed', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] }));
    const cursed = s.players[1];
    expect(cursed.alive).toBe(true);
    expect(cursed.roleId).toBe('werewolf');
    expect(rules.seerResult(cursed)).toBe('werewolf');
  });

  it('shows the Lycan to the Seer as a Werewolf', () => {
    const s = game(['werewolf', 'lycan', 'seer', 'villager', 'villager']);
    expect(rules.seerResult(s.players[1])).toBe('werewolf');
  });

  it('makes the wolves skip a night after eating the Diseased', () => {
    let s = rules.resolveNight(withActions(game(['werewolf', 'diseased', 'villager', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] }));
    s = rules.startNight(rules.startDay(s));
    expect(rules.buildNightSteps(s).find((x) => x.action === 'wolfKill')?.targetCount).toBe(0);
  });

  it('gives the wolves two kills after the Wolf Cub dies', () => {
    let s = game(['werewolf', 'wolfCub', 'villager', 'villager', 'villager', 'villager', 'villager']);
    s = rules.startDay(rules.resolveNight(s));
    s = rules.nominate(s, 'p1', null);
    s = rules.executeNomination(s, s.nominations[0].id);
    s = rules.startNight(s);
    expect(rules.buildNightSteps(s).find((x) => x.action === 'wolfKill')?.targetCount).toBe(2);
  });

  it('queues the Hunter shot and defers the win check until it resolves', () => {
    let s = game(['werewolf', 'hunter', 'villager']);
    s = rules.resolveNight(withActions(s, { wolfTargets: ['p1'] }));
    expect(s.pendingTriggers).toHaveLength(1);
    expect(s.phase).toBe('dawn');
    s = rules.resolveHunterShot(s, s.pendingTriggers[0].id, 'p0');
    expect(s.winner?.team).toBe('village');
  });
});

describe('day & win conditions', () => {
  it('lets the Prince survive their first vote', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'prince', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p1', null);
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(alive(s, 'p1')).toBe(true);
    expect(s.players[1].status.princeRevealed).toBe(true);
  });

  it('collects the Vampire victim on the first accusation', () => {
    let s = game(['werewolf', 'vampire', 'villager', 'villager', 'villager', 'villager', 'villager']);
    s = rules.startDay(rules.resolveNight(withActions(s, { vampireTarget: 'p2' })));
    expect(alive(s, 'p2')).toBe(true);
    s = rules.nominate(s, 'p3', null);
    expect(alive(s, 'p2')).toBe(false);
  });

  it('declares a werewolf win at parity', () => {
    const s = rules.resolveNight(withActions(game(['werewolf', 'villager', 'villager']), { wolfTargets: ['p1'] }));
    expect(s.phase).toBe('gameOver');
    expect(s.winner?.team).toBe('werewolf');
  });

  it('only lets the Lone Wolf win as the last survivor', () => {
    const base = game(['loneWolf', 'werewolf', 'villager']);
    const players = base.players.map((p) => (p.id === 'p1' ? { ...p, alive: false } : p));
    expect(rules.evaluateWinner(players)).toBeNull();
    expect(rules.evaluateWinner(players.map((p) => (p.id === 'p2' ? { ...p, alive: false } : p)))?.team).toBe('loneWolf');
  });
});
