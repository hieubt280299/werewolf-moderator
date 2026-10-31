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

/** Card colouring — mirrors Faction, plus `dual` for Cursed (half Village, half Wolves). */
export type CardTone = Faction | 'dual';

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
  | 'hooker'
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
  | 'drunkSober'
  // v1.0.0
  | 'hookerSeduce'
  /** House rule: the Hunter links to a player who dies with them that night. */
  | 'hunterLink'
  /** House rule: the Big Bad Wolf's own strike, right after the pack's. */
  | 'bigBadWolfStrike'
  /** Night 1, right after Cupid: the Lovers wake and are shown each other's role. */
  | 'loversMeet'
  /** The Doppelgänger's target died: wake her to see the role she took. */
  | 'doppelgangerAwaken';

/** 1 = beginner-friendly, 2 = intermediate, 3 = advanced (also rare third-party teams). */
export type Difficulty = 1 | 2 | 3;

/**
 * What a role can do beyond the plain Villager / Werewolf, for the auto-balancer's mix:
 * eliminate players (beyond the pack's nightly kill), protect or save them, or learn
 * something about them.
 */
export type RoleAbility = 'kill' | 'protect' | 'info';

/** When a role wakes: every night, night 1 only, some other night (the Drunk), or never. */
export type NightWake = 'everyNight' | 'firstNight' | 'later' | 'never';

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
  /** Lower wakes earlier (see NIGHT_ORDER in data/roles). */
  nightOrder?: number;
  /** Only wakes on night 1. */
  firstNightOnly?: boolean;
  maxCopies: number;
  difficulty: Difficulty;
  abilities: RoleAbility[];
  /** Not an Ultimate Werewolf card: a role made for this app (the Hooker). */
  custom: boolean;
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
  /** Dire Wolf companion / Virginia Woolf link / the Hunter's night link (house rule). */
  | 'linked'
  /** House rule: targeted the reworked Tanner at night (the Tanner dies too). */
  | 'tanner';

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

/**
 * A direction round the table. Everyone faces the middle, so a player's left neighbour is the
 * next seat clockwise, and their right neighbour the next seat counter-clockwise.
 */
export type LeprechaunMove = 'left' | 'right';

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
  /**
   * The Leprechaun's blind move (v1.2.0): every pack target shifts one seat this way, or stays
   * when null. They never see who the Werewolves chose.
   */
  leprechaunMove: LeprechaunMove | null;
  auraSeerTarget: string | null;
  piTarget: string | null;
  priestTarget: string | null;
  oldHagTarget: string | null;
  /** Set to the Troublemaker's id when they stir up trouble tonight. */
  troublemakerActor: string | null;
  /** The real role the Drunk sobers up into on night 3. */
  drunkRole: string | null;
  /** Seduced by the Hooker: their own night power fails tonight. */
  hookerTarget: string | null;
  /** House rule: dies with the Hunter if the Hunter dies tonight. */
  hunterTarget: string | null;
  /** House rule: the Big Bad Wolf's own victim, seated next to one of the pack's targets. */
  bigBadWolfTarget: string | null;
}

export type NightTargetListField = 'wolfTargets' | 'cupidTargets';
export type NightActionField = Exclude<keyof NightActions, NightTargetListField>;

/**
 * The five blocks of the night, called strictly in this order:
 * 1 night-1 setup → 2 transformations & delayed roles → 3 protection & distraction →
 * 4 threats (Vampires → Werewolves → Minion / Sorceress) → 5 every other night role.
 */
export type NightGroup = 1 | 2 | 3 | 4 | 5;

/** One wake-up call in the night script, derived from the living roles. */
export interface NightStep {
  id: string;
  roleId: RoleId;
  action: NightActionKind;
  group: NightGroup;
  /** Player ids who wake for this step. Empty when every holder is dead. */
  actors: string[];
  /** How many targets the step expects (wolves: 0, 1 or 2). */
  targetCount: number;
  /** Nobody alive holds the role — call it anyway so the table can't deduce it. */
  ghost: boolean;
  /** A ghost call for a role nobody was dealt (full pool calls), not one whose holders are all dead. */
  undealt?: boolean;
  /** How the moderator records the step. */
  kind: 'targets' | 'info' | 'role' | 'toggle' | 'direction';
  /** Wolves' turn: bitten Cursed who wake with the pack for the first time tonight. */
  joining?: string[];
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

/**
 * A player whose role changed, to be told on a later night: a Doppelgänger is woken to see
 * her new role; a bitten Cursed is woken silently with the pack (a note in the wolves' turn).
 */
export interface PendingAwakening {
  playerId: string;
  kind: 'cursed' | 'doppelganger';
  /** The night they are woken. */
  round: number;
}

export interface PendingTrigger {
  id: string;
  kind: 'hunterShot';
  sourcePlayerId: string;
}

export interface Nomination {
  id: string;
  accusedId: string;
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
  /** Players behind the event, e.g. everyone who voted to eliminate (shown on demand). */
  people?: { name: string; role: RoleId }[];
}

export interface GameModifiers {
  /** Diseased was eaten: wolves skip their next kill. */
  wolvesSkipNextNight: boolean;
  /** Wolf Cub died: wolves eliminate two players next night. */
  wolvesDoubleKill: boolean;
  /** Bodyguard can't protect the same player two nights running. */
  bodyguardLastTarget: string | null;
  /** Old Hag can't send the same player away two nights running. */
  oldHagLastTarget: string | null;
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
  /** Players the Hooker has already seduced — each only once per game. */
  hookerVisited: string[];
  pendingAwakenings: PendingAwakening[];
}

// ---------------------------------------------------------------------------
// House rules (v1.0.0)
// ---------------------------------------------------------------------------

/** Optional "Recommended Rebalances", chosen in Profile & settings. */
export interface RebalanceRules {
  /** The Hunter links to a player each night; if the Hunter dies that night, so do they. */
  hunter: boolean;
  /** Once the Healing Potion is used, the Witch no longer sees the Werewolves' victim. */
  witch: boolean;
  /** The Big Bad Wolf takes its own turn after the pack: a second victim next to the first. */
  bigBadWolf: boolean;
  /** The Tanner joins the Village; anyone who targets them at night dies with them. */
  tanner: boolean;
}

export type RebalanceId = keyof RebalanceRules;
export const REBALANCE_IDS: readonly RebalanceId[] = ['hunter', 'witch', 'bigBadWolf', 'tanner'];
export const NO_REBALANCES: RebalanceRules = { hunter: false, witch: false, bigBadWolf: false, tanner: false };

export interface WinResult {
  team: WinTeam;
  winnerIds: string[];
}

export interface SetupDraft {
  names: string[];
  deck: RoleId[];
  /** Saved role pool the current setup was loaded from, if any. */
  poolId?: string | null;
  poolName?: string | null;
  /** Roles available to this game (Role Pool step); the Deck step and auto-balance use these. */
  pool: RoleId[];
  experience: ExperienceLevel;
  /** Wizard step and deal board, saved so leaving the screen (or reloading) keeps your place. */
  step?: 'players' | 'pool' | 'deck' | 'deal';
  deal?: { slots: (RoleId | null)[]; tray: RoleId[] } | null;
  /** The cards of the last game played, which auto-balance won't deal again unchanged. */
  previousDeck?: RoleId[];
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
  /**
   * House rules frozen when the cards were dealt. Changing them in Settings only affects
   * games dealt afterwards.
   */
  rules: RebalanceRules;
  /**
   * Full pool calls, frozen when the cards were dealt: the night script calls every role in
   * the Role Pool, dealt or not, so the table can't tell which roles are in play.
   */
  fullPoolCalls: boolean;
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
  /** House rules (the reworked Tanner is a Villager, so no extra team). */
  rules?: Partial<RebalanceRules> | null;
  /** The last game's cards: the new deck must differ from them by at least 10% of the seats. */
  previousDeck?: readonly RoleId[];
  /** Deterministic RNG for tests. */
  random?: () => number;
}

// ---------------------------------------------------------------------------
// Moderator accounts (v0.1.0)
// ---------------------------------------------------------------------------

export const MAX_POOLS = 10;

/** A saved set of roles to play with (no counts — counts are chosen in the Deck step). */
export interface RolePool {
  id: string;
  name: string;
  /** Unique role ids. */
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
  /** Where password-reset codes / links are sent. Null on accounts made before v1.0.0. */
  recoveryEmail: string | null;
  /** Firebase: a new recovery email waiting for its confirmation link to be opened. */
  pendingRecoveryEmail?: string | null;
  pools: RolePool[];
  stats: LifetimeStats;
  /** House rules for newly dealt games. */
  rebalances?: RebalanceRules;
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
  poolName: string | null;
  /** The game's Role Pool, for "Start new game from lineup". Missing on games before v1.1.0. */
  pool?: RoleId[];
  winner: WinTeam;
  players: GameRecordPlayer[];
  /** Seat indexes of the winning players. */
  winnerSeats: number[];
  log: GameLogEntry[];
}

export type { SessionUser } from './auth';
