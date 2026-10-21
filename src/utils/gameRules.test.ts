import { describe, expect, it } from 'vitest';
import { NO_REBALANCES, type GameState, type Player, type RebalanceRules, type RoleId } from '../@types/game';
import { createInitialState, gameReducer, normalizeGameState } from '../context/GameContext';
import { roleDescKey } from '../context/HouseRulesContext';
import { dictionaries } from '../i18n/translations';
import { ROLE_SECTIONS, ROLES, withFillers } from '../data/roles';
import { applyStatsDelta, EMPTY_STATS, statsDelta } from '../services/profileStore';
import {
  addsTeam,
  timelineParts,
  calculateBalance,
  extraTeams,
  EMPTY_STATUS,
  EXPERIENCE_TARGET,
  formatTimelineEntry,
  generateBalancedDeck,
  maxAutoVillagers,
  groupTimeline,
  dealComplete,
  emptyDeal,
  moveCard,
  validateDeck,
} from './gameCalculations';
import * as rules from './gameRules';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

function game(roles: RoleId[], house: Partial<RebalanceRules> = {}): GameState {
  const players: Player[] = roles.map((roleId, seat) => ({
    id: `p${seat}`,
    name: `P${seat}`,
    seat,
    roleId,
    originalRoleId: roleId,
    alive: true,
    status: { ...EMPTY_STATUS },
  }));
  return rules.startNight({ ...createInitialState(), players, deck: roles, rules: { ...NO_REBALANCES, ...house } });
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
    s = rules.nominate(s, 'p1', []);
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
    s = rules.nominate(s, 'p1', []);
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(alive(s, 'p1')).toBe(true);
    expect(s.players[1].status.princeRevealed).toBe(true);
  });

  it('collects the Vampire victim on the first accusation', () => {
    let s = game(['werewolf', 'vampire', 'villager', 'villager', 'villager', 'villager', 'villager']);
    s = rules.startDay(rules.resolveNight(withActions(s, { vampireTarget: 'p2' })));
    expect(alive(s, 'p2')).toBe(true);
    s = rules.nominate(s, 'p3', []);
    expect(alive(s, 'p2')).toBe(false);
  });

  it('declares a werewolf win once a Village with no kill left is outnumbered — not at parity', () => {
    let s = rules.resolveNight(withActions(game(['werewolf', 'werewolf', 'villager', 'villager', 'villager']), { wolfTargets: ['p2'] }));
    expect(s.winner).toBeNull(); // 2 against 2: play on
    s = rules.resolveNight(withActions(rules.startNight(rules.startDay(s)), { wolfTargets: ['p3'] }));
    expect(s.phase).toBe('gameOver');
    expect(s.winner?.team).toBe('werewolf');
  });

  it('only lets the Lone Wolf win as the last survivor', () => {
    const base = game(['loneWolf', 'werewolf', 'villager']);
    const players = base.players.map((p) => (p.id === 'p1' ? { ...p, alive: false } : p));
    expect(rules.evaluateWinner({ players })).toBeNull();
    expect(rules.evaluateWinner({ players: players.map((p) => (p.id === 'p2' ? { ...p, alive: false } : p)) })?.team).toBe('loneWolf');
  });
});

describe('v0.1.0 mechanics', () => {
  it('deals by moving cards between the tray and seats, swapping on occupied seats', () => {
    const deck: RoleId[] = ['werewolf', 'seer', 'villager', 'villager'];
    let d = emptyDeal(4, deck);
    expect(d.tray).toEqual(['villager', 'villager', 'seer', 'werewolf']);
    d = moveCard(d, { kind: 'tray', roleId: 'seer' }, { kind: 'slot', index: 0 });
    d = moveCard(d, { kind: 'tray', roleId: 'werewolf' }, { kind: 'slot', index: 1 });
    // Tray card onto a filled seat: the occupant goes back to the tray.
    d = moveCard(d, { kind: 'tray', roleId: 'villager' }, { kind: 'slot', index: 0 });
    expect(d.slots).toEqual(['villager', 'werewolf', null, null]);
    expect(d.tray).toEqual(['villager', 'seer']);
    // Seat onto seat swaps; seat back to the tray unassigns.
    d = moveCard(d, { kind: 'slot', index: 0 }, { kind: 'slot', index: 1 });
    expect(d.slots.slice(0, 2)).toEqual(['werewolf', 'villager']);
    d = moveCard(d, { kind: 'slot', index: 1 }, { kind: 'trayZone' });
    expect(d.slots[1]).toBeNull();
    // The cards themselves never change.
    expect([...d.slots.filter(Boolean), ...d.tray].sort()).toEqual([...deck].sort());
    expect(dealComplete(d)).toBe(false);
  });

  it('never counts the accused voting on their own nomination', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'seer', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p0', ['p1']);
    s = rules.setVoters(s, s.nominations[0].id, ['p0', 'p1', 'p2', 'p2']);
    expect(s.nominations[0].voters).toEqual(['p1', 'p2']);
  });

  it('writes a chronological timeline naming player and role', () => {
    let s = game(['werewolf', 'seer', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { wolfTargets: ['p2'], seerTarget: 'p0' }));
    s = rules.startDay(s);
    s = rules.nominate(s, 'p0', ['p1']);
    s = rules.executeNomination(s, s.nominations[0].id);
    const tx = (key: string, params?: Record<string, string | number>) =>
      key + (params ? ' ' + Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' ') : '');
    const groups = groupTimeline(s.log, tx);
    expect(groups.map((g) => g.label)).toEqual(['phase.nightN round=1', 'phase.dayN round=1', 'phase.gameOver']);
    // One line for the vote, carrying its accuser.
    const vote = s.log.find((e) => e.key === 'log.eliminated.voteAccused')!;
    expect(formatTimelineEntry(vote, tx)).toContain('name=P0 role=role.werewolf.name');
    expect(vote.people).toEqual([{ name: 'P1', role: 'seer' }]);
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
    s = rules.nominate(s, 'p1', []);
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
    s = rules.nominate(s, 'p0', []);
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
    s = rules.nominate(s, 'p2', []);
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(s.dayStep).toBe('voting');
    s = rules.nominate(s, 'p3', []);
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

describe('the Couple', () => {
  it('only forms from lovers on different teams; same-team lovers just win with their team', () => {
    let s = game(['werewolf', 'cupid', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { cupidTargets: ['p2', 'p3'] }));
    s = rules.moderatorEliminate(rules.startDay(s), 'p0');
    expect(s.winner?.team).toBe('village');
    expect(s.winner?.winnerIds).toContain('p2');
  });

  it('blocks every other win while a mixed couple lives, and leaves the lovers out of their old teams', () => {
    // Wolf lover + villager lover + one more of each: parity would normally hand the wolves the game.
    let s = game(['werewolf', 'werewolf', 'villager', 'villager', 'cupid', 'villager']);
    s = rules.resolveNight(withActions(s, { cupidTargets: ['p0', 'p2'] }));
    s = rules.moderatorEliminate(rules.moderatorEliminate(rules.startDay(s), 'p4'), 'p5');
    expect(s.winner).toBeNull();
    // Once the couple falls (one wolf against one villager, play goes on) and the villager is
    // gone, the wolves win — without the dead wolf lover.
    s = rules.moderatorEliminate(s, 'p2');
    expect(s.winner).toBeNull();
    s = rules.moderatorEliminate(s, 'p3');
    expect(s.winner?.team).toBe('werewolf');
    expect(s.winner?.winnerIds).toEqual(['p1']);
  });
});

describe('accusations', () => {
  it('records several accusers, ignoring the accused and duplicates', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'seer', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p0', ['p1', 'p2', 'p2', 'p0']);
    expect(s.nominations[0].accuserIds).toEqual(['p1', 'p2']);
    // No line per accuser: the accusation is logged once it ends.
    expect(s.log.some((e) => e.key.startsWith('log.nominated'))).toBe(false);
    const executed = rules.executeNomination(s, s.nominations[0].id).log.find((e) => e.key === 'log.eliminated.voteAccused')!;
    expect(executed.params?.accusers).toBe(2);
    expect(executed.people).toEqual([
      { name: 'P1', role: 'seer' },
      { name: 'P2', role: 'villager' },
    ]);
  });

  it('logs withdrawn and dropped accusations once, and plain wording without accusers', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'seer', 'villager', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p2', ['p1']);
    s = rules.removeNomination(s, s.nominations[0].id);
    expect(s.log.at(-1)).toMatchObject({ key: 'log.accusationWithdrawnAccused', people: [{ name: 'P1', role: 'seer' }] });
    s = rules.nominate(s, 'p3', []);
    s = rules.closeDayWithoutExecution(s);
    expect(s.log.slice(-2).map((e) => e.key)).toEqual(['log.accusationWithdrawn', 'log.noExecution']);
    expect(s.log.at(-2)?.people).toBeUndefined();
  });
});

describe('one nomination per day', () => {
  it('refuses a second nomination until the first is withdrawn', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'seer', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p0', []);
    expect(rules.canNominate(s)).toBe(false);
    expect(rules.nominate(s, 'p1', []).nominations.map((n) => n.accusedId)).toEqual(['p0']);
    s = rules.removeNomination(s, s.nominations[0].id);
    s = rules.nominate(s, 'p1', []);
    expect(s.nominations.map((n) => n.accusedId)).toEqual(['p1']);
  });
});

describe('v1.0.0 night order', () => {
  it('calls setup → transformations → Hooker / Bodyguard → Vampires → wolves → Minion / Sorceress → the rest', () => {
    const s = game(['cupid', 'witch', 'seer', 'sorceress', 'minion', 'werewolf', 'vampire', 'bodyguard', 'hooker', 'villager']);
    const steps = rules.buildNightSteps(s);
    expect(steps.map((x) => x.action)).toEqual([
      'cupidLink',
      'hookerSeduce',
      'bodyguardProtect',
      'vampireBite',
      'wolfKill',
      'minionMeet',
      'sorceressInspect',
      'seerInspect',
      'witchPotion',
    ]);
    expect(steps.map((x) => x.group)).toEqual([1, 3, 3, 4, 4, 4, 4, 5, 5]);
  });

  it('wakes the bitten Cursed and the Doppelgänger who took a role on the next night only', () => {
    let s = game(['werewolf', 'cursed', 'doppelganger', 'seer', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { wolfTargets: ['p1'], doppelgangerTarget: 'p3' }));
    s = rules.moderatorEliminate(rules.startDay(s), 'p3');
    expect(s.players[2].roleId).toBe('seer');
    s = rules.startNight(s);
    const steps = rules.buildNightSteps(s);
    expect(steps.slice(0, 2).map((x) => [x.action, x.actors])).toEqual([
      ['cursedAwaken', ['p1']],
      ['doppelgangerAwaken', ['p2']],
    ]);
    expect(steps[0].group).toBe(2);
    s = rules.startNight(rules.startDay(rules.resolveNight(s)));
    expect(rules.buildNightSteps(s).some((x) => x.action === 'cursedAwaken' || x.action === 'doppelgangerAwaken')).toBe(false);
  });
});

describe('the Hooker', () => {
  it('is a +7 Village role of intermediate difficulty', () => {
    expect(ROLES.hooker).toMatchObject({ faction: 'village', weight: 7, difficulty: 2, nightAction: 'hookerSeduce' });
  });

  it('cancels a seduced Bodyguard’s protection', () => {
    const s = game(['werewolf', 'hooker', 'bodyguard', 'villager', 'villager', 'villager']);
    const after = rules.resolveNight(withActions(s, { hookerTarget: 'p2', bodyguardTarget: 'p3', wolfTargets: ['p3'] }));
    expect(alive(after, 'p3')).toBe(false);
  });

  it('saves the wolves’ victim when a Werewolf is seduced — but not when it is the Fruit Brute', () => {
    const s = game(['werewolf', 'fruitBrute', 'hooker', 'villager', 'villager', 'villager', 'villager']);
    expect(alive(rules.resolveNight(withActions(s, { hookerTarget: 'p0', wolfTargets: ['p3'] })), 'p3')).toBe(true);
    expect(alive(rules.resolveNight(withActions(s, { hookerTarget: 'p1', wolfTargets: ['p3'] })), 'p3')).toBe(false);
  });

  it('gives a seduced Seer the opposite answer', () => {
    const s = withActions(game(['werewolf', 'hooker', 'seer', 'villager', 'villager']), { hookerTarget: 'p2' });
    expect(rules.inspectionResult(s, 'seerInspect', 'p3')).toBe(true); // a Villager shows as a Werewolf
    expect(rules.inspectionResult(s, 'seerInspect', 'p0')).toBe(false);
  });

  it('wastes a seduced Witch’s potions', () => {
    const s = game(['werewolf', 'hooker', 'witch', 'villager', 'villager', 'villager']);
    const after = rules.resolveNight(withActions(s, { hookerTarget: 'p2', wolfTargets: ['p3'], witchSaveTarget: 'p3', witchKillTarget: 'p4' }));
    expect(alive(after, 'p3')).toBe(false);
    expect(alive(after, 'p4')).toBe(true);
    expect(after.modifiers.witchHealUsed && after.modifiers.witchKillUsed).toBe(true);
  });

  it('can seduce each player only once per game', () => {
    let s = game(['werewolf', 'hooker', 'seer', 'villager', 'villager', 'villager']);
    s = rules.startNight(rules.startDay(rules.resolveNight(withActions(s, { hookerTarget: 'p2' }))));
    const step = rules.buildNightSteps(s).find((x) => x.action === 'hookerSeduce')!;
    expect(rules.eligibleTargets(s, step).map((p) => p.id)).toEqual(['p0', 'p3', 'p4', 'p5']);
  });
});

describe('protection', () => {
  it('lets the Witch’s poison through the Bodyguard’s shield', () => {
    const s = game(['werewolf', 'bodyguard', 'witch', 'villager', 'villager', 'villager']);
    expect(alive(rules.resolveNight(withActions(s, { bodyguardTarget: 'p3', witchKillTarget: 'p3' })), 'p3')).toBe(false);
  });

  it('breaks a protected lover’s heart when the other lover dies', () => {
    let s = game(['werewolf', 'cupid', 'bodyguard', 'witch', 'villager', 'villager', 'villager']);
    s = rules.startNight(rules.startDay(rules.resolveNight(withActions(s, { cupidTargets: ['p4', 'p5'] }))));
    s = rules.resolveNight(withActions(s, { wolfTargets: ['p4'], bodyguardTarget: 'p4', witchKillTarget: 'p5' }));
    expect(s.players[4].eliminated?.cause).toBe('heartbreak');
    expect(alive(s, 'p5')).toBe(false);
  });
});

describe('recommended rebalances', () => {
  it('only adds the house-rule steps when the game was dealt with them', () => {
    const deck: RoleId[] = ['bigBadWolf', 'werewolf', 'hunter', 'villager', 'villager', 'villager', 'villager', 'villager'];
    expect(rules.buildNightSteps(game(deck)).map((x) => x.action)).toEqual(['wolfKill']);
    expect(rules.buildNightSteps(game(deck, { hunter: true, bigBadWolf: true })).map((x) => x.action)).toEqual([
      'wolfKill',
      'bigBadWolfStrike',
      'hunterLink',
    ]);
  });

  it('Hunter: the night link replaces the revenge shot, and a seduced Hunter’s link fails', () => {
    const deck: RoleId[] = ['werewolf', 'hunter', 'hooker', 'villager', 'villager', 'villager'];
    const s = game(deck, { hunter: true });
    const linked = rules.resolveNight(withActions(s, { hunterTarget: 'p3', wolfTargets: ['p1'] }));
    expect(linked.players[3].eliminated?.cause).toBe('linked');
    expect(linked.pendingTriggers).toEqual([]);
    const seduced = rules.resolveNight(withActions(s, { hunterTarget: 'p3', wolfTargets: ['p1'], hookerTarget: 'p1' }));
    expect(alive(seduced, 'p3')).toBe(true);
    expect(seduced.pendingTriggers).toEqual([]);
    // Dying by day under the house rule takes no one.
    const voted = rules.startDay(rules.resolveNight(s));
    expect(rules.executeNomination(rules.nominate(voted, 'p1', []), rules.nominate(voted, 'p1', []).nominations[0].id).pendingTriggers).toEqual([]);
    // Standard rules keep the shot.
    expect(rules.resolveNight(withActions(game(deck), { wolfTargets: ['p1'] })).pendingTriggers).toHaveLength(1);
  });

  it('Witch: stops seeing the victim once the heal is used', () => {
    let s = game(['werewolf', 'witch', 'villager', 'villager', 'villager', 'villager'], { witch: true });
    expect(rules.witchSeesVictims(s)).toBe(true);
    s = rules.startNight(rules.startDay(rules.resolveNight(withActions(s, { wolfTargets: ['p2'], witchSaveTarget: 'p2' }))));
    expect(rules.witchSeesVictims(s)).toBe(false);
    expect(rules.witchSeesVictims({ ...s, rules: NO_REBALANCES })).toBe(true);
  });

  it('Big Bad Wolf: strikes a neighbour of the first victim on its own turn', () => {
    const s = withActions(game(['bigBadWolf', 'werewolf', 'hooker', 'villager', 'villager', 'villager', 'villager', 'villager'], { bigBadWolf: true }), {
      wolfTargets: ['p4'],
    });
    const pack = rules.buildNightSteps(s).find((x) => x.action === 'wolfKill')!;
    expect(pack.targetCount).toBe(1);
    const strike = rules.buildNightSteps(s).find((x) => x.action === 'bigBadWolfStrike')!;
    expect(rules.eligibleTargets(s, strike).map((p) => p.id).sort()).toEqual(['p3', 'p5']);
    const both = rules.resolveNight(withActions(s, { bigBadWolfTarget: 'p5' }));
    expect([alive(both, 'p4'), alive(both, 'p5')]).toEqual([false, false]);
    // Seducing the Big Bad Wolf saves both; seducing another wolf saves only the first.
    const bbwSeduced = rules.resolveNight(withActions(s, { bigBadWolfTarget: 'p5', hookerTarget: 'p0' }));
    expect([alive(bbwSeduced, 'p4'), alive(bbwSeduced, 'p5')]).toEqual([true, true]);
    const packSeduced = rules.resolveNight(withActions(s, { bigBadWolfTarget: 'p5', hookerTarget: 'p1' }));
    expect([alive(packSeduced, 'p4'), alive(packSeduced, 'p5')]).toEqual([true, false]);
  });

  it('Tanner: joins the Village and drags down whoever targets them at night', () => {
    const deck: RoleId[] = ['werewolf', 'wolfCub', 'tanner', 'seer', 'bodyguard', 'villager', 'villager', 'villager'];
    // The strongest wolf (Wolf Cub, −8) dies with the Tanner, through the Bodyguard's shield.
    const attacked = rules.resolveNight(withActions(game(deck, { tanner: true }), { wolfTargets: ['p2'], bodyguardTarget: 'p2' }));
    expect(['p0', 'p1', 'p2', 'p4'].map((id) => alive(attacked, id))).toEqual([true, false, false, false]);
    expect(attacked.players[1].eliminated?.cause).toBe('tanner');
    const inspected = rules.resolveNight(withActions(game(deck, { tanner: true }), { seerTarget: 'p2' }));
    expect([alive(inspected, 'p2'), alive(inspected, 'p3')]).toEqual([false, false]);
    // A seduced power still reaches the Tanner: the seduced Bodyguard dies with them.
    const seduced = rules.resolveNight(
      withActions(game([...deck.slice(0, 7), 'hooker'], { tanner: true }), { hookerTarget: 'p4', bodyguardTarget: 'p2' }),
    );
    expect(['p2', 'p4', 'p7'].map((id) => alive(seduced, id))).toEqual([false, false, true]);
    // Eliminated by vote, the reworked Tanner simply dies: no Tanner win.
    let voted = rules.startDay(rules.resolveNight(game(deck, { tanner: true })));
    voted = rules.executeNomination(rules.nominate(voted, 'p2', []), rules.nominate(voted, 'p2', []).nominations[0].id);
    expect(voted.winner).toBeNull();
    const wolvesGone = voted.players.map((p) => (p.id === 'p0' || p.id === 'p1' ? { ...p, alive: false } : p));
    expect(rules.evaluateWinner({ players: wolvesGone, rules: { ...NO_REBALANCES, tanner: true } })?.winnerIds).toContain('p2');
  });
});

describe('v1.0.1 win conditions', () => {
  /** A game where only the listed seats are still alive. */
  const leaving = (roles: RoleId[], living: number[], patch: Partial<GameState> = {}): GameState => {
    const s = game(roles);
    return { ...s, ...patch, players: s.players.map((p) => ({ ...p, alive: living.includes(p.seat) })) };
  };
  const winner = (s: GameState) => rules.evaluateWinner(s);

  it('ends when only one team is left', () => {
    expect(winner(leaving(['werewolf', 'minion', 'villager', 'villager', 'villager'], [0, 1]))?.team).toBe('werewolf');
    expect(winner(leaving(['werewolf', 'seer', 'villager', 'villager', 'villager'], [1, 2]))?.team).toBe('village');
  });

  it('plays on with three teams, or two without the Village', () => {
    expect(winner(leaving(['werewolf', 'vampire', 'villager', 'villager', 'villager'], [0, 1, 2]))).toBeNull();
    expect(winner(leaving(['werewolf', 'vampire', 'villager', 'villager', 'villager'], [0, 1]))).toBeNull();
  });

  it('Village vs one team: outnumbered with no kill loses, a kill power keeps it alive, a frozen tie is a draw', () => {
    // A Fruit Brute can't kill either: 1 against 1 is a draw, 1 against 2 a loss.
    expect(winner(leaving(['fruitBrute', 'villager', 'villager', 'werewolf', 'villager'], [0, 1]))).toEqual({ team: 'draw', winnerIds: [] });
    expect(winner(leaving(['fruitBrute', 'werewolf', 'villager', 'villager', 'villager'], [0, 1, 2]))?.team).toBe('werewolf');
    // The Witch still holds her poison: the Village plays on, even outnumbered.
    expect(winner(leaving(['werewolf', 'werewolf', 'witch', 'villager', 'villager'], [0, 1, 2]))).toBeNull();
    expect(winner(leaving(['fruitBrute', 'witch', 'villager', 'werewolf', 'villager'], [0, 1]))).toBeNull();
    // Used up, she doesn't count.
    const spent = leaving(['werewolf', 'werewolf', 'witch', 'villager', 'villager'], [0, 1, 2]);
    expect(winner({ ...spent, modifiers: { ...spent.modifiers, witchKillUsed: true } })?.team).toBe('werewolf');
  });

  it('keeps a Lone Wolf without its pack hunting until it is the last one alive', () => {
    expect(winner(leaving(['loneWolf', 'minion', 'villager', 'werewolf', 'villager'], [0, 1, 2]))).toBeNull();
  });

  it('lets the Couple win against a smaller Village, and never lets a standard Tanner hold the game open', () => {
    let s = game(['werewolf', 'cupid', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { cupidTargets: ['p0', 'p2'] }));
    expect(winner({ ...s, players: s.players.map((p) => ({ ...p, alive: ['p0', 'p2', 'p3'].includes(p.id) })) })?.team).toBe('couple');
    expect(winner(leaving(['werewolf', 'tanner', 'villager', 'villager', 'villager'], [1, 2]))?.team).toBe('village');
  });

  it('counts only the Cult Leader as the Cult, whose recruiting keeps the game going', () => {
    expect(winner(leaving(['werewolf', 'cultLeader', 'villager', 'villager', 'villager'], [1, 2]))).toBeNull();
  });
});

describe('v1.0.1 Big Bad Wolf & Priest', () => {
  const house = { bigBadWolf: true };
  const deck: RoleId[] = ['bigBadWolf', 'werewolf', 'witch', 'villager', 'villager', 'villager', 'villager', 'villager'];

  it('hides the Big Bad Wolf’s strike from the Witch, and her heal can’t stop it', () => {
    const s = withActions(game(deck, house), { wolfTargets: ['p4'], bigBadWolfTarget: 'p5' });
    expect(rules.witchVictims(s)).toEqual(['p4']);
    const witch = rules.buildNightSteps(s).find((x) => x.action === 'witchPotion')!;
    expect(rules.eligibleTargets(s, witch, 'save').map((p) => p.id)).toEqual(['p4']);
    const after = rules.resolveNight(withActions(s, { witchSaveTarget: 'p5' }));
    expect(alive(after, 'p5')).toBe(false);
  });

  it('lets the Big Bad Wolf strike anyone next to the victim but himself — even a wolf', () => {
    const s = withActions(game(deck, house), { wolfTargets: ['p2'] });
    const strike = rules.buildNightSteps(s).find((x) => x.action === 'bigBadWolfStrike')!;
    expect(rules.eligibleTargets(s, strike).map((p) => p.id).sort()).toEqual(['p1', 'p3']);
    const nextToHim = withActions(game(deck, house), { wolfTargets: ['p7'] });
    expect(rules.eligibleTargets(nextToHim, strike).map((p) => p.id)).toEqual(['p6']);
  });

  it('lets the Priest’s blessing stop the Witch’s poison and the Hunter’s aim, but not the Bodyguard’s', () => {
    const s = game(['werewolf', 'priest', 'witch', 'bodyguard', 'villager', 'villager', 'villager'], {});
    expect(alive(rules.resolveNight(withActions(s, { priestTarget: 'p4', witchKillTarget: 'p4' })), 'p4')).toBe(true);
    expect(alive(rules.resolveNight(withActions(s, { bodyguardTarget: 'p4', witchKillTarget: 'p4' })), 'p4')).toBe(false);
    const hunt = game(['werewolf', 'priest', 'hunter', 'villager', 'villager', 'villager'], { hunter: true });
    const after = rules.resolveNight(withActions(hunt, { priestTarget: 'p3', hunterTarget: 'p3', wolfTargets: ['p2'] }));
    expect([alive(after, 'p2'), alive(after, 'p3')]).toEqual([false, true]);
  });
});

describe('v1.0.1 team limit', () => {
  it('allows Village, Werewolves and one extra team', () => {
    const base: RoleId[] = ['werewolf', 'werewolf', 'seer', 'villager', 'villager', 'villager'];
    const issues = (extra: RoleId[], house = {}) => validateDeck([...base, ...extra], base.length + extra.length, house).map((i) => i.key);
    expect(issues(['cupid'])).not.toContain('issue.tooManyTeams');
    expect(issues(['vampire', 'vampire'])).not.toContain('issue.tooManyTeams');
    expect(issues(['cupid', 'vampire'])).toContain('issue.tooManyTeams');
    expect(issues(['tanner', 'cultLeader'])).toContain('issue.tooManyTeams');
    // The Lone Wolf sides with the Werewolves; the reworked Tanner is a Villager.
    expect(issues(['loneWolf', 'cupid'])).not.toContain('issue.tooManyTeams');
    expect(issues(['tanner', 'cultLeader'], { tanner: true })).not.toContain('issue.tooManyTeams');
  });

  it('locks roles that would bring a fourth team, and auto-balance never deals one', () => {
    expect(addsTeam(['cupid'], 'vampire')).toBe(true);
    expect(addsTeam(['vampire'], 'vampire')).toBe(false);
    expect(addsTeam([], 'vampire')).toBe(false);
    const pool: RoleId[] = ['seer', 'cupid', 'vampire', 'cultLeader', 'tanner', 'witch', 'bodyguard', 'hunter'];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const deck = generateBalancedDeck({ playerCount: 10, pool, experience: 'veteran', random: seeded(seed) });
      expect(extraTeams(deck).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('house-rule snapshot & setup', () => {
  it('freezes the house rules when the cards are dealt', () => {
    const players = game(['werewolf', 'seer', 'villager', 'villager', 'villager']).players;
    const dealt = gameReducer(createInitialState(), { type: 'START_GAME', players, rules: { ...NO_REBALANCES, witch: true } });
    expect(dealt.rules).toEqual({ ...NO_REBALANCES, witch: true });
    // Games saved before house rules existed load with the standard rules.
    expect(normalizeGameState({ ...dealt, rules: undefined } as unknown as GameState).rules).toEqual(NO_REBALANCES);
  });

  it('describes a rebalanced role with its rebalanced card text', () => {
    const on = { ...NO_REBALANCES, hunter: true, tanner: true };
    expect(roleDescKey('hunter', on)).toBe('role.hunter.descRebalanced');
    expect(roleDescKey('tanner', on)).toBe('role.tanner.descRebalanced');
    expect(roleDescKey('witch', on)).toBe('role.witch.desc');
    expect(roleDescKey('seer', on)).toBe('role.seer.desc');
    for (const lang of ['en', 'vi'] as const) {
      for (const id of ['hunter', 'witch', 'bigBadWolf', 'tanner'] as const) {
        expect(dictionaries[lang][roleDescKey(id, { ...NO_REBALANCES, [id]: true })]).toBeTruthy();
      }
    }
  });

  it('keeps the table’s names and experience for the next new game', () => {
    let s = gameReducer(createInitialState(), { type: 'UPDATE_SETUP', patch: { names: ['An', '', 'Binh', 'Chi', 'Dung'], experience: 'veteran' } });
    s = gameReducer(s, { type: 'START_GAME', players: game(['werewolf', 'villager', 'villager', 'villager', 'villager']).players, rules: NO_REBALANCES });
    const next = gameReducer(s, { type: 'NEW_GAME' });
    expect(next.phase).toBe('setup');
    expect(next.setup.names).toEqual(['An', '', 'Binh', 'Chi', 'Dung']);
    expect(next.setup.experience).toBe('veteran');
    expect(next.setup.deck).toEqual([]);
  });

  it('splits timeline lines around role and team names, so they can be coloured', () => {
    const dict: Record<string, string> = {
      'log.nominatedBy': '{actor} ({actorRole}) accused {name} ({role})',
      'log.gameOver': 'Game over — {team}',
      'role.seer.name': 'Seer',
      'role.werewolf.name': 'Werewolf',
      'team.village': 'Village',
    };
    const tx = (key: string) => dict[key] ?? key;
    const entry = { id: 'l', round: 1, phase: 'day' as const, key: 'log.nominatedBy', params: { actor: 'An', actorRole: 'seer', name: 'Binh', role: 'werewolf' } };
    expect(timelineParts(entry, tx)).toEqual([
      { text: 'An (' },
      { text: 'Seer', role: 'seer' },
      { text: ') accused Binh (' },
      { text: 'Werewolf', role: 'werewolf' },
      { text: ')' },
    ]);
    expect(timelineParts({ ...entry, key: 'log.gameOver', params: { team: 'village' } }, tx)).toEqual([
      { text: 'Game over — ' },
      { text: 'Village', team: 'village' },
    ]);
  });

  it('empties the Deck step when the Role Pool changes', () => {
    let s = gameReducer(createInitialState(), { type: 'UPDATE_SETUP', patch: { pool: ['villager', 'werewolf', 'seer'], deck: ['seer', 'werewolf', 'villager'] } });
    s = gameReducer(s, { type: 'UPDATE_SETUP', patch: { pool: ['werewolf', 'seer', 'villager'] } });
    expect(s.setup.deck).toHaveLength(3); // same roles, another order: kept
    s = gameReducer(s, { type: 'UPDATE_SETUP', patch: { pool: ['villager', 'werewolf', 'witch'] } });
    expect(s.setup.deck).toEqual([]);
    expect(s.setup.deal).toBeNull();
  });

});

describe('role pools', () => {
  it('groups roles into Village / Wolves / Other, easiest first, then by weight', () => {
    expect(ROLE_SECTIONS.map((sec) => sec.id)).toEqual(['village', 'wolves', 'other']);
    expect(ROLE_SECTIONS.flatMap((sec) => sec.roles)).toHaveLength(Object.keys(ROLES).length);
    for (const sec of ROLE_SECTIONS) {
      for (let i = 1; i < sec.roles.length; i++) {
        const [a, b] = [ROLES[sec.roles[i - 1]], ROLES[sec.roles[i]]];
        expect(a.difficulty < b.difficulty || (a.difficulty === b.difficulty && a.weight <= b.weight)).toBe(true);
      }
    }
    expect(ROLE_SECTIONS[1].roles).toContain('minion');
    expect(ROLE_SECTIONS[2].roles).toEqual(expect.arrayContaining(['tanner', 'vampire', 'cultLeader']));
  });

  it('always keeps Villager and Werewolf in a pool', () => {
    expect(withFillers(['seer'])).toEqual(['villager', 'seer', 'werewolf']);
    expect(withFillers([])).toEqual(['villager', 'werewolf']);
  });

  it('keeps auto-balanced Villagers strictly under half the table', () => {
    expect(maxAutoVillagers(10)).toBe(4);
    expect(maxAutoVillagers(5)).toBe(2);
    const pool: RoleId[] = ['seer', 'bodyguard', 'hunter', 'witch', 'prince', 'mayor', 'priest', 'lycan', 'cursed', 'wolfCub', 'diseased'];
    for (const n of [5, 8, 10, 13]) {
      for (const seed of [1, 2, 3]) {
        const deck = generateBalancedDeck({ playerCount: n, pool, experience: 'standard', random: seeded(seed * 31 + n) });
        expect(deck.filter((r) => r === 'villager').length).toBeLessThan(n / 2);
      }
    }
  });
});
