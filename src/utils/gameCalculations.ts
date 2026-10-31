import type {
  BalanceOptions,
  ExperienceLevel,
  GameLogEntry,
  GameRecord,
  GameRecordPlayer,
  GameState,
  Player,
  PlayerStatus,
  RebalanceRules,
  RoleId,
  SetupDraft,
  WinTeam,
} from '../@types/game';
import { nightWake, ROLES, ROLE_ORDER } from '../data/roles';

/**
 * Target deck weight per experience level.
 * Veterans read the table well, so the deck tilts slightly toward the wolves;
 * new groups get a forgiving, village-leaning deck.
 */
/**
 * Highest role difficulty the auto-balancer draws for each table. Third-party teams
 * (Tanner, Lone Wolf, Vampires, Cult) are difficulty 3, so they only appear for veterans.
 */
export const EXPERIENCE_MAX_DIFFICULTY: Record<ExperienceLevel, 1 | 2 | 3> = {
  beginner: 1,
  standard: 2,
  veteran: 3,
};

export const EXPERIENCE_TARGET: Record<ExperienceLevel, number> = {
  beginner: 2,
  standard: 0,
  veteran: -2,
};

/** Within this distance of the target a deck is called balanced. */
export const BALANCE_TOLERANCE = 2;

/** Auto-balance deals any deck within this distance of the target (e.g. −1 to +1 for 0). */
export const AUTO_BALANCE_TOLERANCE = 1;

/** Percent of the seats an auto-balanced deck must change from the last game's (at least one card). */
export const MIN_DECK_CHANGE_PERCENT = 10;

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 30;

// ---------------------------------------------------------------------------
// Randomness
// ---------------------------------------------------------------------------

/** Uniform float in [0,1) — crypto-backed when available so deals can't be predicted. */
export function secureRandom(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random();
}

/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], random: () => number = secureRandom): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickOne<T>(items: readonly T[], random: () => number = secureRandom): T {
  return items[Math.floor(random() * items.length)];
}

export function createId(prefix = 'id'): string {
  const rand = Math.floor(secureRandom() * 36 ** 6).toString(36).padStart(6, '0');
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

// ---------------------------------------------------------------------------
// Balance weights
// ---------------------------------------------------------------------------

export function calculateBalance(deck: readonly RoleId[]): number {
  return deck.reduce((sum, id) => sum + ROLES[id].weight, 0);
}

export type BalanceVerdict = 'village' | 'balanced' | 'wolves';

export function balanceVerdict(sum: number, target = 0): BalanceVerdict {
  const delta = sum - target;
  if (delta > BALANCE_TOLERANCE) return 'village';
  if (delta < -BALANCE_TOLERANCE) return 'wolves';
  return 'balanced';
}

/** Auto-balance keeps Villagers strictly below half the table (e.g. at most 4 of 10). */
export const maxAutoVillagers = (playerCount: number): number => Math.max(0, Math.ceil(playerCount / 2) - 1);

/** Roughly one wolf per 4–5 players, never a majority. */
export function suggestedWolfCount(playerCount: number): number {
  const raw = Math.max(1, Math.round(playerCount / 4.5));
  return Math.min(raw, Math.max(1, Math.floor((playerCount - 1) / 2)));
}

export function countRoles(deck: readonly RoleId[]): Partial<Record<RoleId, number>> {
  const counts: Partial<Record<RoleId, number>> = {};
  for (const id of deck) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/** Sort a deck into catalogue order for stable display. */
export function sortDeck(deck: readonly RoleId[]): RoleId[] {
  return [...deck].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
}

/** How many of `deck`'s cards `previous` doesn't have (copies counted): 0 for the same deck. */
export function deckChanges(deck: readonly RoleId[], previous: readonly RoleId[]): number {
  const left = countRoles(previous);
  let kept = 0;
  for (const id of deck) {
    if ((left[id] ?? 0) > 0) {
      left[id]! -= 1;
      kept += 1;
    }
  }
  return deck.length - kept;
}

/** Cards an auto-balanced deck must change from the last game's: 10% of the seats, at least one. */
export const minDeckChanges = (playerCount: number): number => Math.max(1, Math.ceil((playerCount * MIN_DECK_CHANGE_PERCENT) / 100));

export interface DeckIssue {
  key: string;
  params?: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Team limit: Village, Werewolves and at most one extra team
// ---------------------------------------------------------------------------

/**
 * The extra team a role brings besides Village and Werewolves: Cupid may form The Couple,
 * and Vampires, the Cult Leader and the standard-rules Tanner are teams of their own. The
 * Lone Wolf counts with the Werewolves; the reworked Tanner is a Villager.
 */
export function extraTeamOf(id: RoleId, rules?: Partial<RebalanceRules> | null): WinTeam | null {
  switch (id) {
    case 'cupid':
      return 'couple';
    case 'vampire':
      return 'vampire';
    case 'cultLeader':
      return 'cult';
    case 'tanner':
      return rules?.tanner ? null : 'tanner';
    default:
      return null;
  }
}

/** The extra teams a deck could bring into play. A game allows at most one. */
export const extraTeams = (deck: readonly RoleId[], rules?: Partial<RebalanceRules> | null): WinTeam[] => [
  ...new Set(deck.map((id) => extraTeamOf(id, rules)).filter((t): t is WinTeam => !!t)),
];

/** True when adding this role would bring a second extra team (a fourth team) into the deck. */
export function addsTeam(deck: readonly RoleId[], id: RoleId, rules?: Partial<RebalanceRules> | null): boolean {
  const team = extraTeamOf(id, rules);
  const current = extraTeams(deck, rules);
  return !!team && current.length > 0 && !current.includes(team);
}

/** Structural problems that would make a deck unplayable. */
export function validateDeck(deck: readonly RoleId[], playerCount: number, rules?: Partial<RebalanceRules> | null): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const counts = countRoles(deck);
  if (deck.length !== playerCount) {
    issues.push({ key: 'issue.deckSize', params: { cards: deck.length, players: playerCount } });
  }
  const wolves = deck.filter((id) => ROLES[id].isWolf).length;
  const threats = wolves + (counts.vampire ?? 0);
  if (threats === 0) issues.push({ key: 'issue.noThreat' });
  if (threats * 2 >= playerCount && playerCount > 0) issues.push({ key: 'issue.tooManyThreats' });
  if (counts.loneWolf && wolves < 2) issues.push({ key: 'issue.loneWolfAlone' });
  if (counts.mason === 1) issues.push({ key: 'issue.masonAlone' });
  if (counts.apprenticeSeer && !counts.seer) issues.push({ key: 'issue.apprenticeNoSeer' });
  if (extraTeams(deck, rules).length > 1) issues.push({ key: 'issue.tooManyTeams' });
  for (const [id, n] of Object.entries(counts) as [RoleId, number][]) {
    if (n > ROLES[id].maxCopies) issues.push({ key: 'issue.tooManyCopies', params: { role: id } });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Auto-balancer
// ---------------------------------------------------------------------------

function isValidDraft(deck: RoleId[], wolfCount: number, rules?: Partial<RebalanceRules> | null): boolean {
  const counts = countRoles(deck);
  for (const [id, n] of Object.entries(counts) as [RoleId, number][]) {
    if (n > ROLES[id].maxCopies) return false;
  }
  const wolves = deck.filter((id) => ROLES[id].isWolf);
  if (wolves.length !== wolfCount) return false;
  if (!counts.werewolf) return false; // the pack needs at least one plain Werewolf
  if (counts.loneWolf && wolves.length < 2) return false;
  if (counts.mason === 1) return false; // Masons come in groups
  if (counts.apprenticeSeer && !counts.seer) return false;
  if (extraTeams(deck, rules).length > 1) return false; // at most three teams
  return true;
}

type MixTest = (id: RoleId, rules?: Partial<RebalanceRules> | null) => boolean;

/** A test only special roles pass, so the plain Villager and Werewolf never fill it. */
const special =
  (test: MixTest): MixTest =>
  (id, rules) =>
    id !== 'villager' && id !== 'werewolf' && test(id, rules);

/**
 * The mix the auto-balancer aims for, highest priority first. Tier 1: a plain Villager and a
 * plain Werewolf. Tier 2: special roles that wake every night, on night 1 only, and never.
 * Tier 3: a Werewolf-team role with an ability, and roles that kill, protect and inspect.
 * Tiers 2 and 3 look past the plain Villager and Werewolf, which would fill them trivially.
 */
export const DECK_MIX: readonly (readonly MixTest[])[] = [
  [(id) => id === 'villager', (id) => id === 'werewolf'],
  [
    special((id) => nightWake(id) === 'everyNight'),
    special((id) => nightWake(id) === 'firstNight'),
    special((id) => nightWake(id) === 'never'),
  ],
  [
    special((id) => ROLES[id].faction === 'werewolf'),
    // The reworked Tanner takes down whoever uses a night power on them.
    special((id, rules) => ROLES[id].abilities.includes('kill') || (id === 'tanner' && !!rules?.tanner)),
    special((id) => ROLES[id].abilities.includes('protect')),
    special((id) => ROLES[id].abilities.includes('info')),
  ],
];

/** How many of each tier's DECK_MIX slots the deck leaves empty. */
export function deckMixGaps(deck: readonly RoleId[], rules?: Partial<RebalanceRules> | null): number[] {
  const roles = [...new Set(deck)];
  return DECK_MIX.map((tier) => tier.filter((test) => !roles.some((id) => test(id, rules))).length);
}

/**
 * Generates a deck of `playerCount` roles drawn from `pool` whose weight sum lands within
 * AUTO_BALANCE_TOLERANCE of the experience target (every sum in that range is as good), and
 * that changes at least 10% of the seats from `previousDeck`, the last game's cards. Then it
 * fills as much of DECK_MIX as the pool allows (tier by tier), then uses more of the selected
 * special roles. Greedy seed + hill-climb; deterministic with `random`.
 */
export function generateBalancedDeck(options: BalanceOptions): RoleId[] {
  const random = options.random ?? secureRandom;
  const n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, options.playerCount));
  const target = EXPERIENCE_TARGET[options.experience];
  const wolfCount = Math.min(
    Math.max(1, options.wolfCount ?? suggestedWolfCount(n)),
    Math.max(1, Math.floor((n - 1) / 2)),
  );

  const maxDifficulty = EXPERIENCE_MAX_DIFFICULTY[options.experience];
  const pool = Array.from(new Set<RoleId>([...options.pool, 'villager', 'werewolf'])).filter(
    (id) => ROLES[id].difficulty <= maxDifficulty,
  );
  const wolfPool = pool.filter((id) => ROLES[id].isWolf);
  const specialPool = pool.filter((id) => !ROLES[id].isWolf && id !== 'villager');

  // Seed: plain wolves + the most informative specials, padded with villagers.
  const seed: RoleId[] = Array.from({ length: wolfCount }, () => 'werewolf' as RoleId);
  const villageSlots = n - wolfCount;
  const shuffled = shuffle(specialPool, random).sort((a, b) => (a === 'seer' ? -1 : b === 'seer' ? 1 : 0));
  // Only one extra team (Couple, Vampires, Cult or Tanner) may join Village and Werewolves.
  const extra = shuffled.map((id) => extraTeamOf(id, options.rules)).find((t) => !!t);
  const allowed = shuffled.filter((id) => {
    const team = extraTeamOf(id, options.rules);
    return !team || team === extra;
  });
  // Lead with one role for each DECK_MIX slot it can fill, in priority order.
  const lead: RoleId[] = [];
  for (const test of DECK_MIX.flat()) {
    if (lead.some((id) => test(id, options.rules))) continue;
    const pick = allowed.find((id) => test(id, options.rules));
    if (pick) lead.push(pick);
  }
  const prioritized = [...lead, ...allowed.filter((id) => !lead.includes(id))];
  // Enough specials to keep Villagers under half the table, when the pool allows it, and
  // room for at least one Villager.
  const villagerCap = maxAutoVillagers(n);
  const specials = Math.min(villageSlots - 1, Math.max(Math.ceil(villageSlots * 0.6), villageSlots - villagerCap));
  seed.push(...prioritized.slice(0, specials));
  while (seed.length < n) seed.push('villager');

  const previous = options.previousDeck ?? [];
  const changesNeeded = previous.length > 0 ? minDeckChanges(n) : 0;

  const score = (deck: RoleId[]): number => {
    const balance = Math.abs(calculateBalance(deck) - target);
    // The Seer anchors the village's information game, so dropping it costs extra.
    const missing = specialPool.reduce((n, id) => n + (deck.includes(id) ? 0 : id === 'seer' ? 4 : 1), 0);
    const villagers = deck.filter((id) => id === 'villager').length;
    const overCap = Math.max(0, villagers - villagerCap);
    const tooFamiliar = Math.max(0, changesNeeded - deckChanges(deck, previous));
    const [mix1, mix2, mix3] = deckMixGaps(deck, options.rules);
    // Each term outweighs everything after it: the villager cap (only exceeded if the pool
    // is too small), a balanced deck (any sum within tolerance), enough change from the last
    // game's deck (only missed if the pool allows no other balanced deck), the DECK_MIX tiers,
    // then more of the pool and fewer Villagers.
    return (
      overCap * 1e5 +
      Math.max(0, balance - AUTO_BALANCE_TOLERANCE) * 1e4 +
      tooFamiliar * 3000 +
      mix1 * 1000 +
      mix2 * 100 +
      mix3 * 10 +
      missing * 0.1 +
      villagers * 0.001
    );
  };

  const villagePicks = [...specialPool, 'villager'] as RoleId[];
  const mutate = (deck: RoleId[]) => {
    const slot = Math.floor(random() * n);
    deck[slot] = ROLES[deck[slot]].isWolf ? pickOne(wolfPool, random) : pickOne(villagePicks, random);
    // Masons come in groups: a lone one leaves too, or brings a partner.
    const masons = deck.flatMap((id, i) => (id === 'mason' ? [i] : []));
    if (masons.length !== 1) return;
    if (random() < 0.5) deck[masons[0]] = pickOne(villagePicks.filter((id) => id !== 'mason'), random);
    else {
      const others = deck.flatMap((id, i) => (!ROLES[id].isWolf && id !== 'mason' ? [i] : []));
      if (others.length) deck[pickOne(others, random)] = 'mason';
    }
  };

  let best = seed;
  let bestScore = score(best);
  // A few climbs from the seed, keeping the best: one can stall a swap short of a full mix.
  for (let climb = 0; climb < 6; climb++) {
    let current = seed;
    let currentScore = score(seed);
    for (let iter = 0; iter < 1000; iter++) {
      const candidate = [...current];
      mutate(candidate);
      // Two changes at once now and then, e.g. to swap in a missing role and rebalance.
      if (random() < 0.4) mutate(candidate);
      if (!isValidDraft(candidate, wolfCount, options.rules)) continue;
      const s = score(candidate);
      // Accept improvements, and sideways moves half the time to escape plateaus.
      if (s < currentScore || (s === currentScore && random() < 0.5)) {
        current = candidate;
        currentScore = s;
        if (s < bestScore) {
          best = candidate;
          bestScore = s;
        }
      }
    }
  }

  return sortDeck(best);
}

// ---------------------------------------------------------------------------
// Players step: seats and names
// ---------------------------------------------------------------------------

/** Two seats trade players. */
export function swapSeats<T>(seats: readonly T[], a: number, b: number): T[] {
  const out = [...seats];
  if (a !== b && a in out && b in out) [out[a], out[b]] = [out[b], out[a]];
  return out;
}

/** A new, empty seat right after seat `index`: everyone after it moves one seat along. */
export const insertSeat = (names: readonly string[], index: number): string[] => [...names.slice(0, index + 1), '', ...names.slice(index + 1)];

/** A name as compared for duplicates: case, spacing and Unicode composition aside. */
export const nameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase();

/** Names typed for more than one player, each as first typed. */
export function duplicateNames(names: readonly string[]): string[] {
  const seen = new Map<string, { name: string; count: number }>();
  for (const name of names) {
    const key = nameKey(name);
    if (!key) continue;
    const entry = seen.get(key) ?? { name: name.trim(), count: 0 };
    entry.count += 1;
    seen.set(key, entry);
  }
  return [...seen.values()].filter((e) => e.count > 1).map((e) => e.name);
}

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

export const EMPTY_STATUS: PlayerStatus = {
  protected: false,
  silenced: false,
  inCult: false,
  vampireMarked: false,
  princeRevealed: false,
  transformed: false,
  lover: false,
  banished: false,
  woundedRound: null,
};

/** Seats players with the given roles, in seat order. */
export function createPlayers(names: readonly string[], roles: readonly RoleId[]): Player[] {
  if (names.length !== roles.length) {
    throw new Error(`Cannot deal ${roles.length} cards to ${names.length} players`);
  }
  return names.map((name, seat) => ({
    id: createId('p'),
    name: name.trim() || `#${seat + 1}`,
    seat,
    roleId: roles[seat],
    originalRoleId: roles[seat],
    alive: true,
    status: { ...EMPTY_STATUS },
  }));
}

/** Randomly assigns the deck to seated players. */
export function dealRoles(names: readonly string[], deck: readonly RoleId[], random: () => number = secureRandom): Player[] {
  return createPlayers(names, shuffle(deck, random));
}

// ---------------------------------------------------------------------------
// Deal board (drag & drop): fixed player seats, plus a tray of undealt cards.
// ---------------------------------------------------------------------------

export interface DealState {
  /** Card in each seat, by seat index (null = empty). */
  slots: (RoleId | null)[];
  /** Cards not yet dealt, kept in catalogue order. */
  tray: RoleId[];
}

export type DealLocation = { kind: 'tray'; roleId: RoleId } | { kind: 'slot'; index: number } | { kind: 'trayZone' };

/** Every card back in the tray. */
export const emptyDeal = (seats: number, deck: readonly RoleId[]): DealState => ({
  slots: Array.from({ length: seats }, () => null),
  tray: sortDeck(deck),
});

/** Every seat filled at random. */
export const randomDeal = (deck: readonly RoleId[], random: () => number = secureRandom): DealState => ({
  slots: shuffle(deck, random),
  tray: [],
});

/**
 * Moves one card. Dropping on an occupied seat swaps: a tray card sends the occupant back
 * to the tray, a seated card trades places. Dropping a seated card on the tray unassigns it.
 * The multiset of cards (seats + tray) never changes.
 */
export function moveCard(state: DealState, from: DealLocation, to: DealLocation): DealState {
  const slots = [...state.slots];
  const tray = [...state.tray];
  const takeFromTray = (roleId: RoleId) => {
    const i = tray.indexOf(roleId);
    if (i < 0) return false;
    tray.splice(i, 1);
    return true;
  };

  if (from.kind === 'tray' && to.kind === 'slot') {
    if (!takeFromTray(from.roleId)) return state;
    const occupant = slots[to.index];
    slots[to.index] = from.roleId;
    if (occupant) tray.push(occupant);
  } else if (from.kind === 'slot' && to.kind === 'slot') {
    if (from.index === to.index || !slots[from.index]) return state;
    [slots[from.index], slots[to.index]] = [slots[to.index], slots[from.index]];
  } else if (from.kind === 'slot' && (to.kind === 'tray' || to.kind === 'trayZone')) {
    const card = slots[from.index];
    if (!card) return state;
    slots[from.index] = null;
    tray.push(card);
  } else {
    return state;
  }
  return { slots, tray: sortDeck(tray) };
}

/** True once every seat holds a card. */
export const dealComplete = (state: DealState): boolean => state.slots.every((r) => r !== null);

// ---------------------------------------------------------------------------
// Timeline formatting
// ---------------------------------------------------------------------------

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** "Night 2", "Day 2", "Setup"… — dawn events belong to the night that produced them. */
export function timelinePhaseLabel(entry: Pick<GameLogEntry, 'phase' | 'round'>, tx: Translate): string {
  switch (entry.phase) {
    case 'night':
    case 'dawn':
      return tx('phase.nightN', { round: entry.round });
    case 'day':
      return tx('phase.dayN', { round: entry.round });
    case 'setup':
      return tx('phase.setup');
    case 'gameOver':
      return tx('phase.gameOver');
  }
}

/** Renders a log entry, localising role and team ids at display time. */
export function formatTimelineEntry(entry: GameLogEntry, tx: Translate): string {
  const params: Record<string, string | number> = { ...entry.params };
  for (const key of ['role', 'role2', 'actorRole'] as const) {
    if (typeof params[key] === 'string') params[key] = tx(`role.${params[key]}.name`);
  }
  if (typeof params.team === 'string') params.team = tx(`team.${params.team}`);
  for (const key of PEOPLE_PARAMS) {
    if (typeof params[key] === 'number') params[key] = peopleLabel(params[key] as number, tx);
  }
  return tx(entry.key, params);
}

/** "4 people" / "1 person": who voted for an elimination (or, in logs before v1.1.0, who accused). */
const peopleLabel = (count: number, tx: Translate) => (count === 1 ? tx('log.accusersOne') : tx('log.accusers', { count }));

/** Params counting the people listed in an entry, and the heading of that list. */
const PEOPLE_PARAMS = ['voters', 'accusers'] as const;
const PEOPLE_TITLE = { voters: 'log.votersTitle', accusers: 'log.accusersTitle' } as const;

/**
 * A piece of a timeline line: plain text, a role / team name to tint in its team colour, or
 * a count of people listed on demand (a vote's voters).
 */
export interface TimelinePart {
  text: string;
  role?: RoleId;
  team?: WinTeam;
  people?: GameLogEntry['people'];
  /** Heading of the people list ("Voted by"). */
  peopleTitle?: (typeof PEOPLE_TITLE)[keyof typeof PEOPLE_TITLE];
}

const ROLE_PARAMS = new Set(['role', 'role2', 'actorRole']);

/** A log entry split around its role and team names, so they can be coloured. */
export function timelineParts(entry: GameLogEntry, tx: Translate): TimelinePart[] {
  const params = entry.params ?? {};
  // Without params the translation keeps its {placeholders}; odd chunks are their names.
  return tx(entry.key)
    .split(/\{(\w+)\}/)
    .map((chunk, i): TimelinePart => {
      if (i % 2 === 0) return { text: chunk };
      const value = params[chunk];
      if (value === undefined) return { text: `{${chunk}}` };
      if (ROLE_PARAMS.has(chunk) && typeof value === 'string' && value in ROLES) {
        return { text: tx(`role.${value}.name`), role: value as RoleId };
      }
      if (chunk === 'team' && typeof value === 'string') return { text: tx(`team.${value}`), team: value as WinTeam };
      if ((chunk === 'voters' || chunk === 'accusers') && typeof value === 'number') {
        return { text: peopleLabel(value, tx), people: entry.people ?? [], peopleTitle: PEOPLE_TITLE[chunk] };
      }
      return { text: String(value) };
    })
    .reduce<TimelinePart[]>((parts, part) => {
      // Plain text runs merge into one piece; only role and team names stand apart.
      const last = parts[parts.length - 1];
      if (!part.text) return parts;
      const plain = (p: TimelinePart) => !p.role && !p.team && !p.people;
      if (last && plain(last) && plain(part)) last.text += part.text;
      else parts.push(part);
      return parts;
    }, []);
}

export interface TimelineGroup {
  label: string;
  entries: GameLogEntry[];
}

/** Oldest first, grouped into consecutive phase blocks (Night 1 → Day 1 → Night 2…). */
export function groupTimeline(log: readonly GameLogEntry[], tx: Translate): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  for (const entry of log) {
    const label = timelinePhaseLabel(entry, tx);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** Snapshot of a finished game for the moderator's history. */
export function buildGameRecord(state: GameState): GameRecord | null {
  if (!state.winner) return null;
  const winners = new Set(state.winner.winnerIds);
  return {
    id: state.id,
    startedAt: new Date(state.createdAt).toISOString(),
    finishedAt: new Date().toISOString(),
    rounds: state.round,
    poolName: state.setup.poolName ?? null,
    pool: state.setup.pool,
    winner: state.winner.team,
    players: state.players.map((p) => ({
      name: p.name,
      seat: p.seat,
      roleId: p.roleId,
      originalRoleId: p.originalRoleId,
      alive: p.alive,
    })),
    winnerSeats: state.players.filter((p) => winners.has(p.id)).map((p) => p.seat),
    log: state.log,
  };
}

/**
 * "Start new game from lineup": the same names in the same seats, the same cards and pool,
 * placed on the Deal board with every card back in the tray, ready to re-deal.
 */
export function lineupSetup(record: GameRecord): Partial<SetupDraft> {
  return { ...lineupOf(record.players, record.pool), poolId: null, poolName: record.poolName };
}

/**
 * A game's lineup (names in seat order, the cards as dealt, the pool) on the Deal board, every
 * card back in the tray. Used by "Start new game from lineup" and by Rematch.
 */
export function lineupOf(
  players: readonly Pick<GameRecordPlayer, 'name' | 'seat' | 'originalRoleId'>[],
  pool: readonly RoleId[] = [],
): Pick<SetupDraft, 'names' | 'deck' | 'pool' | 'step' | 'deal'> {
  const seated = [...players].sort((a, b) => a.seat - b.seat);
  // The cards as dealt: a transformed Cursed or a sobered Drunk goes back to its own card.
  const deck = sortDeck(seated.map((p) => p.originalRoleId));
  // Games recorded before v1.1.0 have no pool: fall back to the roles that were dealt.
  return {
    names: seated.map((p) => p.name),
    deck,
    pool: [...new Set([...pool, ...deck])],
    step: 'deal',
    deal: emptyDeal(seated.length, deck),
  };
}

/**
 * A lineup the deck rules reject today (e.g. a fourth team, after the rules changed) opens on
 * the Deck step instead of the Deal board, where the problem is shown.
 */
export function checkLineup<T extends Partial<SetupDraft>>(setup: T, rules?: Partial<RebalanceRules> | null): T {
  const valid = validateDeck(setup.deck ?? [], setup.names?.length ?? 0, rules).length === 0;
  return valid ? setup : { ...setup, step: 'deck', deal: null };
}
