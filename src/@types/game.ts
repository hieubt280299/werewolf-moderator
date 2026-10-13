/**
 * Core domain model for Werewolf Gamemaster.
 * Everything here is serialisable so the full GameState can be persisted to
 * localStorage or Firestore as-is.
 */

/** Allegiance used for win checks and card colouring. */
export type Faction = 'village' | 'werewolf' | 'vampire' | 'cult';

/** Which team a role wins with. Lone Wolf wins alone. */
export type WinTeam = Faction | 'loneWolf' | 'draw';

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
  | 'cultLeader';

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
  | 'cultRecruit';

export type RoleIconKey =
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
  | 'cultLeader';

export interface Role {
  id: RoleId;
  faction: Faction;
  winTeam: WinTeam;
  cardTone: CardTone;
  /** Balance weight printed on the card: + favours village, − favours wolves. */
  weight: number;
  icon: RoleIconKey;
  /** Counts toward wolf parity and wakes with the pack. */
  isWolf: boolean;
  seerAppearance: SeerAppearance;
  nightAction?: NightActionKind;
  /** Lower wakes earlier. */
  nightOrder?: number;
  maxCopies: number;
}

export type Phase = 'setup' | 'night' | 'dawn' | 'day' | 'gameOver';
export type DayStep = 'discussion' | 'voting' | 'closed';
export type ExperienceLevel = 'beginner' | 'standard' | 'veteran';
export type Language = 'en' | 'vi';

export type EliminationCause = 'wolves' | 'witch' | 'vote' | 'hunter' | 'vampire' | 'moderator';

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
}

export type NightActionField = Exclude<keyof NightActions, 'wolfTargets'>;

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
  /** Why this step is suppressed, if it is. */
  note?: 'wolvesSkip' | 'wolvesDouble' | 'noPotions';
}

export interface NightReport {
  round: number;
  deaths: { playerId: string; cause: EliminationCause }[];
  saved: string[];
  transformed: string[];
  silenced: string | null;
  recruited: string | null;
  vampireMarked: string | null;
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
}

export interface WinResult {
  team: WinTeam;
  winnerIds: string[];
}

export interface SetupDraft {
  names: string[];
  deck: RoleId[];
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
  pendingTriggers: PendingTrigger[];
  winner: WinResult | null;
  log: GameLogEntry[];
  setup: SetupDraft;
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
