import { describe, expect, it } from 'vitest';
import { NO_REBALANCES, type Feat, type GameState, type Player, type RebalanceRules, type RoleId } from '../@types/game';
import { createInitialState, gameReducer, historyReducer, normalizeGameState, type History } from '../context/GameContext';
import { dictionaries } from '../i18n/translations';
import { buildGameRecord, EMPTY_STATUS } from './gameCalculations';
import * as rules from './gameRules';
import { historyRecords, mvpNames, tallyMvps } from './historyAnalytics';
import {
  featLineKey,
  featPoints,
  isPlainRole,
  pickPoints,
  recordScoreBoard,
  roleValue,
  scoreGame,
  scoreInputOf,
  standings,
  type PlayerScore,
} from './scoring';

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

const night = (s: GameState, a: Partial<GameState['nightActions']>): GameState =>
  rules.resolveNight({ ...s, nightActions: { ...s.nightActions, ...a } });

/** Dawn → day → (no elimination) → next night. */
const quietDay = (s: GameState) => rules.startNight(rules.closeDayWithoutExecution(rules.startDay(s)));

/** Dawn → day → an elimination by these voters. Stays on the closed day. */
function voteOut(s: GameState, accusedId: string, voters: string[]): GameState {
  let d = rules.nominate(rules.startDay(s), accusedId);
  const nom = d.nominations[0];
  d = rules.setVoters(d, nom.id, voters);
  return rules.executeNomination(d, nom.id);
}

const featsOf = (s: GameState, playerId: string, kind?: Feat['kind']) => s.feats.filter((f) => f.playerId === playerId && (!kind || f.kind === kind));
const scoreOf = (board: { ranking: PlayerScore[] }, id: string) => board.ranking.find((r) => r.player.id === id)!;

describe('role value', () => {
  it('runs from 3 to 9 with what the card is worth to its own team', () => {
    // Village cards that help the Werewolves on balance are worth less than a plain Villager.
    expect(roleValue('cupid')).toBe(3);
    expect(roleValue('cursed')).toBe(3);
    expect(roleValue('troublemaker')).toBe(3);
    expect(roleValue('doppelganger')).toBe(3);
    expect(roleValue('pacifist')).toBe(4);
    expect(roleValue('villager')).toBe(5);
    expect(roleValue('mayor')).toBe(5);
    // The same weight the other way round is worth twice as much: a +3 Bodyguard against a −3 Cupid.
    expect(roleValue('bodyguard')).toBe(6);
    expect(roleValue('seer')).toBe(8);
    // Werewolf cards are worth their strength to the pack.
    expect(roleValue('sorceress')).toBe(6);
    expect(roleValue('werewolf')).toBe(7);
    expect(roleValue('wolfCub')).toBe(8);
    expect(roleValue('bigBadWolf')).toBe(9);
    expect(roleValue('vampire')).toBe(8);
  });

  it('treats roles with no power as plain voters', () => {
    expect(isPlainRole('villager')).toBe(true);
    expect(isPlainRole('mason')).toBe(true);
    expect(isPlainRole('minion')).toBe(true);
    expect(isPlainRole('seer')).toBe(false);
    expect(isPlainRole('hunter')).toBe(false);
    expect(isPlainRole('werewolf')).toBe(false);
  });

  it('makes the moderator’s pick grow with the game: +10 after 5 rounds, up to 12', () => {
    expect(pickPoints(1)).toBe(6);
    expect(pickPoints(3)).toBe(8);
    expect(pickPoints(5)).toBe(10);
    expect(pickPoints(7)).toBe(12);
    expect(pickPoints(12)).toBe(12);
  });
});

describe('feats recorded by the rules engine', () => {
  const ROLES: RoleId[] = ['werewolf', 'werewolf', 'seer', 'bodyguard', 'villager', 'villager', 'villager', 'witch'];

  it('plays a whole game: saves, intel, shared pack kills, votes, payoff, poison and the MVP', () => {
    // Night 1: the pack goes for the Seer, the Bodyguard saves her; she inspects a wolf.
    let s = night(game(ROLES), { wolfTargets: ['p2'], bodyguardTarget: 'p2', seerTarget: 'p0' });
    expect(featsOf(s, 'p3', 'save')).toMatchObject([{ targetId: 'p2', via: 'bodyguard', against: 'ally', targetRole: 'seer' }]);
    expect(featsOf(s, 'p2', 'intel')).toMatchObject([{ targetId: 'p0', via: 'seer', found: true, against: 'enemy' }]);
    expect(featsOf(s, 'p0')).toEqual([]);

    // Night 2: two wolves share the kill of a Villager.
    s = night(quietDay(s), { wolfTargets: ['p4'] });
    expect(featsOf(s, 'p0', 'kill')).toMatchObject([{ targetId: 'p4', via: 'pack', shared: 2, against: 'enemy' }]);
    expect(featsOf(s, 'p1', 'kill')).toHaveLength(1);

    // Day 2: the exposed wolf is voted out; the other wolf votes against its packmate.
    s = voteOut(s, 'p0', ['p2', 'p3', 'p5', 'p6', 'p1']);
    expect(featsOf(s, 'p1', 'vote')).toMatchObject([{ targetId: 'p0', against: 'ally' }]);
    expect(featsOf(s, 'p2', 'payoff')).toMatchObject([{ targetId: 'p0' }]);

    // Night 3: the last wolf kills alone; the Witch poisons it. The Village wins at dawn.
    s = night(rules.startNight(s), { wolfTargets: ['p5'], witchKillTarget: 'p1' });
    expect(featsOf(s, 'p1', 'kill')).toMatchObject([{ targetId: 'p4' }, { targetId: 'p5' }]);
    expect(featsOf(s, 'p1', 'kill')[1]).not.toHaveProperty('shared');
    expect(featsOf(s, 'p7', 'kill')).toMatchObject([{ targetId: 'p1', via: 'witch', against: 'enemy' }]);
    expect(s.phase).toBe('gameOver');
    expect(s.winner?.team).toBe('village');

    const board = scoreGame(scoreInputOf(s));
    const total = (id: string) => scoreOf(board, id).total;
    // Seer: exposed +4, vote +3, payoff +2, win +8, alive +4.
    expect(total('p2')).toBe(21);
    // Bodyguard: saved the Seer +8, vote +3, win +8, alive +4.
    expect(total('p3')).toBe(23);
    // Witch: poisoned a Werewolf +7, win +8, alive +4.
    expect(total('p7')).toBe(19);
    // Plain Villagers' good votes are worth +4; P5 died, P6 survived.
    expect(total('p5')).toBe(12);
    expect(total('p6')).toBe(16);
    // Wolves: half a Villager each on night 2 (rounded up), the last one all of night 3's. Voting
    // out a packmate (cover) costs a wolf nothing.
    expect(total('p0')).toBe(3);
    expect(total('p1')).toBe(3 + 5);
    expect(board.mvpIds).toEqual(['p3']);
    expect(scoreOf(board, 'p3').byCategory).toMatchObject({ saves: 8, votes: 3, result: 12 });

    // The moderator's pick (3 rounds: +8) carries the leading Villager past the Bodyguard.
    s = gameReducer(s, { type: 'SET_MVP_PICK', playerId: 'p6' });
    const picked = scoreGame(scoreInputOf(s));
    expect(scoreOf(picked, 'p6').total).toBe(24);
    expect(picked.mvpIds).toEqual(['p6']);
    expect(picked.pickPoints).toBe(8);
  });

  it('gives a seduced inspector nothing, and the Lycan no wolf points', () => {
    let s = night(game(['werewolf', 'seer', 'hooker', 'villager', 'villager', 'villager']), { hookerTarget: 'p1', seerTarget: 'p0' });
    expect(featsOf(s, 'p1')).toEqual([]);
    s = night(game(['werewolf', 'seer', 'lycan', 'villager', 'villager', 'villager']), { seerTarget: 'p2' });
    expect(featsOf(s, 'p1')).toEqual([]);
    // A plain Villager seen as one is cleared: +1.
    s = night(game(['werewolf', 'seer', 'lycan', 'villager', 'villager', 'villager']), { seerTarget: 'p3' });
    expect(featsOf(s, 'p1', 'intel')).toMatchObject([{ found: false, against: 'ally' }]);
  });

  it('charges the Witch for poisoning a teammate', () => {
    const s = night(game(ROLES), { witchKillTarget: 'p2' });
    const board = scoreGame(scoreInputOf(s));
    expect(scoreOf(board, 'p7').lines).toContainEqual(expect.objectContaining({ key: 'score.kill.witch', points: -8, note: 'teammate' }));
    expect(scoreOf(board, 'p7').byCategory.kills).toBe(-8);
  });

  it('credits the Hooker who seduced the pack for the victim it spared', () => {
    const s = night(game(['werewolf', 'hooker', 'seer', 'villager', 'villager', 'villager']), { hookerTarget: 'p0', wolfTargets: ['p2'] });
    expect(s.players[2].alive).toBe(true);
    expect(featsOf(s, 'p1', 'save')).toMatchObject([{ targetId: 'p2', via: 'hooker' }]);
  });

  it('values saving Cupid below saving a Village role worth as much the other way', () => {
    const save = (target: RoleId) => {
      const s = night(game(['werewolf', 'bodyguard', target, 'villager', 'villager', 'villager']), { wolfTargets: ['p2'], bodyguardTarget: 'p2' });
      return scoreOf(scoreGame(scoreInputOf(s)), 'p1').byCategory.saves;
    };
    expect(save('cupid')).toBe(3);
    expect(save('hunter')).toBe(6);
    expect(save('seer')).toBe(8);
  });

  it('charges half the value for saving an enemy', () => {
    const saves = (s: GameState, id: string) => scoreOf(scoreGame(scoreInputOf(s)), id).lines.filter((l) => l.category === 'saves');
    // The Leprechaun moves the pack's attack onto the Big Bad Wolf (9), whom the Bodyguard protects.
    let s = night(game(['villager', 'bigBadWolf', 'werewolf', 'leprechaun', 'bodyguard', 'villager', 'villager']), {
      wolfTargets: ['p0'],
      leprechaunMove: 'left',
      bodyguardTarget: 'p1',
    });
    expect(s.players[1].alive).toBe(true);
    expect(saves(s, 'p4')).toMatchObject([{ points: -5, note: 'enemy' }]);
    // The Priest blesses the Big Bad Wolf the Witch poisons.
    s = night(game(['bigBadWolf', 'werewolf', 'witch', 'priest', 'villager', 'villager', 'villager']), { witchKillTarget: 'p0', priestTarget: 'p0' });
    expect(saves(s, 'p3')).toMatchObject([{ points: -5, note: 'enemy' }]);
    // A Werewolf (7) costs 4; saving a teammate is still worth all of it.
    expect(featPoints({ kind: 'save', round: 1, phase: 'night', playerId: 'x', actorRole: 'bodyguard', targetRole: 'werewolf', against: 'enemy' })).toBe(-4);
    expect(featPoints({ kind: 'save', round: 1, phase: 'night', playerId: 'x', actorRole: 'bodyguard', targetRole: 'seer', against: 'ally' })).toBe(8);
  });

  it('gives nothing for a reading the cards made wrong: the Wolf Man looks innocent, the Lycan guilty', () => {
    const intel = (roles: RoleId[], a: Partial<GameState['nightActions']>, id: string) => featsOf(night(game(roles), a), id, 'intel');
    // The Seer sees the Wolf Man as a Villager and the Lycan as a Werewolf: no points either way.
    expect(intel(['wolfMan', 'seer', 'villager', 'villager', 'villager', 'villager'], { seerTarget: 'p0' }, 'p1')).toEqual([]);
    expect(intel(['werewolf', 'seer', 'lycan', 'villager', 'villager', 'villager'], { seerTarget: 'p2' }, 'p1')).toEqual([]);
    // The Aura Seer reads the Wolf Man as not ordinary: an enemy found. The Lycan is a teammate
    // who isn't ordinary either: nothing.
    expect(intel(['wolfMan', 'auraSeer', 'villager', 'villager', 'villager', 'villager'], { auraSeerTarget: 'p0' }, 'p1')).toMatchObject([{ found: true, against: 'enemy' }]);
    expect(intel(['werewolf', 'auraSeer', 'lycan', 'villager', 'villager', 'villager'], { auraSeerTarget: 'p2' }, 'p1')).toEqual([]);
    // The P.I. smells a wolf next to the Lycan, but there's none: nothing.
    expect(intel(['villager', 'lycan', 'villager', 'pi', 'werewolf', 'villager', 'villager'], { piTarget: 'p1' }, 'p3')).toEqual([]);
  });

  it('values turning the Cursed, and saving them from it, as a Werewolf', () => {
    // One Villager fewer and one Werewolf more: worth a Werewolf (7), not the Cursed's own 3.
    let s = night(game(['werewolf', 'cursed', 'villager', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] });
    expect(scoreOf(scoreGame(scoreInputOf(s)), 'p0').byCategory.kills).toBe(7);
    s = night(game(['werewolf', 'cursed', 'bodyguard', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'], bodyguardTarget: 'p1' });
    expect(featsOf(s, 'p2', 'save')).toMatchObject([{ targetRole: 'cursed', turning: true }]);
    expect(scoreOf(scoreGame(scoreInputOf(s)), 'p2').byCategory.saves).toBe(7);
    // The Witch's poison would have killed them, not turned them: the Priest saved a Cursed (3).
    s = night(game(['werewolf', 'cursed', 'priest', 'witch', 'villager', 'villager']), { priestTarget: 'p1', witchKillTarget: 'p1' });
    expect(featsOf(s, 'p2', 'save')[0]).not.toHaveProperty('turning');
    expect(scoreOf(scoreGame(scoreInputOf(s)), 'p2').byCategory.saves).toBe(3);
  });

  it('credits the pack for turning the Cursed, the Diseased for the lost night and the Tough Guy once', () => {
    let s = night(game(['werewolf', 'cursed', 'villager', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] });
    expect(featsOf(s, 'p0')).toMatchObject([{ kind: 'convert', targetId: 'p1', targetRole: 'cursed', against: 'enemy' }]);

    s = night(game(['werewolf', 'diseased', 'villager', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] });
    expect(featsOf(s, 'p0', 'kill')).toHaveLength(1);
    expect(featsOf(s, 'p1')).toMatchObject([{ kind: 'diseased' }]);

    s = night(game(['werewolf', 'toughGuy', 'villager', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] });
    expect(s.players[1].alive).toBe(true);
    expect(featsOf(s, 'p0', 'kill')).toMatchObject([{ targetId: 'p1', targetRole: 'toughGuy' }]);
    expect(featsOf(s, 'p1')).toMatchObject([{ kind: 'toughGuy' }]);
    // He dies after the next night; the pack isn't credited twice.
    s = night(quietDay(s), {});
    expect(s.players[1].alive).toBe(false);
    expect(featsOf(s, 'p0', 'kill')).toHaveLength(1);
  });

  it('gives the Leprechaun the wolf it moved the attack onto', () => {
    // P1 and P5 hunt P0; the Leprechaun moves it left (the next seat clockwise), onto P1.
    const s = night(game(['villager', 'werewolf', 'leprechaun', 'villager', 'villager', 'werewolf', 'villager']), {
      wolfTargets: ['p0'],
      leprechaunMove: 'left',
    });
    expect(s.players[0].alive).toBe(true);
    expect(s.players[1].alive).toBe(false);
    expect(featsOf(s, 'p2', 'kill')).toMatchObject([{ targetId: 'p1', via: 'leprechaun', against: 'enemy' }]);
    expect(featsOf(s, 'p5')).toEqual([]);
  });

  it('credits the Hunter’s shot and the Vampire’s bite', () => {
    let s = night(game(['werewolf', 'hunter', 'villager', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] });
    s = rules.resolveHunterShot(s, s.pendingTriggers[0].id, 'p0');
    expect(featsOf(s, 'p1', 'kill')).toMatchObject([{ targetId: 'p0', via: 'hunter', against: 'enemy' }]);

    s = night(game(['vampire', 'villager', 'villager', 'villager', 'villager']), { vampireTarget: 'p1' });
    s = rules.nominate(rules.startDay(s), 'p2');
    expect(s.players[1].alive).toBe(false);
    expect(featsOf(s, 'p0', 'kill')).toMatchObject([{ targetId: 'p1', via: 'vampire' }]);
  });

  it('credits the reworked Tanner only for the enemies he takes down', () => {
    let s = night(game(['werewolf', 'tanner', 'villager', 'villager', 'villager', 'villager', 'werewolf'], { tanner: true }), { wolfTargets: ['p1'] });
    expect(featsOf(s, 'p1', 'kill')).toMatchObject([{ targetId: 'p0', via: 'tanner', against: 'enemy' }]);
    expect(featsOf(s, 'p0')).toEqual([]);

    s = night(game(['werewolf', 'tanner', 'bodyguard', 'villager', 'villager', 'villager'], { tanner: true }), { bodyguardTarget: 'p1' });
    const board = scoreGame(scoreInputOf(s));
    expect(featsOf(s, 'p1', 'kill')).toMatchObject([{ targetId: 'p2', against: 'ally' }]);
    // The Bodyguard chose to touch him: no points either way for the Tanner.
    expect(scoreOf(board, 'p1').byCategory.kills).toBe(0);
    expect(scoreOf(board, 'p1').lines.some((l) => l.category === 'kills')).toBe(false);
  });

  it('records the Prince’s reveal, escapes from a vote, and leaves the Village Idiot’s forced vote out', () => {
    let s = night(game(['werewolf', 'prince', 'villageIdiot', 'villager', 'villager', 'villager']), {});
    s = rules.nominate(rules.startDay(s), 'p1');
    expect(featsOf(s, 'p1')).toMatchObject([{ kind: 'prince' }]);

    // Only the Idiot's forced vote: no escape.
    s = night(game(['werewolf', 'villageIdiot', 'villager', 'villager', 'villager', 'villager']), {});
    let d = rules.nominate(rules.startDay(s), 'p3');
    d = rules.removeNomination(d, d.nominations[0].id);
    expect(featsOf(d, 'p3')).toEqual([]);
    // A real vote against them, and they walk away.
    d = rules.nominate(d, 'p4');
    d = rules.setVoters(d, d.nominations[0].id, ['p0']);
    d = rules.closeDayWithoutExecution(d);
    expect(featsOf(d, 'p4')).toMatchObject([{ kind: 'escape', round: 1, phase: 'day' }]);

    // An elimination by vote: the Idiot isn't credited or charged.
    d = voteOut(night(rules.startNight(d), {}), 'p0', ['p2', 'p3']);
    expect(featsOf(d, 'p1', 'vote')).toEqual([]);
    expect(featsOf(d, 'p2', 'vote')).toMatchObject([{ against: 'enemy' }]);
  });

  it('gives the Werewolf team less for its votes, and nothing off for voting out a packmate', () => {
    // Day 1: the pack (and the Minion) vote out a Villager; the wolf P1 then votes out its packmate P0.
    let s = voteOut(night(game(['werewolf', 'werewolf', 'minion', 'villager', 'villager', 'villager', 'villager', 'villager', 'seer']), {}), 'p3', ['p0', 'p1', 'p2', 'p4']);
    s = voteOut(night(rules.startNight(s), {}), 'p0', ['p1', 'p4', 'p5']);
    const board = scoreGame(scoreInputOf(s));
    const votes = (id: string) => scoreOf(board, id).byCategory.votes;
    expect(votes('p0')).toBe(2);
    // +2 for the Villager, 0 (and no line) for the packmate.
    expect(votes('p1')).toBe(2);
    expect(scoreOf(board, 'p1').lines.filter((l) => l.category === 'votes')).toHaveLength(1);
    // The Minion has no power of its own, but knows the wolves: no plain-voter bonus.
    expect(votes('p2')).toBe(2);
    // A Villager: −2 for a teammate, +4 for a wolf.
    expect(votes('p4')).toBe(-2 + 4);
  });

  it('scores a mixed couple as its own team, from the moment Cupid links them', () => {
    // An, Bình: Werewolves · Chi: Seer · Dũng: Cupid · Giang, Hà, Linh: Villagers · Khoa: Witch.
    const names = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Khoa', 'Linh'];
    const dealt = game(['werewolf', 'werewolf', 'seer', 'cupid', 'villager', 'villager', 'witch', 'villager']);
    let s: GameState = { ...dealt, players: dealt.players.map((p, i) => ({ ...p, name: names[i] })) };
    // Night 1: Cupid links Bình (Werewolf) and Giang (Villager): the Couple. The pack kills Hà;
    // the Seer sees Bình as a Werewolf.
    s = night(s, { cupidTargets: ['p1', 'p4'], wolfTargets: ['p5'], seerTarget: 'p1' });
    expect(rules.sideOf(s, s.players[1])).toBe('couple');
    expect(rules.sideOf(s, s.players[4])).toBe('couple');
    // Day 1: An is voted out, Bình and Giang among the voters.
    s = voteOut(s, 'p0', ['p2', 'p3', 'p4', 'p1', 'p7']);
    // Night 2: Bình, the last wolf, kills the Seer. Day 2: Linh is voted out (Dũng votes with the Couple).
    s = night(rules.startNight(s), { wolfTargets: ['p2'] });
    s = voteOut(s, 'p7', ['p1', 'p4', 'p3']);
    // Night 3: Bình kills Cupid; the Witch holds her potions. Day 3: the Couple votes out the Witch.
    s = night(rules.startNight(s), { wolfTargets: ['p3'] });
    s = voteOut(s, 'p6', ['p1', 'p4']);
    expect(s.winner).toEqual({ team: 'couple', winnerIds: ['p1', 'p4'] });

    const board = scoreGame(scoreInputOf(s));
    const total = (id: string) => scoreOf(board, id).total;
    // Bình: the pack's kill on night 1 (shared with An), voting out his old packmate as an enemy
    // (+2: still a Werewolf's vote), kills alone on nights 2 (the Seer, 8) and 3 (Cupid, 3: his
    // card helps the Werewolves on balance), two more votes, win, alive.
    expect(scoreOf(board, 'p1').lines.map((l) => l.points)).toEqual([3, 2, 8, 2, 3, 2, 8, 4]);
    expect(total('p1')).toBe(32);
    // Giang: a plain voter on the Couple's side: every elimination was an enemy.
    expect(total('p4')).toBe(4 + 4 + 4 + 8 + 4);
    // The Seer exposed Bình: an enemy of the Village once he joined the Couple.
    expect(featsOf(s, 'p2', 'intel')).toMatchObject([{ targetId: 'p1', found: true, against: 'enemy' }]);
    // Cupid plays for the Village, so the Couple's win isn't his; voting out Linh cost him.
    expect(total('p3')).toBe(3 - 2);
    expect(board.mvpIds).toEqual(['p1']);
    // Only the lovers can be picked.
    expect(gameReducer(s, { type: 'SET_MVP_PICK', playerId: 'p3' })).toBe(s);
    expect(gameReducer(s, { type: 'SET_MVP_PICK', playerId: 'p4' }).mvpPick).toBe('p4');
  });

  it('charges every voter who hands the standard Tanner his win', () => {
    const s = voteOut(night(game(['werewolf', 'tanner', 'villager', 'villager', 'villager']), {}), 'p1', ['p0', 'p2']);
    expect(s.winner?.team).toBe('tanner');
    const board = scoreGame(scoreInputOf(s));
    expect(scoreOf(board, 'p2').lines).toContainEqual(expect.objectContaining({ key: 'score.vote', points: -2, note: 'tanner' }));
    expect(board.mvpIds).toEqual(['p1']);
  });
});

describe('the MVP award', () => {
  const finished = () => {
    const s = night(game(['werewolf', 'villager', 'villager']), { wolfTargets: ['p1'] });
    expect(s.phase).toBe('gameOver');
    return s;
  };

  it('stamps the end of the game and waits for the moderator’s pick', () => {
    const done = gameReducer({ ...game(['werewolf', 'villager', 'villager']), nightActions: { ...rules.emptyNightActions(), wolfTargets: ['p1'] } }, { type: 'RESOLVE_NIGHT' });
    expect(done.phase).toBe('gameOver');
    expect(done.finishedAt).toEqual(expect.any(Number));
    expect(done.recordedAt).toBeNull();
    expect(done.mvpPick).toBeUndefined();
  });

  it('takes one pick, once the game is over, from the winning side', () => {
    const live = game(['werewolf', 'villager', 'villager', 'villager']);
    expect(gameReducer(live, { type: 'SET_MVP_PICK', playerId: 'p1' })).toBe(live);
    // The Werewolf won; the Villagers lost.
    const s = { ...finished(), recordedAt: 123 };
    expect(s.winner?.winnerIds).toEqual(['p0']);
    expect(gameReducer(s, { type: 'SET_MVP_PICK', playerId: 'nobody' })).toBe(s);
    expect(gameReducer(s, { type: 'SET_MVP_PICK', playerId: 'p2' })).toBe(s);
    const picked = gameReducer(s, { type: 'SET_MVP_PICK', playerId: 'p0' });
    expect(picked.mvpPick).toBe('p0');
    // Written to History again, with the pick.
    expect(picked.recordedAt).toBeNull();
    // Final: the scores are out, so it can't be changed or withdrawn.
    expect(gameReducer(picked, { type: 'SET_MVP_PICK', playerId: null })).toBe(picked);
    expect(gameReducer(s, { type: 'SET_MVP_PICK', playerId: null }).mvpPick).toBeNull();
  });

  it('has no pick after a draw, and ignores a pick from the losing side', () => {
    const draw = { ...finished(), winner: { team: 'draw' as const, winnerIds: [] } };
    expect(gameReducer(draw, { type: 'SET_MVP_PICK', playerId: 'p0' })).toBe(draw);
    expect(gameReducer(draw, { type: 'SET_MVP_PICK', playerId: null }).mvpPick).toBeNull();
    // A record carrying a pick off the winning side scores no bonus.
    const board = scoreGame({ ...scoreInputOf(finished()), pick: 'p2' });
    expect(scoreOf(board, 'p2').picked).toBe(false);
    expect(scoreOf(board, 'p2').byCategory.pick).toBe(0);
  });

  it('keeps the pick, once made, through a revive and the game ending again', () => {
    let s = gameReducer(finished(), { type: 'SET_MVP_PICK', playerId: 'p0' });
    expect(s.mvpPick).toBe('p0');
    s = gameReducer(s, { type: 'REVIVE', playerId: 'p1' });
    expect(s.phase).toBe('day');
    s = gameReducer(s, { type: 'MOD_ELIMINATE', playerId: 'p1' });
    expect(s.phase).toBe('gameOver');
    expect(s.mvpPick).toBe('p0');
    expect(gameReducer(s, { type: 'SET_MVP_PICK', playerId: null })).toBe(s);
  });

  it('keeps the pick through Undo, so it can never be made twice', () => {
    // Day 1: a Villager is voted out, and the Werewolf wins.
    const day = rules.nominate(rules.startDay(night(game(['werewolf', 'villager', 'villager', 'villager']), { wolfTargets: ['p1'] })), 'p2');
    let h: History = { past: [], present: day };
    h = historyReducer(h, { type: 'EXECUTE', nominationId: day.nominations[0].id });
    expect(h.present.phase).toBe('gameOver');
    h = historyReducer(h, { type: 'SET_MVP_PICK', playerId: 'p0' });
    // Undo goes back to the vote, with the pick kept.
    h = historyReducer(h, { type: 'UNDO' });
    expect(h.present.phase).toBe('day');
    expect(h.present.mvpPick).toBe('p0');
    h = historyReducer(h, { type: 'EXECUTE', nominationId: h.present.nominations[0].id });
    expect(h.present.phase).toBe('gameOver');
    expect(h.present.mvpPick).toBe('p0');
    expect(historyReducer(h, { type: 'SET_MVP_PICK', playerId: null })).toBe(h);
    // A new game starts without one; undoing back to this game finds it again.
    const next = historyReducer(h, { type: 'NEW_GAME' });
    expect(next.present.mvpPick).toBeUndefined();
    expect(historyReducer(next, { type: 'UNDO' }).present.mvpPick).toBe('p0');
  });

  it('scores a History record exactly like the finished game', () => {
    const s = gameReducer(finished(), { type: 'SET_MVP_PICK', playerId: 'p0' });
    const record = buildGameRecord(s)!;
    expect(record.mvpPick).toBe('p0');
    expect(record.players.every((p) => p.id)).toBe(true);
    const live = scoreGame(scoreInputOf(s));
    expect(recordScoreBoard(record)).toEqual(live);
    // Before the moderator decides, the record has no pick at all.
    expect('mvpPick' in buildGameRecord(finished())!).toBe(false);
  });

  it('scores a game from before v1.4.0 from its timeline, with no moderator\u2019s pick', () => {
    const s = gameReducer(finished(), { type: 'SET_MVP_PICK', playerId: 'p0' });
    // As older versions recorded it: no feats, no ids, no pick.
    const { feats: _feats, mvpPick: _pick, ...rest } = buildGameRecord(s)!;
    const legacy = { ...rest, players: rest.players.map(({ id: _id, ...p }) => p) };
    const board = recordScoreBoard(legacy)!;
    expect(board.fromTimeline).toBe(true);
    const live = scoreGame({ ...scoreInputOf(s), pick: null });
    expect(board.ranking.map((r) => [r.player.name, r.total])).toEqual(live.ranking.map((r) => [r.player.name, r.total]));
    expect(board.ranking.some((r) => r.picked)).toBe(false);
    expect(board.mvpIds).toEqual(['seat-0']);
  });

  it('shares the award on an exact tie, after the winning side', () => {
    const players = ['a', 'b', 'c'].map((id, seat) => ({ id, name: id, seat, roleId: 'villager' as RoleId, alive: true }));
    const vote = (playerId: string): Feat => ({ kind: 'vote', round: 1, phase: 'day', playerId, actorRole: 'villager', targetId: 'c', targetRole: 'werewolf', against: 'enemy' });
    const tie = scoreGame({ players, winnerIds: [], feats: [vote('a'), vote('b')], rounds: 1 });
    expect(tie.mvpIds).toEqual(['a', 'b']);
    expect(standings(tie.ranking)).toEqual([1, 1, 3]);
    // Same total (two good votes and survival, against a win and survival), but only one of
    // them won: the winner takes it.
    const won = scoreGame({ players, winnerIds: ['b'], feats: [vote('a'), vote('a')], rounds: 1 });
    expect(scoreOf(won, 'a').total).toBe(12);
    expect(scoreOf(won, 'b').total).toBe(12);
    expect(won.mvpIds).toEqual(['b']);
    // Nobody above zero: no MVP.
    const fallen = players.map((p) => ({ ...p, alive: false }));
    expect(scoreGame({ players: fallen, winnerIds: [], feats: [], rounds: 1 }).mvpIds).toEqual([]);
  });

  it('starts older saved games with no feats', () => {
    const { feats: _feats, ...old } = game(['werewolf', 'villager', 'villager']);
    expect(normalizeGameState(old as GameState).feats).toEqual([]);
  });
});

describe('MVP hall of fame', () => {
  /** A finished game (the Werewolf in seat 0 wins and is the MVP) with these names in seats 0–2. */
  const played = (names: string[]) => {
    const dealt = game(['werewolf', 'villager', 'villager']);
    const s = night({ ...dealt, id: names.join('-'), players: dealt.players.map((p, i) => ({ ...p, name: names[i] })) }, { wolfTargets: ['p1'] });
    return buildGameRecord(s)!;
  };

  it('counts awards by name across games, older games included', () => {
    const first = played(['An', 'Bình', 'Chi']);
    const second = played([' an ', 'Bình', 'Dũng']);
    // Recorded before v1.4.0: scored from its timeline.
    const { feats: _feats, ...legacy } = played(['Chi', 'Bình', 'An']);
    expect(mvpNames(first)).toEqual(['An']);
    expect(mvpNames(legacy)).toEqual(['Chi']);

    // Newest first, as History lists them.
    const tallies = tallyMvps([second, first, legacy]);
    expect(tallies[0]).toEqual({ name: 'an', awards: 2, games: 3 });
    expect(tallies[1]).toEqual({ name: 'Chi', awards: 1, games: 2 });
    expect(tallies.find((m) => m.name === 'Bình')).toEqual({ name: 'Bình', awards: 0, games: 3 });
    expect(historyRecords([second, first, legacy]).mostMvps).toMatchObject({ value: 2, entries: [{ name: 'an' }], tied: 1 });
    // A timeline that can't be replayed to the recorded result isn't scored.
    expect(mvpNames({ ...legacy, players: legacy.players.map((p) => ({ ...p, alive: true })) })).toEqual([]);
  });
});

describe('score lines', () => {
  it('have a translation for every play the engine can record', () => {
    const keys = [
      ...['pack', 'bigBadWolf', 'witch', 'hunter', 'hunterLink', 'vampire', 'virginia', 'tanner', 'leprechaun'].map((via) => `score.kill.${via}`),
      'score.convert.cursed',
      'score.convert.cult',
      ...['bodyguard', 'witch', 'priest', 'hooker'].map((via) => `score.save.${via}`),
      ...['seer', 'auraSeer', 'pi'].flatMap((via) => [`score.intel.${via}.found`, `score.intel.${via}.cleared`]),
      'score.intel.sorceress.found',
      ...['payoff', 'vote', 'escape', 'diseased', 'toughGuy', 'prince', 'win', 'alive', 'pick'].map((k) => `score.${k}`),
      ...['teammate', 'tanner', 'enemy'].map((n) => `score.note.${n}`),
    ];
    const feat = (kind: Feat['kind'], via?: Feat['via'], found?: boolean): Feat => ({ kind, via, found, round: 1, phase: 'night', playerId: 'x', actorRole: 'villager' });
    expect(keys).toContain(featLineKey(feat('convert', 'pack')));
    expect(keys).toContain(featLineKey(feat('intel', 'pi', false)));
    for (const dict of [dictionaries.en, dictionaries.vi] as Record<string, string>[]) {
      for (const key of keys) expect(dict[key], key).toEqual(expect.any(String));
    }
  });
});
