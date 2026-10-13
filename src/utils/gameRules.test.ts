import { describe, expect, it } from 'vitest';
import type { GameState, Player, RoleId } from '../@types/game';
import { createInitialState } from '../context/GameContext';
import { applyStatsDelta, EMPTY_STATS, statsDelta } from '../services/profileStore';
import {
  calculateBalance,
  EMPTY_STATUS,
  EXPERIENCE_TARGET,
  formatTimelineEntry,
  generateBalancedDeck,
  groupTimeline,
  swapRole,
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

describe('v0.1.0 mechanics', () => {
  it('swaps roles when picking one another player already holds', () => {
    const { players } = game(['werewolf', 'seer', 'villager', 'villager', 'villager']);
    const next = swapRole(players, 'p2', 'seer');
    expect(next[2].roleId).toBe('seer');
    expect(next[1].roleId).toBe('villager');
    expect(next.map((p) => p.roleId).sort()).toEqual(players.map((p) => p.roleId).sort());
  });

  it('never counts the accused voting on their own nomination', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'seer', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p0', 'p1');
    s = rules.setVoters(s, s.nominations[0].id, ['p0', 'p1', 'p2', 'p2']);
    expect(s.nominations[0].voters).toEqual(['p1', 'p2']);
  });

  it('writes a chronological timeline naming player and role', () => {
    let s = game(['werewolf', 'seer', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { wolfTargets: ['p2'], seerTarget: 'p0' }));
    s = rules.startDay(s);
    s = rules.nominate(s, 'p0', 'p1');
    s = rules.executeNomination(s, s.nominations[0].id);
    const tx = (key: string, params?: Record<string, string | number>) =>
      key + (params ? ' ' + Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' ') : '');
    const groups = groupTimeline(s.log, tx);
    expect(groups.map((g) => g.label)).toEqual(['phase.nightN round=1', 'phase.dayN round=1', 'phase.gameOver']);
    const vote = s.log.find((e) => e.key === 'log.eliminated.vote')!;
    expect(formatTimelineEntry(vote, tx)).toContain('name=P0 role=role.werewolf.name');
  });

  it('keeps lifetime stats right when a game is re-recorded with a new winner', () => {
    let stats = applyStatsDelta(EMPTY_STATS, statsDelta('werewolf', null));
    expect(stats).toEqual({ gamesModerated: 1, werewolfWins: 1, villageWins: 0, otherWins: 0 });
    stats = applyStatsDelta(stats, statsDelta('village', 'werewolf'));
    expect(stats).toEqual({ gamesModerated: 1, werewolfWins: 0, villageWins: 1, otherWins: 0 });
  });
});

describe('expansion roles', () => {
  const day = (s: GameState) => rules.startDay(rules.resolveNight(s));

  it('kills a lover of a broken heart and lets a mixed couple win as the last two', () => {
    let s = game(['werewolf', 'cupid', 'villager', 'villager', 'villager']);
    s = withActions(s, { cupidTargets: ['p0', 'p2'], wolfTargets: ['p3'] });
    s = rules.resolveNight(s);
    expect(s.players[0].status.lover && s.players[2].status.lover).toBe(true);
    // The wolf lover and the villager lover end up as the last two alive.
    s = rules.moderatorEliminate(rules.moderatorEliminate(rules.startDay(s), 'p1'), 'p4');
    expect(s.winner?.team).toBe('couple');
    // Killing one lover takes the other.
    const t = rules.moderatorEliminate(
      rules.resolveNight(withActions(game(['werewolf', 'cupid', 'villager', 'villager', 'villager']), { cupidTargets: ['p2', 'p3'] })),
      'p2',
    );
    expect(t.players[3].alive).toBe(false);
    expect(t.players[3].eliminated?.cause).toBe('heartbreak');
  });

  it('ends the game with a Tanner win when the Tanner is eliminated', () => {
    let s = day(game(['werewolf', 'tanner', 'villager', 'villager', 'villager']));
    s = rules.nominate(s, 'p1', null);
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(s.winner).toEqual({ team: 'tanner', winnerIds: ['p1'] });
  });

  it('keeps the Tough Guy alive until the end of the following night', () => {
    let s = rules.resolveNight(withActions(game(['werewolf', 'toughGuy', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] }));
    expect(alive(s, 'p1')).toBe(true);
    s = rules.resolveNight(rules.startNight(rules.startDay(s)));
    expect(alive(s, 'p1')).toBe(false);
  });

  it('promotes the Apprentice Seer and transforms the Doppelganger on death', () => {
    let s = game(['werewolf', 'seer', 'apprenticeSeer', 'doppelganger', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { doppelgangerTarget: 'p1', wolfTargets: ['p1'] }));
    expect(s.players[2].roleId).toBe('seer');
    expect(s.players[3].roleId).toBe('seer');
  });

  it('links the Dire Wolf to its companion and Virginia Woolf to her target', () => {
    let s = game(['direWolf', 'werewolf', 'virginiaWoolf', 'villager', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { direWolfTarget: 'p3', virginiaTarget: 'p4' }));
    s = rules.moderatorEliminate(rules.startDay(s), 'p3');
    expect(alive(s, 'p0')).toBe(false);
    s = rules.moderatorEliminate(s, 'p2');
    expect(alive(s, 'p4')).toBe(false);
  });

  it('lets the Leprechaun move the attack to a neighbour, and the Witch sees the real victim', () => {
    const s = withActions(game(['werewolf', 'leprechaun', 'villager', 'villager', 'witch']), { wolfTargets: ['p2'], leprechaunTarget: 'p3' });
    expect(rules.effectiveWolfTargets(s)).toEqual(['p3']);
    const after = rules.resolveNight(s);
    expect(alive(after, 'p2')).toBe(true);
    expect(alive(after, 'p3')).toBe(false);
  });

  it('gives the Big Bad Wolf two adjacent kills and stops a lone Fruit Brute', () => {
    const s = withActions(game(['bigBadWolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']), { wolfTargets: ['p3'] });
    const step = rules.buildNightSteps(s).find((x) => x.action === 'wolfKill')!;
    expect(step.targetCount).toBe(2);
    expect(rules.eligibleTargets(s, step).map((p) => p.id).sort()).toEqual(['p2', 'p3', 'p4']);
    const brute = game(['fruitBrute', 'villager', 'villager', 'villager', 'villager']);
    expect(rules.buildNightSteps(brute).find((x) => x.action === 'wolfKill')?.targetCount).toBe(0);
  });

  it('lets Fang Face sleep after night 1 while other wolves live', () => {
    let s = game(['fangFace', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager']);
    expect(rules.buildNightSteps(s).find((x) => x.action === 'wolfKill')?.actors).toEqual(['p0', 'p1']);
    s = rules.startNight(day(s));
    expect(rules.buildNightSteps(s).find((x) => x.action === 'wolfKill')?.actors).toEqual(['p1']);
  });

  it('applies Mayor, Village Idiot, Pacifist and Old Hag voting rules', () => {
    let s = game(['werewolf', 'mayor', 'villageIdiot', 'pacifist', 'oldHag', 'villager', 'villager']);
    s = day(withActions(s, { oldHagTarget: 'p5' }));
    s = rules.nominate(s, 'p0', null);
    const nom = s.nominations[0];
    expect(nom.voters).toEqual(['p2']); // the Idiot is forced in
    s = rules.setVoters(s, nom.id, ['p1', 'p3', 'p5']);
    expect([...s.nominations[0].voters].sort()).toEqual(['p1', 'p2']); // Pacifist & exiled dropped
    expect(rules.voteCount(s, s.nominations[0])).toBe(3); // Mayor x2 + Idiot
    expect(rules.votesNeeded(s)).toBe(4); // 6 eligible voters, Mayor counts twice -> 7 votes
  });

  it('allows two eliminations the day after the Troublemaker acts', () => {
    let s = day(withActions(game(['werewolf', 'troublemaker', 'villager', 'villager', 'villager', 'villager', 'villager']), { troublemakerActor: 'p1' }));
    expect(s.executionsLeft).toBe(2);
    s = rules.nominate(s, 'p2', null);
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(s.dayStep).toBe('voting');
    s = rules.nominate(s, 'p3', null);
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(s.dayStep).toBe('closed');
  });

  it('eliminates the Ghost on night 1 and sobers the Drunk on night 3', () => {
    const s = rules.resolveNight(game(['werewolf', 'ghost', 'villager', 'villager', 'villager']));
    expect(s.players[1].eliminated?.cause).toBe('ghost');
    let d = game(['werewolf', 'drunk', 'villager', 'villager', 'villager', 'villager', 'villager']);
    d = rules.startNight(day(d));
    expect(rules.buildNightSteps(d).some((x) => x.action === 'drunkSober')).toBe(false);
    d = rules.startNight(day(d));
    expect(rules.buildNightSteps(d).some((x) => x.action === 'drunkSober')).toBe(true);
    d = rules.resolveNight(withActions(d, { drunkRole: 'hunter' }));
    expect(d.players[1].roleId).toBe('hunter');
  });

  it('answers the Aura Seer, P.I. and Wolf Man correctly', () => {
    const s = game(['wolfMan', 'villager', 'seer', 'villager', 'werewolf', 'villager']);
    expect(rules.seerResult(s.players[0])).toBe('village');
    expect(rules.auraResult(s.players[1])).toBe(false);
    expect(rules.auraResult(s.players[2])).toBe(true);
    expect(rules.piResult(s, 'p3')).toBe(true); // neighbour p4 is a Werewolf
    expect(rules.piResult(s, 'p1')).toBe(false); // p0 is the Wolf Man, who looks like a Villager
  });

  it('keeps difficulty-3 roles out of beginner and standard auto-balanced decks', () => {
    const pool: RoleId[] = ['seer', 'tanner', 'leprechaun', 'loneWolf', 'drunk', 'priest', 'mayor', 'witch'];
    for (const experience of ['beginner', 'standard'] as const) {
      const deck = generateBalancedDeck({ playerCount: 10, pool, experience, random: seeded(3) });
      expect(deck.some((id) => ['tanner', 'leprechaun', 'loneWolf', 'drunk'].includes(id))).toBe(false);
    }
    const beginner = generateBalancedDeck({ playerCount: 10, pool, experience: 'beginner', random: seeded(5) });
    expect(beginner.includes('witch')).toBe(false); // difficulty 2
  });
});
