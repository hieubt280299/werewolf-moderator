/**
 * Core domain model for Werewolf Gamemaster.
 * Everything here is serialisable so the full GameState can be persisted to
 * localStorage or Firestore as-is.
 */

/** Allegiance used for win checks and card colouring. `neutral` = solo roles (Tanner). */
export type Faction = 'village' | 'werewolf' | 'vampire' | 'cult' | 'neutral';

/**
 * Which team a role wins with. Main teams: Village and Wolves; third: The Couple
 * (Cupid's lovers, formed in play). Lone Wolf, Tanner, Vampires and Cult are rare extras.
 */
export type WinTeam = Faction | 'loneWolf' | 'tanner' | 'couple' | 'draw';

/** Colour of the card's text plate — mostly mirrors Faction, but e.g. Cursed prints red. */
export type CardTone = Faction;

export type RoleId =
  | 'villager'
  | 'seer'
  | 'bodyguard'
  | 'hunter'
  | 'witch'
  | 'prince'
  | 'diseased'
  | 'spellcaster'
  | 'lycan'
  | 'cursed'
  | 'werewolf'
  | 'wolfCub'
  | 'loneWolf'
  | 'sorceress'
  | 'vampire'
  | 'cultLeader'
  // Expansion roles
  | 'apprenticeSeer'
  | 'auraSeer'
  | 'pi'
  | 'priest'
  | 'mason'
  | 'mayor'
  | 'toughGuy'
  | 'villageIdiot'
  | 'pacifist'
  | 'ghost'
  | 'oldHag'
  | 'troublemaker'
  | 'leprechaun'
  | 'drunk'
  | 'cupid'
  | 'doppelganger'
  | 'virginiaWoolf'
  | 'tanner'
  | 'minion'
  | 'wolfMan'
  | 'bigBadWolf'
  | 'direWolf'
  | 'fangFace'
  | 'fruitBrute'
  | 'wolverine';

/** What the Seer is told when inspecting this role. */
export type SeerAppearance = 'village' | 'werewolf';

export type NightActionKind =
  | 'wolfKill'
  | 'seerInspect'
  | 'sorceressInspect'
  | 'bodyguardProtect'
  | 'vampireBite'
  | 'witchPotion'
  | 'spellcasterSilence'
  | 'cultRecruit'
  | 'cupidLink'
  | 'direWolfCompanion'
  | 'doppelgangerCopy'
  | 'virginiaFear'
  | 'masonMeet'
  | 'minionMeet'
  | 'leprechaunRedirect'
  | 'auraInspect'
  | 'piInspect'
  | 'priestBless'
  | 'oldHagBanish'
  | 'troublemakerStir'
  | 'drunkSober';

/** 1 = beginner-friendly, 2 = intermediate, 3 = advanced (also rare third-party teams). */
export type Difficulty = 1 | 2 | 3;

export interface Role {
  id: RoleId;
  faction: Faction;
  winTeam: WinTeam;
  cardTone: CardTone;
  /** Balance weight printed on the card: + favours village, − favours wolves. */
  weight: number;
  /** Counts toward wolf parity and wakes with the pack. */
  isWolf: boolean;
  seerAppearance: SeerAppearance;
  nightAction?: NightActionKind;
  /** Lower wakes earlier. */
  nightOrder?: number;
  /** Only wakes on night 1. */
  firstNightOnly?: boolean;
  maxCopies: number;
  difficulty: Difficulty;
}

export type Phase = 'setup' | 'night' | 'dawn' | 'day' | 'gameOver';
export type DayStep = 'discussion' | 'voting' | 'closed';
export type ExperienceLevel = 'beginner' | 'standard' | 'veteran';
export type Language = 'en' | 'vi';

export type EliminationCause =
  | 'wolves'
  | 'witch'
  | 'vote'
  | 'hunter'
  | 'vampire'
  | 'moderator'
  /** The Ghost dies on night 1 by design. */
  | 'ghost'
  /** A lover dies of a broken heart. */
  | 'heartbreak'
  /** Dire Wolf companion / Virginia Woolf link. */
  | 'linked';

export interface PlayerStatus {
  /** Bodyguard shield for the current night. */
  protected: boolean;
  /** Spellcaster: may not speak during the current day. */
  silenced: boolean;
  inCult: boolean;
  /** Vampire victim — dies on the first accusation of the day. */
  vampireMarked: boolean;
  /** Prince survived a vote and is now public. */
  princeRevealed: boolean;
  /** Cursed who was attacked and became a Werewolf. */
  transformed: boolean;
  /** Linked by Cupid. */
  lover: boolean;
  /** Old Hag: has left the village for the current day (can't speak, vote or be accused). */
  banished: boolean;
  /** Tough Guy attacked by wolves in this round — dies at the end of the next night. */
  woundedRound: number | null;
}

export interface Elimination {
  round: number;
  phase: 'night' | 'day';
  cause: EliminationCause;
}

export interface Player {
  id: string;
  name: string;
  seat: number;
  /** Current role (changes when Cursed transforms). */
  roleId: RoleId;
  originalRoleId: RoleId;
  alive: boolean;
  status: PlayerStatus;
  eliminated?: Elimination;
}

export interface NightActions {
  wolfTargets: string[];
  seerTarget: string | null;
  sorceressTarget: string | null;
  bodyguardTarget: string | null;
  vampireTarget: string | null;
  witchSaveTarget: string | null;
  witchKillTarget: string | null;
  spellcasterTarget: string | null;
  cultTarget: string | null;
  cupidTargets: string[];
  direWolfTarget: string | null;
  doppelgangerTarget: string | null;
  virginiaTarget: string | null;
  /** Leprechaun moves the wolves' (first) target to this adjacent player. */
  leprechaunTarget: string | null;
  auraSeerTarget: string | null;
  piTarget: string | null;
  priestTarget: string | null;
  oldHagTarget: string | null;
  /** Set to the Troublemaker's id when they stir up trouble tonight. */
  troublemakerActor: string | null;
  /** The real role the Drunk sobers up into on night 3. */
  drunkRole: string | null;
}

export type NightTargetListField = 'wolfTargets' | 'cupidTargets';
export type NightActionField = Exclude<keyof NightActions, NightTargetListField>;

/** One wake-up call in the night script, derived from the living roles. */
export interface NightStep {
  id: string;
  roleId: RoleId;
  action: NightActionKind;
  /** Player ids who wake for this step. Empty when every holder is dead. */
  actors: string[];
  /** How many targets the step expects (wolves: 0, 1 or 2). */
  targetCount: number;
  /** Role is in the deck but dead — call it anyway so the table can't deduce it. */
  ghost: boolean;
  /** How the moderator records the step. */
  kind: 'targets' | 'info' | 'role' | 'toggle';
  /** Why this step is suppressed or special, if it is. */
  note?: 'wolvesSkip' | 'wolvesDouble' | 'noPotions' | 'bigBadWolf' | 'fruitBrute' | 'used';
}

export interface NightReport {
  round: number;
  deaths: { playerId: string; cause: EliminationCause }[];
  saved: string[];
  transformed: string[];
  silenced: string | null;
  recruited: string | null;
  vampireMarked: string | null;
  /** Wolverine was the closest wolf to the victim: the table hears a metallic sound. */
  metallic: boolean;
  banished: string | null;
  lovers: string[];
  /** Tough Guy took a wolf attack and will die after the next night. */
  wounded: string[];
}

export interface PendingTrigger {
  id: string;
  kind: 'hunterShot';
  sourcePlayerId: string;
}

export interface Nomination {
  id: string;
  accusedId: string;
  accuserId: string | null;
  /** Player ids voting to eliminate. */
  voters: string[];
}

export interface GameLogEntry {
  id: string;
  round: number;
  phase: Phase;
  /** i18n key, rendered at display time so the log follows the language toggle. */
  key: string;
  params?: Record<string, string | number>;
}

export interface GameModifiers {
  /** Diseased was eaten: wolves skip their next kill. */
  wolvesSkipNextNight: boolean;
  /** Wolf Cub died: wolves eliminate two players next night. */
  wolvesDoubleKill: boolean;
  /** Bodyguard can't protect the same player two nights running. */
  bodyguardLastTarget: string | null;
  witchHealUsed: boolean;
  witchKillUsed: boolean;
  /** Vampire victims already collected this day. */
  vampireTriggeredToday: boolean;
  direWolfCompanion: string | null;
  doppelgangerTarget: string | null;
  virginiaTarget: string | null;
  priestUsed: boolean;
  piUsed: boolean;
  troublemakerUsed: boolean;
  /** Troublemaker stirred trouble last night: two eliminations allowed today. */
  extraExecution: boolean;
  /** Set when the Tanner gets eliminated (they win). */
  tannerWinner: string | null;
}

export interface WinResult {
  team: WinTeam;
  winnerIds: string[];
}

export interface SetupDraft {
  names: string[];
  deck: RoleId[];
  /** Saved deck the current setup was loaded from, if any. */
  deckId?: string | null;
  deckName?: string | null;
  /** Roles the auto-balancer may draw from. */
  pool: RoleId[];
  experience: ExperienceLevel;
}

export interface GameState {
  version: 1;
  id: string;
  phase: Phase;
  /** Night N is followed by Day N. */
  round: number;
  dayStep: DayStep;
  players: Player[];
  /** The roles dealt this game (used for ghost night calls). */
  deck: RoleId[];
  nightStepIndex: number;
  nightActions: NightActions;
  modifiers: GameModifiers;
  lastReport: NightReport | null;
  nominations: Nomination[];
  executedToday: string | null;
  /** Eliminations still allowed today (2 after the Troublemaker acts). */
  executionsLeft: number;
  pendingTriggers: PendingTrigger[];
  winner: WinResult | null;
  log: GameLogEntry[];
  setup: SetupDraft;
  /** Set once the finished game has been written to the moderator's history. */
  recordedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface BalanceOptions {
  playerCount: number;
  /** Roles the generator may draw from (villager & werewolf are always allowed). */
  pool: RoleId[];
  experience: ExperienceLevel;
  /** Override the wolf-killer count; defaults to ~1 per 4–5 players. */
  wolfCount?: number;
  /** Deterministic RNG for tests. */
  random?: () => number;
}

// ---------------------------------------------------------------------------
// Moderator accounts (v0.1.0)
// ---------------------------------------------------------------------------

export const MAX_DECKS = 10;

/** A saved role list. Its length is the player count it was built for. */
export interface Deck {
  id: string;
  name: string;
  roles: RoleId[];
  createdAt: string;
  updatedAt: string;
}

export interface LifetimeStats {
  gamesModerated: number;
  werewolfWins: number;
  villageWins: number;
  /** The Couple, Tanner, Lone Wolf, Vampires, Cult and draws. */
  otherWins: number;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  decks: Deck[];
  stats: LifetimeStats;
  createdAt: string;
}

export interface GameRecordPlayer {
  name: string;
  seat: number;
  roleId: RoleId;
  originalRoleId: RoleId;
  alive: boolean;
}

/** A finished game in the moderator's history. */
export interface GameRecord {
  id: string;
  startedAt: string;
  finishedAt: string;
  rounds: number;
  deckName: string | null;
  winner: WinTeam;
  players: GameRecordPlayer[];
  /** Seat indexes of the winning players. */
  winnerSeats: number[];
  log: GameLogEntry[];
}

export interface SessionUser {
  uid: string;
  username: string;
}
