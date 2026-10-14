import type {
  BalanceOptions,
  ExperienceLevel,
  GameLogEntry,
  GameRecord,
  GameState,
  Player,
  PlayerStatus,
  RoleId,
} from '../@types/game';
import { ROLES, ROLE_ORDER } from '../data/roles';

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

export interface DeckIssue {
  key: string;
  params?: Record<string, string | number>;
}

/** Structural problems that would make a deck unplayable. */
export function validateDeck(deck: readonly RoleId[], playerCount: number): DeckIssue[] {
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
  for (const [id, n] of Object.entries(counts) as [RoleId, number][]) {
    if (n > ROLES[id].maxCopies) issues.push({ key: 'issue.tooManyCopies', params: { role: id } });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Auto-balancer
// ---------------------------------------------------------------------------

function isValidDraft(deck: RoleId[], wolfCount: number): boolean {
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
  return true;
}

/**
 * Generates a deck of `playerCount` roles drawn from `pool` whose weight sum lands
 * as close as possible to the experience target, preferring decks that use more of
 * the selected special roles. Greedy seed + hill-climb; deterministic with `random`.
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
  const prioritized = shuffle(specialPool, random).sort((a, b) =>
    a === 'seer' ? -1 : b === 'seer' ? 1 : 0,
  );
  // Enough specials to keep Villagers under half the table, when the pool allows it.
  const villagerCap = maxAutoVillagers(n);
  seed.push(...prioritized.slice(0, Math.max(Math.ceil(villageSlots * 0.6), villageSlots - villagerCap)));
  while (seed.length < n) seed.push('villager');

  const score = (deck: RoleId[]): number => {
    const balance = Math.abs(calculateBalance(deck) - target);
    // The Seer anchors the village's information game, so dropping it costs extra.
    const missing = specialPool.reduce((n, id) => n + (deck.includes(id) ? 0 : id === 'seer' ? 4 : 1), 0);
    const villagers = deck.filter((id) => id === 'villager').length;
    const overCap = Math.max(0, villagers - villagerCap);
    // The villager cap outweighs balance; it's only exceeded if the pool is too small.
    return overCap * 1000 + balance * 10 + missing * 0.5 + (villagers === 0 ? 0 : 0.01 * villagers);
  };

  let best = seed;
  let bestScore = score(best);
  let current = best;
  let currentScore = bestScore;

  for (let iter = 0; iter < 1500; iter++) {
    const candidate = [...current];
    const slot = Math.floor(random() * n);
    if (ROLES[candidate[slot]].isWolf) {
      candidate[slot] = pickOne(wolfPool, random);
    } else {
      candidate[slot] = pickOne([...specialPool, 'villager'] as RoleId[], random);
    }
    if (!isValidDraft(candidate, wolfCount)) continue;
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

  return sortDeck(best);
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
  return tx(entry.key, params);
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
