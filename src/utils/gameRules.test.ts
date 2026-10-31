import { describe, expect, it } from 'vitest';
import { NO_REBALANCES, type GameState, type Player, type RebalanceRules, type RoleId } from '../@types/game';
import { createInitialState, gameReducer, normalizeGameState } from '../context/GameContext';
import { isRebalanced, roleDescKey } from '../context/HouseRulesContext';
import { dictionaries } from '../i18n/translations';
import { ROLE_SECTIONS, ROLES, withFillers } from '../data/roles';
import { applyStatsDelta, EMPTY_STATS, statsDelta } from '../services/profileStore';
import {
  addsTeam,
  AUTO_BALANCE_TOLERANCE,
  timelineParts,
  calculateBalance,
  deckChanges,
  deckMixGaps,
  duplicateNames,
  extraTeams,
  EMPTY_STATUS,
  EXPERIENCE_TARGET,
  formatTimelineEntry,
  generateBalancedDeck,
  insertSeat,
  maxAutoVillagers,
  minDeckChanges,
  groupTimeline,
  dealComplete,
  emptyDeal,
  moveCard,
  swapSeats,
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
    expect(Math.abs(calculateBalance(deck) - EXPERIENCE_TARGET.standard)).toBeLessThanOrEqual(AUTO_BALANCE_TOLERANCE);
    expect(deck.every((id) => id === 'villager' || id === 'werewolf' || pool.includes(id))).toBe(true);
  });
});

describe('auto-balance deck mix', () => {
  it('reports which tier slots a deck leaves empty', () => {
    // Tier 1: Villager, Werewolf. Tier 2: every night, night 1 only, no night call.
    // Tier 3: wolf-team special, kill, protect, info.
    expect(deckMixGaps(['werewolf', 'werewolf', 'seer', 'villager', 'villager'])).toEqual([0, 2, 3]);
    expect(deckMixGaps(['werewolf', 'seer', 'mason', 'mason', 'hunter'])).toEqual([1, 0, 2]);
    expect(deckMixGaps(['villager', 'wolfCub', 'witch', 'cupid', 'prince'])).toEqual([1, 0, 1]);
    // The reworked Tanner can kill; the standard one can't.
    expect(deckMixGaps(['tanner'])[2]).toBe(4);
    expect(deckMixGaps(['tanner'], { tanner: true })[2]).toBe(3);
  });

  it('fills every tier the pool allows', () => {
    const pool: RoleId[] = ['seer', 'bodyguard', 'hunter', 'witch', 'prince', 'mayor', 'mason', 'cupid', 'lycan', 'cursed', 'wolfCub', 'sorceress', 'minion'];
    for (const n of [6, 8, 10, 12, 16]) {
      for (const seed of [1, 2, 3, 4]) {
        const deck = generateBalancedDeck({ playerCount: n, pool, experience: 'standard', random: seeded(seed * 17 + n) });
        expect(deckMixGaps(deck)).toEqual([0, 0, 0]);
        expect(validateDeck(deck, n)).toEqual([]);
        expect(Math.abs(calculateBalance(deck) - EXPERIENCE_TARGET.standard)).toBeLessThanOrEqual(AUTO_BALANCE_TOLERANCE);
      }
    }
  });

  it('keeps at least one Villager even when the pool could fill every seat', () => {
    const pool = (Object.keys(ROLES) as RoleId[]).filter((id) => ROLES[id].difficulty === 1);
    for (const seed of [1, 2, 3]) {
      const deck = generateBalancedDeck({ playerCount: 8, pool, experience: 'beginner', random: seeded(seed) });
      expect(deck).toContain('villager');
      expect(deck).toContain('werewolf');
    }
  });

  it('skips slots the pool cannot fill', () => {
    // No first-night role, no wolf-team special: those slots stay empty, the rest fill.
    const pool: RoleId[] = ['seer', 'bodyguard', 'hunter', 'prince', 'lycan', 'cursed'];
    const deck = generateBalancedDeck({ playerCount: 7, pool, experience: 'standard', random: seeded(9) });
    expect(deckMixGaps(deck)).toEqual([0, 1, 1]);
    expect(validateDeck(deck, 7)).toEqual([]);
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
    s = rules.nominate(s, 'p1');
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
  it('reveals the Prince as soon as he is nominated, with no vote, and ends the day', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'prince', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p1');
    expect(s.nominations).toEqual([]);
    expect(alive(s, 'p1')).toBe(true);
    expect(s.players[1].status.princeRevealed).toBe(true);
    expect(s.log.at(-1)).toMatchObject({ key: 'log.princeNominated', params: { name: 'P1', role: 'prince' } });
    expect(s.log.at(-1)?.people).toBeUndefined();
    // The reveal uses up the day's elimination.
    expect([s.dayStep, s.executedToday, s.executionsLeft]).toEqual(['closed', 'p1', 0]);
    expect(rules.canNominate(s)).toBe(false);
    // Revealed, he faces a normal vote on a later day.
    s = rules.startDay(rules.resolveNight(rules.startNight(s)));
    s = rules.nominate(s, 'p1');
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(alive(s, 'p1')).toBe(false);
  });

  it('leaves the second elimination of a Troublemaker day after the Prince is revealed', () => {
    let s = game(['werewolf', 'troublemaker', 'prince', 'villager', 'villager', 'villager', 'villager']);
    s = rules.startDay(rules.resolveNight(withActions(s, { troublemakerActor: 'p1' })));
    s = rules.nominate(s, 'p2');
    expect([s.dayStep, s.executionsLeft, rules.canNominate(s)]).toEqual(['voting', 1, true]);
  });

  it('collects the Vampire victim on the first accusation', () => {
    let s = game(['werewolf', 'vampire', 'villager', 'villager', 'villager', 'villager', 'villager']);
    s = rules.startDay(rules.resolveNight(withActions(s, { vampireTarget: 'p2' })));
    expect(alive(s, 'p2')).toBe(true);
    s = rules.nominate(s, 'p3');
    expect(alive(s, 'p2')).toBe(false);
  });

  it('declares a werewolf win once a Village with no kill left can’t outvote them — parity included', () => {
    let s = game(['werewolf', 'werewolf', 'villager', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { wolfTargets: ['p2'] }));
    expect(s.winner).toBeNull(); // 2 votes against 3: play on
    s = rules.resolveNight(withActions(rules.startNight(rules.startDay(s)), { wolfTargets: ['p3'] }));
    expect(s.phase).toBe('gameOver');
    expect(s.winner?.team).toBe('werewolf'); // 2 against 2
  });

  it('lets the Lone Wolf win as the last survivor, or against one last Villager who can’t fight back', () => {
    const base = game(['loneWolf', 'werewolf', 'villager', 'villager']);
    const players = base.players.map((p) => (p.id === 'p1' ? { ...p, alive: false } : p));
    expect(rules.evaluateWinner({ players })).toBeNull();
    const lastVillager = players.map((p) => (p.id === 'p3' ? { ...p, alive: false } : p));
    expect(rules.evaluateWinner({ players: lastVillager })).toEqual({ team: 'loneWolf', winnerIds: ['p0'] });
    expect(rules.evaluateWinner({ players: lastVillager.map((p) => (p.id === 'p2' ? { ...p, alive: false } : p)) })?.team).toBe('loneWolf');
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
    s = rules.nominate(s, 'p0');
    s = rules.setVoters(s, s.nominations[0].id, ['p0', 'p1', 'p2', 'p2']);
    expect(s.nominations[0].voters).toEqual(['p1', 'p2']);
  });

  it('writes a chronological timeline naming player and role', () => {
    let s = game(['werewolf', 'seer', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { wolfTargets: ['p2'], seerTarget: 'p0' }));
    s = rules.startDay(s);
    s = rules.nominate(s, 'p0');
    // P2 was killed in the night, so can't vote.
    s = rules.setVoters(s, s.nominations[0].id, ['p1', 'p2', 'p3']);
    s = rules.executeNomination(s, s.nominations[0].id);
    const tx = (key: string, params?: Record<string, string | number>) =>
      key + (params ? ' ' + Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' ') : '');
    const groups = groupTimeline(s.log, tx);
    expect(groups.map((g) => g.label)).toEqual(['phase.nightN round=1', 'phase.dayN round=1', 'phase.gameOver']);
    // One line for the vote, carrying its voters.
    const vote = s.log.find((e) => e.key === 'log.eliminated.voteVoted')!;
    expect(formatTimelineEntry(vote, tx)).toContain('name=P0 role=role.werewolf.name');
    expect(vote.people).toEqual([
      { name: 'P1', role: 'seer' },
      { name: 'P3', role: 'villager' },
    ]);
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
    s = rules.nominate(s, 'p1');
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

  it('asks the Leprechaun for a direction, never showing them a player', () => {
    const s = withActions(game(['werewolf', 'villager', 'leprechaun', 'villager', 'villager']), { wolfTargets: ['p1'] });
    const step = rules.buildNightSteps(s).find((x) => x.action === 'leprechaunRedirect')!;
    expect([step.kind, step.targetCount]).toEqual(['direction', 1]);
    expect(rules.eligibleTargets(s, step)).toEqual([]);
  });

  it('calls the Lovers right after Cupid on night 1 only', () => {
    let s = game(['werewolf', 'cupid', 'villager', 'villager', 'villager']);
    expect(rules.buildNightSteps(s).slice(0, 2).map((x) => [x.action, x.group])).toEqual([
      ['cupidLink', 1],
      ['loversMeet', 1],
    ]);
    s = rules.startNight(rules.startDay(rules.resolveNight(withActions(s, { cupidTargets: ['p2', 'p3'] }))));
    expect(rules.buildNightSteps(s).some((x) => x.action === 'loversMeet')).toBe(false);
  });

  it('moves the attack one seat left (clockwise) or right (counter-clockwise), and the Witch sees the real victim', () => {
    const s = withActions(game(['werewolf', 'leprechaun', 'villager', 'villager', 'witch']), { wolfTargets: ['p2'] });
    const left = withActions(s, { leprechaunMove: 'left' });
    expect(rules.effectiveWolfTargets(left)).toEqual(['p3']);
    expect(rules.effectiveWolfTargets(withActions(s, { leprechaunMove: 'right' }))).toEqual(['p1']);
    expect(rules.effectiveWolfTargets(s)).toEqual(['p2']);
    expect(rules.witchVictims(left)).toEqual(['p3']);
    // Round the table (the last seat's left is seat 1, even a wolf: it's blind luck), past the dead.
    expect(rules.effectiveWolfTargets(withActions(left, { wolfTargets: ['p4'] }))).toEqual(['p0']);
    expect(rules.effectiveWolfTargets(rules.moderatorEliminate(left, 'p3'))).toEqual(['p4']);
    const after = rules.resolveNight(left);
    expect([alive(after, 'p2'), alive(after, 'p3')]).toEqual([true, false]);
    expect(after.log.some((e) => e.key === 'log.night.leprechaunLeft' && e.params?.name === 'P3')).toBe(true);
    // Moving with no attack to move does nothing, and the timeline says so.
    const idle = rules.resolveNight(withActions(s, { wolfTargets: [], leprechaunMove: 'right' }));
    expect(idle.log.some((e) => e.key === 'log.night.leprechaunRightNothing')).toBe(true);
  });

  it('kills the Leprechaun with the reworked Tanner when the blind move lands on them', () => {
    const s = withActions(game(['werewolf', 'leprechaun', 'villager', 'tanner', 'villager', 'villager', 'villager'], { tanner: true }), {
      wolfTargets: ['p2'],
      leprechaunMove: 'left',
    });
    const after = rules.resolveNight(s);
    // The Tanner, the Leprechaun and the pack's strongest wolf; the first victim is spared.
    expect(['p3', 'p1', 'p0', 'p2'].map((id) => alive(after, id))).toEqual([false, false, false, true]);
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
    s = rules.nominate(s, 'p0');
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
    s = rules.nominate(s, 'p2');
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(s.dayStep).toBe('voting');
    s = rules.nominate(s, 'p3');
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
    // Once the couple falls, one wolf is left against one villager who can't outvote it: the
    // wolves win — without the dead wolf lover.
    s = rules.moderatorEliminate(s, 'p2');
    expect(s.winner?.team).toBe('werewolf');
    expect(s.winner?.winnerIds).toEqual(['p1']);
  });
});

describe('accusations', () => {
  it('logs an execution once, with everyone who voted for it', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'seer', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p0');
    // No line when the accusation opens: it is logged once it ends.
    expect(s.log.some((e) => e.key.startsWith('log.nominated'))).toBe(false);
    s = rules.setVoters(s, s.nominations[0].id, ['p2', 'p1', 'p2', 'p0']);
    const executed = rules.executeNomination(s, s.nominations[0].id).log.find((e) => e.key === 'log.eliminated.voteVoted')!;
    expect(executed.params?.voters).toBe(2);
    expect(executed.people).toEqual([
      { name: 'P2', role: 'villager' },
      { name: 'P1', role: 'seer' },
    ]);
  });

  it('names the voters when someone who became the Prince while accused survives the vote', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'doppelganger', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p1');
    // e.g. a Doppelgänger whose target, a Prince, was taken by the moderator meanwhile.
    s = { ...s, players: s.players.map((p) => (p.id === 'p1' ? { ...p, roleId: 'prince' as const } : p)) };
    s = rules.setVoters(s, s.nominations[0].id, ['p0', 'p2', 'p3']);
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(alive(s, 'p1')).toBe(true);
    expect(s.log.at(-1)).toMatchObject({ key: 'log.princeRevealedVoted', params: { voters: 3 } });
    expect(s.log.at(-1)?.people).toHaveLength(3);
  });

  it('logs withdrawn and dropped accusations once, without voters', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'seer', 'villager', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p2');
    s = rules.setVoters(s, s.nominations[0].id, ['p1']);
    s = rules.removeNomination(s, s.nominations[0].id);
    expect(s.log.at(-1)?.key).toBe('log.accusationWithdrawn');
    expect(s.log.at(-1)?.people).toBeUndefined();
    s = rules.nominate(s, 'p3');
    s = rules.closeDayWithoutExecution(s);
    expect(s.log.slice(-2).map((e) => e.key)).toEqual(['log.accusationWithdrawn', 'log.noExecution']);
    expect(s.log.at(-2)?.people).toBeUndefined();
  });

  it('still renders accusers in timelines logged before v1.1.0', () => {
    const legacy = {
      id: 'l',
      round: 1,
      phase: 'day' as const,
      key: 'log.eliminated.voteAccused',
      params: { name: 'P0', role: 'werewolf', accusers: 2 },
      people: [
        { name: 'P1', role: 'seer' as const },
        { name: 'P2', role: 'villager' as const },
      ],
    };
    const tx = (key: string, params?: Record<string, string | number>) =>
      key === 'log.eliminated.voteAccused' ? '{name} ({role}) was executed by vote (accused by {accusers})' : key + (params?.count ?? '');
    const parts = timelineParts(legacy, tx);
    expect(parts.find((p) => p.people)).toMatchObject({ text: 'log.accusers2', peopleTitle: 'log.accusersTitle' });
  });
});

describe('fresh deaths', () => {
  it("marks last night's deaths at dawn, and only until the day starts", () => {
    let s = game(['werewolf', 'seer', 'villager', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { wolfTargets: ['p2'] }));
    expect(rules.freshDeaths(s)).toEqual({ phase: 'night', ids: new Set(['p2']) });
    s = rules.startDay(s);
    expect(rules.freshDeaths(s)).toBeNull();
  });

  it("marks today's deaths once the day is over, not last night's", () => {
    let s = game(['werewolf', 'seer', 'villager', 'villager', 'villager', 'villager', 'villager']);
    s = rules.startDay(rules.resolveNight(withActions(s, { wolfTargets: ['p2'] })));
    s = rules.nominate(s, 'p3');
    s = rules.setVoters(s, s.nominations[0].id, ['p0', 'p1', 'p4', 'p5']);
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(s.dayStep).toBe('closed');
    expect(rules.freshDeaths(s)).toEqual({ phase: 'day', ids: new Set(['p3']) });
  });
});

describe('the day is over', () => {
  it("names who the vote's victim took down with them, but not unrelated deaths", () => {
    let s = game(['werewolf', 'seer', 'villager', 'villager', 'villager', 'villager', 'villager']);
    s = rules.startDay(rules.resolveNight(withActions(s, { wolfTargets: ['p6'] })));
    s.players[2].status.lover = true;
    s.players[3].status.lover = true;
    // The moderator removes someone by hand: not part of the vote's fallout.
    s = rules.moderatorEliminate(s, 'p5');
    s = rules.nominate(s, 'p2');
    s = rules.setVoters(s, s.nominations[0].id, ['p0', 'p1', 'p4']);
    s = rules.executeNomination(s, s.nominations[0].id);
    expect(s.players[3].eliminated?.cause).toBe('heartbreak');
    expect(rules.dayCascadeDeaths(s).map((p) => p.id)).toEqual(['p3']);
  });
});

describe('one nomination per day', () => {
  it('refuses a second nomination until the first is withdrawn', () => {
    let s = rules.startDay(rules.resolveNight(game(['werewolf', 'seer', 'villager', 'villager', 'villager'])));
    s = rules.nominate(s, 'p0');
    expect(rules.canNominate(s)).toBe(false);
    expect(rules.nominate(s, 'p1').nominations.map((n) => n.accusedId)).toEqual(['p0']);
    s = rules.removeNomination(s, s.nominations[0].id);
    s = rules.nominate(s, 'p1');
    expect(s.nominations.map((n) => n.accusedId)).toEqual(['p1']);
  });
});

describe('v1.0.0 night order', () => {
  it('calls setup → transformations → Hooker / Bodyguard → Vampires → wolves → Minion / Sorceress → the rest', () => {
    const s = game(['cupid', 'witch', 'seer', 'sorceress', 'minion', 'werewolf', 'vampire', 'bodyguard', 'hooker', 'villager']);
    const steps = rules.buildNightSteps(s);
    expect(steps.map((x) => x.action)).toEqual([
      'cupidLink',
      'loversMeet',
      'hookerSeduce',
      'bodyguardProtect',
      'vampireBite',
      'wolfKill',
      'minionMeet',
      'sorceressInspect',
      'seerInspect',
      'witchPotion',
    ]);
    expect(steps.map((x) => x.group)).toEqual([1, 1, 3, 3, 4, 4, 4, 4, 5, 5]);
  });

  it('calls the Dire Wolf’s companion pick with the night-1 setup, before the pack', () => {
    const steps = rules.buildNightSteps(game(['direWolf', 'werewolf', 'cupid', 'mason', 'mason', 'hooker', 'villager', 'villager']));
    expect(steps.map((x) => x.action)).toEqual(['cupidLink', 'loversMeet', 'masonMeet', 'direWolfCompanion', 'hookerSeduce', 'wolfKill']);
    expect(steps.find((x) => x.action === 'direWolfCompanion')).toMatchObject({ group: 1, actors: ['p0'] });
  });

  it('wakes the Doppelgänger who took a role, and flags the bitten Cursed in the wolves’ turn, on the next night only', () => {
    let s = game(['werewolf', 'cursed', 'doppelganger', 'seer', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { wolfTargets: ['p1'], doppelgangerTarget: 'p3' }));
    s = rules.moderatorEliminate(rules.startDay(s), 'p3');
    expect(s.players[2].roleId).toBe('seer');
    s = rules.startNight(s);
    const steps = rules.buildNightSteps(s);
    // The Cursed never gets a call of their own: the moderator wakes them with the pack.
    expect(steps.map((x) => x.roleId)).not.toContain('cursed');
    expect(steps[0]).toMatchObject({ action: 'doppelgangerAwaken', actors: ['p2'], group: 2 });
    expect(steps.find((x) => x.action === 'wolfKill')).toMatchObject({ joining: ['p1'], actors: ['p0', 'p1'] });
    s = rules.startNight(rules.startDay(rules.resolveNight(s)));
    const later = rules.buildNightSteps(s);
    expect(later.some((x) => x.action === 'doppelgangerAwaken')).toBe(false);
    expect(later.find((x) => x.action === 'wolfKill')?.joining).toEqual([]);
  });
});

describe('the Drunk', () => {
  const night3 = (deck: RoleId[]) => {
    let s = game(deck);
    for (let i = 0; i < 2; i++) s = rules.startNight(rules.startDay(rules.resolveNight(s)));
    return s;
  };

  it('can only sober up into a Village or Werewolf role that isn’t a night-1 setup role', () => {
    const options = rules.drunkRoleOptions(NO_REBALANCES);
    // The Lone Wolf counts with the Werewolves.
    expect(options).toEqual(expect.arrayContaining(['seer', 'witch', 'hunter', 'werewolf', 'sorceress', 'hooker', 'loneWolf']));
    for (const banned of ['vampire', 'cultLeader', 'tanner', 'cupid', 'doppelganger', 'virginiaWoolf', 'mason', 'direWolf', 'minion', 'ghost', 'drunk'] as RoleId[]) {
      expect(options).not.toContain(banned);
    }
    // The reworked Tanner is a Villager.
    expect(rules.drunkRoleOptions({ ...NO_REBALANCES, tanner: true })).toContain('tanner');
  });

  it('plays the picked role at once: later calls include them and the Seer sees it', () => {
    let s = night3(['werewolf', 'drunk', 'seer', 'villager', 'villager', 'villager', 'villager']);
    s = gameReducer(s, { type: 'SET_NIGHT_ACTION', field: 'drunkRole', value: 'werewolf' });
    expect(s.players[1].roleId).toBe('werewolf');
    const steps = rules.buildNightSteps(s);
    // Still called as the Drunk (to keep the pick editable), and now wakes with the pack.
    expect(steps.find((x) => x.action === 'drunkSober')?.actors).toEqual(['p1']);
    expect(steps.find((x) => x.action === 'wolfKill')?.actors).toEqual(['p0', 'p1']);
    expect(rules.inspectionResult(s, 'seerInspect', 'p1')).toBe(true);
    // Changing the pick swaps the role; clearing it makes them the Drunk again.
    s = gameReducer(s, { type: 'SET_NIGHT_ACTION', field: 'drunkRole', value: 'witch' });
    expect(s.players[1].roleId).toBe('witch');
    expect(gameReducer(s, { type: 'SET_NIGHT_ACTION', field: 'drunkRole', value: null }).players[1].roleId).toBe('drunk');
    const after = rules.resolveNight(s);
    expect(after.players[1].roleId).toBe('witch');
    expect(after.log.filter((e) => e.key === 'log.drunkSober')).toHaveLength(1);
  });
});

describe('the Doppelgänger', () => {
  it('plays her new role the night she is woken to see it, and inspections see it', () => {
    let s = game(['werewolf', 'doppelganger', 'seer', 'witch', 'villager', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { doppelgangerTarget: 'p0' }));
    s = rules.moderatorEliminate(rules.startDay(s), 'p0'); // the Werewolf is voted out by day
    expect(s.players[1].roleId).toBe('werewolf');
    expect(rules.inspectionResult(rules.startNight(s), 'seerInspect', 'p1')).toBe(true);
    const steps = rules.buildNightSteps(rules.startNight(s));
    // Woken first to see her role, then she hunts with the pack that same night.
    expect(steps[0]).toMatchObject({ action: 'doppelgangerAwaken', actors: ['p1'] });
    expect(steps.find((x) => x.action === 'wolfKill')).toMatchObject({ actors: ['p1'], targetCount: 1, ghost: false });
  });
});

describe('the Hooker', () => {
  it('is a +3 custom Village role of intermediate difficulty — the only custom role', () => {
    expect(ROLES.hooker).toMatchObject({ faction: 'village', weight: 3, difficulty: 2, nightAction: 'hookerSeduce', custom: true });
    expect(Object.values(ROLES).filter((r) => r.custom).map((r) => r.id)).toEqual(['hooker']);
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
    expect(rules.executeNomination(rules.nominate(voted, 'p1'), rules.nominate(voted, 'p1').nominations[0].id).pendingTriggers).toEqual([]);
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
    voted = rules.executeNomination(rules.nominate(voted, 'p2'), rules.nominate(voted, 'p2').nominations[0].id);
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
    // Recruiting rules out a draw, so the Village plays on while it can outvote the Cult…
    expect(winner(leaving(['werewolf', 'cultLeader', 'villager', 'villager', 'villager'], [1, 2, 3]))).toBeNull();
    // …and loses to it once it can't.
    expect(winner(leaving(['werewolf', 'cultLeader', 'villager', 'villager', 'villager'], [1, 2]))).toEqual({ team: 'cult', winnerIds: ['p1'] });
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
    expect(next.setup.step ?? 'players').toBe('players');
  });

  it('rematches the same lineup straight onto the Deal board', () => {
    let s = gameReducer(createInitialState(), { type: 'UPDATE_SETUP', patch: { experience: 'veteran', pool: ['werewolf', 'seer', 'witch', 'villager'] } });
    const players = game(['seer', 'werewolf', 'cursed', 'villager', 'villager']).players;
    s = gameReducer(s, { type: 'START_GAME', players, rules: NO_REBALANCES });
    // Play changed a role: the rematch deals the original card again.
    s = { ...s, phase: 'gameOver', players: s.players.map((p) => (p.roleId === 'cursed' ? { ...p, roleId: 'werewolf', alive: false } : p)) };
    const next = gameReducer(s, { type: 'REMATCH' });
    expect(next.phase).toBe('setup');
    expect(next.log).toEqual([]);
    expect(next.setup.step).toBe('deal');
    expect(next.setup.names).toEqual(players.map((p) => p.name));
    expect([...next.setup.deck].sort()).toEqual(['cursed', 'seer', 'villager', 'villager', 'werewolf']);
    expect(next.setup.deal?.slots).toEqual([null, null, null, null, null]);
    expect(next.setup.pool).toEqual(expect.arrayContaining(['witch', 'cursed']));
    expect(next.setup.experience).toBe('veteran');
  });

  it('rematches onto the Deck step when the deck breaks the current rules', () => {
    let s = gameReducer(createInitialState(), { type: 'START_GAME', players: game(['seer', 'werewolf', 'vampire', 'cultLeader', 'villager']).players, rules: NO_REBALANCES });
    s = { ...s, phase: 'gameOver' };
    const next = gameReducer(s, { type: 'REMATCH' });
    expect(next.setup.step).toBe('deck');
    expect(next.setup.deal).toBeNull();
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
  it('groups roles into Village / Wolves / Other: easiest first, then most favouring the side, then by name', () => {
    expect(ROLE_SECTIONS.map((sec) => sec.id)).toEqual(['village', 'wolves', 'other']);
    expect(ROLE_SECTIONS.flatMap((sec) => sec.roles)).toHaveLength(Object.keys(ROLES).length);
    const name = (id: RoleId) => dictionaries.en[`role.${id}.name`];
    for (const sec of ROLE_SECTIONS) {
      const side = sec.id === 'village' ? -1 : 1;
      for (let i = 1; i < sec.roles.length; i++) {
        const [a, b] = [ROLES[sec.roles[i - 1]], ROLES[sec.roles[i]]];
        const byWeight = side * (a.weight - b.weight);
        expect(
          a.difficulty < b.difficulty ||
            (a.difficulty === b.difficulty && (byWeight < 0 || (byWeight === 0 && name(a.id).localeCompare(name(b.id), 'en') < 0))),
        ).toBe(true);
      }
    }
    // Beginner Village: Seer (+7) first; Bodyguard, Diseased, Hunter… (+3) alphabetical.
    expect(ROLE_SECTIONS[0].roles.slice(0, 7)).toEqual(['seer', 'bodyguard', 'diseased', 'hunter', 'priest', 'prince', 'mason']);
    // Beginner Wolves: Wolf Man (−9) first.
    expect(ROLE_SECTIONS[1].roles.slice(0, 3)).toEqual(['wolfMan', 'werewolf', 'fruitBrute']);
    expect(ROLE_SECTIONS[1].roles).toContain('minion');
    expect(ROLE_SECTIONS[2].roles).toEqual(['vampire', 'tanner', 'cultLeader']);
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

describe('v1.2.0 unhealable Big Bad Wolf', () => {
  const house = { bigBadWolf: true };
  // p7 is the pack's victim; the Big Bad Wolf strikes p8, next to it.
  const deck: RoleId[] = ['bigBadWolf', 'werewolf', 'leprechaun', 'bodyguard', 'witch', 'priest', 'hooker', 'villager', 'villager', 'villager'];
  const night = (a: Partial<GameState['nightActions']> = {}) => withActions(game(deck, house), { wolfTargets: ['p7'], bigBadWolfTarget: 'p8', ...a });
  const hitOn = (s: GameState, id: string) => rules.killDebuffs(s).find((h) => h.targetId === id);

  it('lets only the Priest stop the strike — not the Bodyguard', () => {
    expect(alive(rules.resolveNight(night({ bodyguardTarget: 'p8' })), 'p8')).toBe(false);
    expect(alive(rules.resolveNight(night({ bodyguardTarget: 'p7' })), 'p7')).toBe(true);
    const blessed = rules.resolveNight(night({ priestTarget: 'p8' }));
    expect(alive(blessed, 'p8')).toBe(true);
    expect(blessed.lastReport?.saved).toContain('p8');
  });

  it('stacks [WolfpackKill, BBWKill] when the Leprechaun moves the pack onto the strike', () => {
    const s = night({ leprechaunMove: 'left' });
    expect(hitOn(s, 'p8')?.debuffs).toEqual(['wolfpackKill', 'bbwKill']);
    expect(hitOn(s, 'p7')).toBeUndefined();
    expect(rules.witchVictims(s)).toEqual(['p8']);
    const after = rules.resolveNight(s);
    expect([alive(after, 'p7'), alive(after, 'p8')]).toEqual([true, false]);
  });

  it('lets the Bodyguard or Witch lift only the pack’s debuff; the Priest lifts both', () => {
    const guarded = night({ leprechaunMove: 'left', bodyguardTarget: 'p8' });
    expect(hitOn(guarded, 'p8')).toMatchObject({ dispelled: { wolfpackKill: 'bodyguard' }, lands: true });
    const afterGuard = rules.resolveNight(guarded);
    expect(alive(afterGuard, 'p8')).toBe(false);
    expect(afterGuard.lastReport?.saved).toEqual([]);
    expect(afterGuard.log.some((e) => e.key === 'log.bigBadWolfUnstoppable')).toBe(true);
    expect(alive(rules.resolveNight(night({ leprechaunMove: 'left', witchSaveTarget: 'p8' })), 'p8')).toBe(false);
    const blessed = night({ leprechaunMove: 'left', priestTarget: 'p8' });
    expect(hitOn(blessed, 'p8')).toMatchObject({ dispelled: { wolfpackKill: 'priest', bbwKill: 'priest' }, lands: false });
    expect(alive(rules.resolveNight(blessed), 'p8')).toBe(true);
  });

  it('cancels both debuffs when the Big Bad Wolf is seduced, only the pack’s for another wolf', () => {
    const bbwSeduced = night({ leprechaunMove: 'left', hookerTarget: 'p0' });
    expect(hitOn(bbwSeduced, 'p8')).toMatchObject({ dispelled: { wolfpackKill: 'hooker', bbwKill: 'hooker' }, lands: false });
    const calm = rules.resolveNight(bbwSeduced);
    expect(alive(calm, 'p8')).toBe(true);
    // Nobody saved anyone: the attacks simply never happened.
    expect(calm.lastReport?.saved).toEqual([]);
    const wolfSeduced = night({ leprechaunMove: 'left', hookerTarget: 'p1' });
    expect(hitOn(wolfSeduced, 'p8')).toMatchObject({ dispelled: { wolfpackKill: 'hooker' }, lands: true });
    expect(alive(rules.resolveNight(wolfSeduced), 'p8')).toBe(false);
  });

  it('counts a stack as one wolf attack for the Cursed and the Tough Guy', () => {
    const table = (victim: RoleId) =>
      withActions(game(['bigBadWolf', 'werewolf', 'leprechaun', 'villager', victim, 'villager', 'villager'], house), {
        wolfTargets: ['p3'],
        bigBadWolfTarget: 'p4',
        leprechaunMove: 'left',
      });
    const cursed = rules.resolveNight(table('cursed'));
    expect(cursed.players[4]).toMatchObject({ alive: true, roleId: 'werewolf' });
    const tough = rules.resolveNight(table('toughGuy'));
    expect(tough.players[4]).toMatchObject({ alive: true, status: expect.objectContaining({ woundedRound: 1 }) });
    // The strike alone works the same way.
    const struck = rules.resolveNight(withActions(table('cursed'), { leprechaunMove: null }));
    expect(struck.players[4]).toMatchObject({ alive: true, roleId: 'werewolf' });
  });

  it('makes the pack and the Big Bad Wolf skip the next night when the strike kills the Diseased', () => {
    const s = withActions(game(['bigBadWolf', 'werewolf', 'bodyguard', 'villager', 'diseased', 'villager', 'villager', 'villager'], house), {
      wolfTargets: ['p3'],
      bigBadWolfTarget: 'p4',
      bodyguardTarget: 'p4',
    });
    const after = rules.resolveNight(s);
    expect(alive(after, 'p4')).toBe(false);
    expect(after.modifiers.wolvesSkipNextNight).toBe(true);

    // Next night: both calls are skipped, and nothing lands even if a target were set.
    const sick = rules.startNight(rules.startDay(after));
    const calls = (g: GameState) => rules.buildNightSteps(g).filter((x) => x.action === 'wolfKill' || x.action === 'bigBadWolfStrike');
    expect(calls(sick).map((x) => [x.action, x.targetCount, x.note])).toEqual([
      ['wolfKill', 0, 'wolvesSkip'],
      ['bigBadWolfStrike', 0, 'wolvesSkip'],
    ]);
    const forced = withActions(sick, { wolfTargets: ['p6'], bigBadWolfTarget: 'p7' });
    expect(rules.killDebuffs(forced)).toEqual([]);
    const quiet = rules.resolveNight(forced);
    expect([alive(quiet, 'p6'), alive(quiet, 'p7')]).toEqual([true, true]);

    // The night after, both hunt again.
    const hungry = rules.startNight(rules.startDay(quiet));
    expect(calls(hungry).map((x) => x.targetCount)).toEqual([1, 1]);
  });

  it('still only lets the Big Bad Wolf strike a neighbour of the pack’s victim', () => {
    const s = night();
    const strike = rules.buildNightSteps(s).find((x) => x.action === 'bigBadWolfStrike')!;
    expect(rules.eligibleTargets(s, strike).map((p) => p.id).sort()).toEqual(['p6', 'p8']);
  });

  it('shifts both of the standard Big Bad Wolf’s victims with one Leprechaun move', () => {
    const s = withActions(game(['bigBadWolf', 'leprechaun', 'bodyguard', 'villager', 'villager', 'villager', 'villager']), {
      wolfTargets: ['p3', 'p4'],
      leprechaunMove: 'left',
    });
    expect(rules.effectiveWolfTargets(s)).toEqual(['p4', 'p5']);
    const after = rules.resolveNight(s);
    expect(['p3', 'p4', 'p5'].map((id) => alive(after, id))).toEqual([true, false, false]);
  });

  describe('on a Wolf Cub night (two pack targets)', () => {
    // The pack attacks p5 and p9.
    const cubDeck: RoleId[] = ['bigBadWolf', 'werewolf', 'leprechaun', 'witch', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'];
    const cubNight = (a: Partial<GameState['nightActions']> = {}) => {
      const s = game(cubDeck, house);
      return withActions({ ...s, modifiers: { ...s.modifiers, wolvesDoubleKill: true } }, { wolfTargets: ['p5', 'p9'], ...a });
    };

    it('lets the Big Bad Wolf strike next to either pack target', () => {
      const s = cubNight();
      expect(rules.buildNightSteps(s).find((x) => x.action === 'wolfKill')!.targetCount).toBe(2);
      const strike = rules.buildNightSteps(s).find((x) => x.action === 'bigBadWolfStrike')!;
      expect(rules.eligibleTargets(s, strike).map((p) => p.id).sort()).toEqual(['p10', 'p4', 'p6', 'p8']);
    });

    it('moves both pack targets with one Leprechaun move — onto the strike, they stack', () => {
      const s = cubNight({ leprechaunMove: 'left', bigBadWolfTarget: 'p10' });
      expect(rules.effectiveWolfTargets(s)).toEqual(['p6', 'p10']);
      expect(rules.killDebuffs(s).find((h) => h.targetId === 'p10')?.debuffs).toEqual(['wolfpackKill', 'bbwKill']);
      const after = rules.resolveNight(s);
      expect(['p5', 'p9', 'p6', 'p10'].map((id) => alive(after, id))).toEqual([true, true, false, false]);
    });

    it('lets the Witch save only one of the two victims', () => {
      const s = cubNight();
      expect(rules.witchVictims(s)).toEqual(['p5', 'p9']);
      let healed = gameReducer(s, { type: 'SET_NIGHT_ACTION', field: 'witchSaveTarget', value: 'p5' });
      healed = gameReducer(healed, { type: 'SET_NIGHT_ACTION', field: 'witchSaveTarget', value: 'p9' });
      expect(healed.nightActions.witchSaveTarget).toBe('p9');
      const after = rules.resolveNight(healed);
      expect([alive(after, 'p5'), alive(after, 'p9')]).toEqual([false, true]);
    });
  });
});

describe('v1.2.0 localization', () => {
  it('names the Priest "Mục Sư" in Vietnamese wherever the role is spelled out', () => {
    expect(dictionaries.vi['role.priest.name']).toBe('Mục Sư');
    const mentions = ['role.priest.script', 'night.bigBadWolfRule', 'debuff.hint', 'rebalance.bigBadWolf.desc'] as const;
    for (const key of mentions) expect(dictionaries.vi[key]).toContain('Mục Sư');
    expect(Object.values(dictionaries.vi).some((text) => /linh mục|thầy tu|cha xứ/i.test(text))).toBe(false);
  });
});

describe('v1.2.0 Leprechaun shifts the attack onto a Werewolf', () => {
  // The pack attacks p2; its left neighbour (next seat clockwise) is a wolf, p3.
  const deck = (wolf: RoleId): RoleId[] => ['villager', 'villager', 'villager', wolf, 'leprechaun', 'bodyguard', 'villager', 'werewolf', 'villager'];
  const shifted = (wolf: RoleId, house: Partial<RebalanceRules> = {}, a: Partial<GameState['nightActions']> = {}) =>
    withActions(game(deck(wolf), house), { wolfTargets: ['p2'], leprechaunMove: 'left', ...a });

  it('kills the Werewolf on the victim’s left and spares the victim', () => {
    const after = rules.resolveNight(shifted('werewolf'));
    expect([alive(after, 'p2'), alive(after, 'p3')]).toEqual([true, false]);
    expect(after.players[3].eliminated?.cause).toBe('wolves');
    expect(after.lastReport?.deaths.map((d) => d.playerId)).toEqual(['p3']);
  });

  it('lets the usual saves protect that Werewolf', () => {
    expect(alive(rules.resolveNight(shifted('werewolf', {}, { bodyguardTarget: 'p3' })), 'p3')).toBe(true);
  });

  it('fires the dead wolf’s own rule: a Wolf Cub enrages the pack', () => {
    const after = rules.resolveNight(shifted('wolfCub'));
    expect(alive(after, 'p3')).toBe(false);
    expect(after.modifiers.wolvesDoubleKill).toBe(true);
  });

  it('kills a Big Bad Wolf hit by his own pack, while his strike still lands', () => {
    const after = rules.resolveNight(shifted('bigBadWolf', { bigBadWolf: true }, { bigBadWolfTarget: 'p1' }));
    expect(['p2', 'p3', 'p1'].map((id) => alive(after, id))).toEqual([true, false, false]);
  });
});

describe('v1.2.0 role descriptions', () => {
  it('stay short enough for the card’s three lines, in both languages', () => {
    const isDesc = (key: string) => key.startsWith('role.') && (key.endsWith('.desc') || key.endsWith('.descRebalanced'));
    for (const lang of ['en', 'vi'] as const) {
      const long = Object.entries(dictionaries[lang]).filter(([key, text]) => isDesc(key) && [...text].length > 100);
      expect(long).toEqual([]);
    }
  });
});

describe('v1.2.0 wolf-team descriptions', () => {
  it('say whether each Werewolf-team role wakes with the pack', () => {
    const wolfTeam = (Object.keys(ROLES) as RoleId[]).filter((id) => ROLES[id].faction === 'werewolf');
    expect(wolfTeam).toContain('sorceress');
    for (const id of wolfTeam) {
      for (const key of [`role.${id}.desc`, `role.${id}.descRebalanced`]) {
        const en = (dictionaries.en as Record<string, string>)[key];
        const vi = (dictionaries.vi as Record<string, string>)[key];
        if (en === undefined) continue;
        expect(en.toLowerCase(), key).toContain('wake');
        expect(vi.toLowerCase(), key).toContain('thức dậy');
      }
    }
  });
});

describe('v1.2.0 night-1 setup, the Hooker and the Witch', () => {
  it('holds every night-1 setup call until its picks are made', () => {
    const s = game(['werewolf', 'cupid', 'doppelganger', 'virginiaWoolf', 'direWolf', 'villager', 'villager', 'villager']);
    const setup = rules.buildNightSteps(s).filter((x) => x.group === 1 && x.kind === 'targets');
    expect(setup.map((x) => x.action).sort()).toEqual(['cupidLink', 'direWolfCompanion', 'doppelgangerCopy', 'virginiaFear']);
    expect(setup.every((x) => rules.setupIncomplete(s, x))).toBe(true);
    const cupid = setup.find((x) => x.action === 'cupidLink')!;
    expect(rules.setupIncomplete(withActions(s, { cupidTargets: ['p5'] }), cupid)).toBe(true);
    const done = withActions(s, { cupidTargets: ['p5', 'p6'], doppelgangerTarget: 'p5', virginiaTarget: 'p6', direWolfTarget: 'p7' });
    expect(setup.some((x) => rules.setupIncomplete(done, x))).toBe(false);
    // Every other call may still be skipped.
    expect(rules.buildNightSteps(s).filter((x) => x.group !== 1).some((x) => rules.setupIncomplete(s, x))).toBe(false);
  });

  it('still shows the Witch a seduced pack’s victim, and her heal is wasted', () => {
    const s = withActions(game(['werewolf', 'hooker', 'witch', 'villager', 'villager', 'villager']), { wolfTargets: ['p3'], hookerTarget: 'p0' });
    expect(rules.effectiveWolfTargets(s)).toEqual([]);
    expect(rules.witchVictims(s)).toEqual(['p3']);
    const witch = rules.buildNightSteps(s).find((x) => x.action === 'witchPotion')!;
    expect(rules.eligibleTargets(s, witch, 'save').map((p) => p.id)).toEqual(['p3']);
    const after = rules.resolveNight(withActions(s, { witchSaveTarget: 'p3' }));
    expect(alive(after, 'p3')).toBe(true);
    expect(after.modifiers.witchHealUsed).toBe(true);
    // Nobody was really saved: the attack never happened.
    expect(after.lastReport?.saved).toEqual([]);
  });

  it('wastes a seduced Witch’s potions: no heal, no poison, both spent', () => {
    const s = withActions(game(['werewolf', 'hooker', 'witch', 'villager', 'villager', 'villager', 'villager']), {
      wolfTargets: ['p3'],
      hookerTarget: 'p2',
      witchSaveTarget: 'p3',
      witchKillTarget: 'p4',
    });
    // She sees the victim as usual: nothing tells her she was seduced.
    expect(rules.witchVictims(s)).toEqual(['p3']);
    const after = rules.resolveNight(s);
    expect([alive(after, 'p3'), alive(after, 'p4')]).toEqual([false, true]);
    expect([after.modifiers.witchHealUsed, after.modifiers.witchKillUsed]).toEqual([true, true]);
  });
});

describe('v1.2.0 death links on the board', () => {
  it('lists Virginia Woolf’s and the Dire Wolf’s links once night 1 is resolved, pointing at whoever dies along', () => {
    const s = withActions(game(['direWolf', 'werewolf', 'virginiaWoolf', 'villager', 'villager', 'villager', 'villager']), {
      virginiaTarget: 'p3',
      direWolfTarget: 'p4',
    });
    expect(rules.deathLinks(s)).toEqual([]);
    const after = rules.resolveNight(s);
    expect(rules.deathLinks(after)).toEqual([
      { kind: 'virginia', from: 'p2', to: 'p3' },
      { kind: 'direWolf', from: 'p4', to: 'p0' },
    ]);
    // The links really work that way round.
    expect(alive(rules.moderatorEliminate(after, 'p2'), 'p3')).toBe(false);
    expect(alive(rules.moderatorEliminate(after, 'p4'), 'p0')).toBe(false);
  });
});

describe('v1.3.0 win conditions: eliminating votes', () => {
  /** A game where only the listed seats are still alive. */
  const leaving = (roles: RoleId[], living: number[]): GameState => {
    const s = game(roles);
    return { ...s, players: s.players.map((p) => ({ ...p, alive: living.includes(p.seat) })) };
  };
  const winner = (s: GameState) => rules.evaluateWinner(s);

  it('counts the Mayor’s vote twice and the Pacifist’s not at all', () => {
    const [mayor, pacifist, villager] = game(['mayor', 'pacifist', 'villager', 'werewolf', 'villager']).players;
    expect([mayor, pacifist, villager].map(rules.eliminatingVotes)).toEqual([2, 0, 1]);
  });

  it('lets a Mayor hold off one wolf, but not two', () => {
    expect(winner(leaving(['werewolf', 'mayor', 'villager', 'villager', 'werewolf'], [0, 1]))).toBeNull();
    expect(winner(leaving(['werewolf', 'mayor', 'villager', 'villager', 'werewolf'], [0, 1, 4]))?.team).toBe('werewolf');
  });

  it('gives the Pacifist no say: a wolf beats a Villager and a Pacifist, not two Villagers', () => {
    expect(winner(leaving(['werewolf', 'pacifist', 'villager', 'villager', 'villager'], [0, 1, 2]))?.team).toBe('werewolf');
    expect(winner(leaving(['werewolf', 'pacifist', 'villager', 'villager', 'villager'], [0, 2, 3]))).toBeNull();
  });

  it('calls a draw only when neither side can kill or turn anyone and the votes tie', () => {
    // A lone Fruit Brute can't kill: against a Mayor it's 1 vote to 2, so play goes on…
    expect(winner(leaving(['fruitBrute', 'mayor', 'villager', 'werewolf', 'villager'], [0, 1]))).toBeNull();
    // …against a Villager and a Pacifist, 1 to 1: a draw, not a wolf win.
    expect(winner(leaving(['fruitBrute', 'pacifist', 'villager', 'werewolf', 'villager'], [0, 1, 2]))).toEqual({ team: 'draw', winnerIds: [] });
  });

  describe('with a player sent away by the Old Hag', () => {
    const away = (s: GameState, seat: number): GameState => ({
      ...s,
      players: s.players.map((p) => (p.seat === seat ? { ...p, status: { ...p.status, banished: true } } : p)),
    });
    const wolves: RoleId[] = ['werewolf', 'werewolf', 'villager', 'villager', 'villager'];
    const noKill: RoleId[] = ['fruitBrute', 'villager', 'villager', 'werewolf', 'minion'];
    /** A Lone Wolf against a Mayor, who could otherwise vote it out alone. */
    const lastOneMayor = () => leaving(['loneWolf', 'mayor', 'werewolf', 'villager', 'villager'], [0, 1]);

    it('takes their vote away today, and leaves them out of the majority', () => {
      const s = away(leaving(wolves, [0, 1, 2, 3, 4]), 4);
      expect(rules.eligibleVoters(s).map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3']);
      expect(rules.votesNeeded(s)).toBe(3);
      expect(s.players.map(rules.votesToday)).toEqual([1, 1, 1, 1, 0]);
    });

    it('ends the game on today’s votes when the other team can kill: it can take them tonight', () => {
      expect(winner(leaving(wolves, [0, 1, 2, 3, 4]))).toBeNull();
      expect(winner(away(leaving(wolves, [0, 1, 2, 3, 4]), 4))?.team).toBe('werewolf');
      // Even a Mayor's two votes: the wolves can kill the Mayor tonight.
      expect(winner(away(leaving(['werewolf', 'werewolf', 'villager', 'villager', 'mayor'], [0, 1, 2, 3, 4]), 4))?.team).toBe('werewolf');
      expect(winner(away(lastOneMayor(), 1))?.team).toBe('loneWolf');
    });

    it('gives the Village its chance when a wolf is the one sent away', () => {
      expect(winner(leaving(wolves, [0, 1, 2, 3]))?.team).toBe('werewolf'); // 2 votes each
      expect(winner(away(leaving(wolves, [0, 1, 2, 3]), 0))).toBeNull(); // 2 votes to 1 today
    });

    it('declares nothing against a team that can’t kill unless it also holds once they’re back', () => {
      // 1 to 1 today, but 2 to 1 tomorrow, when the Village can vote the Fruit Brute out.
      expect(winner(leaving(noKill, [0, 1]))).toEqual({ team: 'draw', winnerIds: [] });
      expect(winner(away(leaving(noKill, [0, 1, 2]), 2))).toBeNull();
      // 1 to 2 today, but a tie tomorrow: the pack must first vote the other Villager out.
      expect(winner(away(leaving(noKill, [0, 1, 2, 4]), 2))).toBeNull();
      // Done: they outvote the Village today and tomorrow.
      expect(winner(away(leaving(noKill, [0, 2, 4]), 2))?.team).toBe('werewolf');
      // No vote goes missing with a Pacifist away, so the draw stands.
      const pacifist = away(leaving(['fruitBrute', 'pacifist', 'villager', 'werewolf', 'villager'], [0, 1, 2]), 1);
      expect(winner(pacifist)).toEqual({ team: 'draw', winnerIds: [] });
    });

    it('counts the exile already at dawn, for the day about to be played', () => {
      const s = game(['werewolf', 'werewolf', 'oldHag', 'villager', 'villager', 'villager']);
      expect(rules.resolveNight(withActions(s, { wolfTargets: ['p5'] })).winner).toBeNull(); // 3 votes to 2
      const exiled = rules.resolveNight(withActions(s, { wolfTargets: ['p5'], oldHagTarget: 'p4' }));
      expect(exiled.winner?.team).toBe('werewolf'); // 2 to 2
    });
  });
});

describe('v1.3.0 Lone Wolf endgame', () => {
  const leaving = (roles: RoleId[], living: number[]): GameState => {
    const s = game(roles);
    return { ...s, players: s.players.map((p) => ({ ...p, alive: living.includes(p.seat) })) };
  };
  const winner = (s: GameState) => rules.evaluateWinner(s);
  const lastOne = (role: RoleId) => leaving(['loneWolf', role, 'werewolf', 'villager', 'villager'], [0, 1]);

  it('wins against one last Villager with no kill, no way to change teams and no extra vote', () => {
    expect(winner(lastOne('villager'))).toEqual({ team: 'loneWolf', winnerIds: ['p0'] });
    expect(winner(lastOne('pacifist'))?.team).toBe('loneWolf');
    expect(winner(lastOne('prince'))?.team).toBe('loneWolf');
  });

  it('plays on while that Villager can still fight back', () => {
    // A kill power (the Hunter, the Witch's poison), a possible change of team (the Drunk), or a
    // Mayor who can vote the Lone Wolf out alone.
    for (const role of ['hunter', 'witch', 'drunk', 'mayor'] as const) expect(winner(lastOne(role))).toBeNull();
    const spent = lastOne('witch');
    expect(winner({ ...spent, modifiers: { ...spent.modifiers, witchKillUsed: true } })?.team).toBe('loneWolf');
    // Two Villagers left can still outvote the Lone Wolf.
    expect(winner(leaving(['loneWolf', 'villager', 'werewolf', 'villager', 'villager'], [0, 1, 3]))).toBeNull();
  });

  it('lets a Lone Wolf and a Villager in love win together as the Couple', () => {
    let s = game(['loneWolf', 'cupid', 'villager', 'werewolf', 'villager', 'villager']);
    s = rules.resolveNight(withActions(s, { cupidTargets: ['p0', 'p2'] }));
    expect(winner({ ...s, players: s.players.map((p) => ({ ...p, alive: ['p0', 'p2'].includes(p.id) })) })?.team).toBe('couple');
  });
});

describe('v1.3.0 the Prince', () => {
  it('lets a bitten Prince fall at the first accusation instead of being revealed', () => {
    let s = game(['werewolf', 'vampire', 'prince', 'villager', 'villager', 'villager', 'villager']);
    s = rules.startDay(rules.resolveNight(withActions(s, { vampireTarget: 'p2' })));
    s = rules.nominate(s, 'p2');
    expect(alive(s, 'p2')).toBe(false);
    expect(s.players[2].status.princeRevealed).toBe(false);
    expect(s.nominations).toEqual([]);
  });
});

describe('v1.3.0 the Old Hag', () => {
  const deck: RoleId[] = ['werewolf', 'oldHag', 'hooker', 'villager', 'villager', 'villager', 'villager'];
  const targets = (s: GameState) => rules.eligibleTargets(s, rules.buildNightSteps(s).find((x) => x.action === 'oldHagBanish')!).map((p) => p.id);
  const nextNight = (s: GameState) => rules.startNight(rules.startDay(rules.resolveNight(s)));

  it('can’t send the same player away two nights in a row', () => {
    let s = nextNight(withActions(game(deck), { oldHagTarget: 'p3' }));
    expect(s.modifiers.oldHagLastTarget).toBe('p3');
    expect(targets(s)).not.toContain('p3');
    // Another player tonight: p3 is free again, p4 isn't.
    s = nextNight(withActions(s, { oldHagTarget: 'p4' }));
    expect(targets(s)).toContain('p3');
    expect(targets(s)).not.toContain('p4');
    // A night with no exile frees everyone.
    s = nextNight(s);
    expect(targets(s)).toContain('p4');
  });

  it('only bars a player who really left: a seduced Old Hag may pick them again', () => {
    const s = nextNight(withActions(game(deck), { oldHagTarget: 'p3', hookerTarget: 'p1' }));
    expect(s.players[3].status.banished).toBe(false);
    expect(targets(s)).toContain('p3');
  });

  it('loads games saved before v1.3.0 with no one barred', () => {
    const { oldHagLastTarget: _gone, ...modifiers } = game(deck).modifiers;
    const saved = { ...game(deck), modifiers } as unknown as GameState;
    expect(normalizeGameState(saved).modifiers.oldHagLastTarget).toBeNull();
  });
});

describe('v1.3.0 auto-balance', () => {
  const pool: RoleId[] = ['seer', 'bodyguard', 'hunter', 'witch', 'prince', 'mayor', 'lycan', 'cursed', 'wolfCub', 'sorceress', 'spellcaster', 'diseased'];

  it('counts the cards a deck changes from another, copies included', () => {
    expect(deckChanges(['werewolf', 'seer', 'villager', 'villager'], ['villager', 'seer', 'werewolf', 'villager'])).toBe(0);
    expect(deckChanges(['werewolf', 'seer', 'villager', 'villager'], ['werewolf', 'seer', 'villager', 'witch'])).toBe(1);
    expect(deckChanges(['werewolf', 'werewolf', 'villager'], ['werewolf', 'villager', 'villager'])).toBe(1);
    expect([5, 10, 11, 20, 21, 30].map(minDeckChanges)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('lands within ±1 of the target when the pool allows it', () => {
    // (Not 6 beginners: their easy roles and the Villager cap can't go below +4.)
    for (const experience of ['beginner', 'standard', 'veteran'] as const) {
      for (const n of [8, 9, 12, 15]) {
        const deck = generateBalancedDeck({ playerCount: n, pool, experience, random: seeded(n * 7) });
        expect(Math.abs(calculateBalance(deck) - EXPERIENCE_TARGET[experience])).toBeLessThanOrEqual(AUTO_BALANCE_TOLERANCE);
      }
    }
  });

  it('never deals the last game’s deck again: at least 10% of the cards change, still balanced', () => {
    for (const n of [8, 10, 12, 20]) {
      for (const seed of [1, 2, 3]) {
        const previousDeck = generateBalancedDeck({ playerCount: n, pool, experience: 'standard', random: seeded(seed) });
        // The same seed deals the same deck again when there's no previous deck to avoid.
        expect(generateBalancedDeck({ playerCount: n, pool, experience: 'standard', random: seeded(seed) })).toEqual(previousDeck);
        const next = generateBalancedDeck({ playerCount: n, pool, experience: 'standard', previousDeck, random: seeded(seed) });
        expect(deckChanges(next, previousDeck)).toBeGreaterThanOrEqual(minDeckChanges(n));
        expect(Math.abs(calculateBalance(next) - EXPERIENCE_TARGET.standard)).toBeLessThanOrEqual(AUTO_BALANCE_TOLERANCE);
        expect(validateDeck(next, n)).toEqual([]);
      }
    }
  });
});

describe('v1.3.0 full pool calls', () => {
  const dealt: RoleId[] = ['werewolf', 'seer', 'villager', 'villager', 'villager'];
  const withPool = (fullPoolCalls: boolean): GameState => {
    const s = game(dealt);
    return { ...s, fullPoolCalls, setup: { ...s.setup, pool: ['villager', 'werewolf', 'seer', 'bodyguard', 'cupid', 'wolfCub', 'prince'] } };
  };

  it('calls the pool’s undealt night roles as ghost calls, only when switched on', () => {
    expect(rules.buildNightSteps(withPool(false)).map((x) => x.action)).toEqual(['wolfKill', 'seerInspect']);
    const steps = rules.buildNightSteps(withPool(true));
    expect(steps.map((x) => [x.action, x.ghost, !!x.undealt])).toEqual([
      ['cupidLink', true, true],
      ['loversMeet', true, true],
      ['bodyguardProtect', true, true],
      ['wolfKill', false, false],
      ['seerInspect', false, false],
    ]);
    // A ghost night-1 setup call doesn't hold the night up.
    expect(steps.some((x) => rules.setupIncomplete(withPool(true), x))).toBe(false);
  });

  it('tells a role nobody was dealt apart from one whose holders were eliminated', () => {
    const s = withPool(true);
    const later = rules.startNight(rules.startDay(rules.moderatorEliminate(rules.resolveNight(s), 'p1')));
    const call = (action: string) => rules.buildNightSteps(later).find((x) => x.action === action);
    expect(call('seerInspect')).toMatchObject({ ghost: true, undealt: false });
    expect(call('bodyguardProtect')).toMatchObject({ ghost: true, undealt: true });
    // Without full pool calls, every ghost call is for eliminated players.
    const dealtOnly = rules.buildNightSteps({ ...later, fullPoolCalls: false });
    expect(dealtOnly.filter((x) => x.ghost).map((x) => [x.action, x.undealt])).toEqual([['seerInspect', false]]);
  });

  it('is frozen into the game when the cards are dealt', () => {
    const players = game(dealt).players;
    const on = gameReducer(createInitialState(), { type: 'START_GAME', players, rules: NO_REBALANCES, fullPoolCalls: true });
    expect(on.fullPoolCalls).toBe(true);
    expect(gameReducer(createInitialState(), { type: 'START_GAME', players, rules: NO_REBALANCES }).fullPoolCalls).toBe(false);
    // Games saved before v1.3.0 call only the dealt roles.
    expect(normalizeGameState({ ...on, fullPoolCalls: undefined } as unknown as GameState).fullPoolCalls).toBe(false);
  });
});

describe('v1.3.0 players step', () => {
  it('swaps two seats and inserts a seat mid-table', () => {
    expect(swapSeats(['An', 'Binh', 'Chi', 'Dung'], 0, 2)).toEqual(['Chi', 'Binh', 'An', 'Dung']);
    expect(swapSeats(['An', 'Binh'], 1, 1)).toEqual(['An', 'Binh']);
    expect(swapSeats(['An', 'Binh'], 0, 5)).toEqual(['An', 'Binh']);
    expect(insertSeat(['An', 'Binh', 'Chi'], 0)).toEqual(['An', '', 'Binh', 'Chi']);
    expect(insertSeat(['An', 'Binh', 'Chi'], 2)).toEqual(['An', 'Binh', 'Chi', '']);
  });

  it('finds names typed twice, whatever the case, spacing or accent encoding', () => {
    expect(duplicateNames(['An', 'Binh', ' an ', 'Chi', '', ''])).toEqual(['An']);
    // "Đức" typed with combining accents (NFD) is the same name as the precomposed one.
    expect(duplicateNames(['Đức', 'Đức'.normalize('NFD'), 'Mai  Anh', 'mai anh', 'Lan'])).toEqual(['Đức', 'Mai  Anh']);
    expect(duplicateNames(['An', 'Binh', 'Chi'])).toEqual([]);
  });

  it('remembers the last game’s cards for the next auto-balance', () => {
    const players = game(['werewolf', 'seer', 'villager', 'villager', 'villager']).players;
    const played: GameState = { ...gameReducer(createInitialState(), { type: 'START_GAME', players, rules: NO_REBALANCES }), phase: 'gameOver' };
    const deck: RoleId[] = ['werewolf', 'seer', 'villager', 'villager', 'villager'];
    expect(gameReducer(played, { type: 'NEW_GAME' }).setup.previousDeck).toEqual(deck);
    expect(gameReducer(played, { type: 'REMATCH' }).setup.previousDeck).toEqual(deck);
    // Still remembered after another new game with nothing dealt in between.
    expect(gameReducer(gameReducer(played, { type: 'NEW_GAME' }), { type: 'NEW_GAME' }).setup.previousDeck).toEqual(deck);
  });
});

describe('v1.3.0 card tags', () => {
  it('marks a role Rebalanced only while its own house rule is on', () => {
    expect(isRebalanced('hunter', { ...NO_REBALANCES, hunter: true })).toBe(true);
    expect(isRebalanced('hunter', NO_REBALANCES)).toBe(false);
    expect(isRebalanced('seer', { hunter: true, witch: true, bigBadWolf: true, tanner: true })).toBe(false);
  });
});
