import type {
  CardTone,
  Difficulty,
  Faction,
  NightActionKind,
  NightGroup,
  NightWake,
  RebalanceRules,
  Role,
  RoleAbility,
  RoleId,
  SeerAppearance,
  WinTeam,
} from '../@types/game';
import { dictionaries } from '../i18n/translations';

/**
 * Ultimate Werewolf Deluxe role catalogue. Weights match the printed card values.
 * Display names / rules text live in the i18n dictionaries (role.<id>.*).
 */

/**
 * Night call order (lower wakes first), in five strict blocks:
 *   1–9   night 1 only, setup: Cupid (then the Lovers meet), Doppelgänger, Virginia Woolf,
 *         Masons, Dire Wolf's companion
 *   10–19 transformations & delayed roles: Doppelgänger (when her target died; silently
 *         tapped awake, never called aloud), Drunk (night 3). A bitten Cursed has no call:
 *         they are silently tapped to wake with the pack.
 *   20–29 protection & distraction: Hooker, Bodyguard, Priest
 *   30–39 threats: Vampires → Werewolves (then the Big Bad Wolf's own strike) → Minion /
 *         Sorceress
 *   40+   every other night role: Leprechaun, Seer, Aura Seer, P.I., Hunter (house rule),
 *         Witch, Old Hag, Spellcaster, Troublemaker, Cult Leader
 */
export const NIGHT_ORDER: Record<NightActionKind, number> = {
  cupidLink: 1,
  loversMeet: 2,
  doppelgangerCopy: 3,
  virginiaFear: 4,
  masonMeet: 5,
  // Picking a companion is setup, so the Dire Wolf wakes alone here, before the pack.
  direWolfCompanion: 6,

  doppelgangerAwaken: 11,
  drunkSober: 12,

  hookerSeduce: 20,
  bodyguardProtect: 21,
  priestBless: 22,

  vampireBite: 30,
  wolfKill: 31,
  bigBadWolfStrike: 32,
  minionMeet: 34,
  sorceressInspect: 35,

  leprechaunRedirect: 40,
  seerInspect: 41,
  auraInspect: 42,
  piInspect: 43,
  hunterLink: 44,
  witchPotion: 50,
  oldHagBanish: 55,
  spellcasterSilence: 60,
  troublemakerStir: 65,
  cultRecruit: 70,
};

export const nightGroup = (action: NightActionKind): NightGroup => {
  const order = NIGHT_ORDER[action];
  return order < 10 ? 1 : order < 20 ? 2 : order < 30 ? 3 : order < 40 ? 4 : 5;
};

interface Spec {
  faction: Faction;
  weight: number;
  difficulty: Difficulty;
  winTeam?: WinTeam;
  cardTone?: CardTone;
  isWolf?: boolean;
  seerAppearance?: SeerAppearance;
  nightAction?: NightActionKind;
  firstNightOnly?: boolean;
  maxCopies?: number;
  abilities?: RoleAbility[];
}

const SPECS: Record<RoleId, Spec> = {
  // --- Village ---------------------------------------------------------------
  villager: { faction: 'village', weight: 1, difficulty: 1, maxCopies: 30 },
  seer: { faction: 'village', weight: 7, difficulty: 1, nightAction: 'seerInspect', abilities: ['info'] },
  hooker: { faction: 'village', weight: 7, difficulty: 2, nightAction: 'hookerSeduce', abilities: ['protect'] },
  apprenticeSeer: { faction: 'village', weight: 4, difficulty: 2, abilities: ['info'] },
  auraSeer: { faction: 'village', weight: 3, difficulty: 2, nightAction: 'auraInspect', abilities: ['info'] },
  pi: { faction: 'village', weight: 3, difficulty: 2, nightAction: 'piInspect', abilities: ['info'] },
  bodyguard: { faction: 'village', weight: 3, difficulty: 1, nightAction: 'bodyguardProtect', abilities: ['protect'] },
  priest: { faction: 'village', weight: 3, difficulty: 1, nightAction: 'priestBless', abilities: ['protect'] },
  hunter: { faction: 'village', weight: 3, difficulty: 1, abilities: ['kill'] },
  witch: { faction: 'village', weight: 4, difficulty: 2, nightAction: 'witchPotion', abilities: ['kill', 'protect'] },
  prince: { faction: 'village', weight: 3, difficulty: 1 },
  mayor: { faction: 'village', weight: 2, difficulty: 1 },
  mason: { faction: 'village', weight: 2, difficulty: 1, nightAction: 'masonMeet', firstNightOnly: true, maxCopies: 3 },
  toughGuy: { faction: 'village', weight: 3, difficulty: 2 },
  diseased: { faction: 'village', weight: 3, difficulty: 1 },
  villageIdiot: { faction: 'village', weight: 2, difficulty: 1 },
  pacifist: { faction: 'village', weight: -1, difficulty: 1 },
  ghost: { faction: 'village', weight: 2, difficulty: 2, abilities: ['info'] },
  spellcaster: { faction: 'village', weight: 1, difficulty: 2, nightAction: 'spellcasterSilence' },
  oldHag: { faction: 'village', weight: 1, difficulty: 2, nightAction: 'oldHagBanish' },
  troublemaker: { faction: 'village', weight: -3, difficulty: 2, nightAction: 'troublemakerStir' },
  leprechaun: { faction: 'village', weight: 5, difficulty: 3, nightAction: 'leprechaunRedirect', abilities: ['protect'] },
  drunk: { faction: 'village', weight: 4, difficulty: 3, nightAction: 'drunkSober' },
  lycan: { faction: 'village', weight: -1, difficulty: 2, seerAppearance: 'werewolf' },
  // Can end up on either team, so the card is split Village blue / Wolf red.
  cursed: { faction: 'village', weight: -3, difficulty: 2, cardTone: 'dual' },
  cupid: { faction: 'village', weight: -3, difficulty: 2, nightAction: 'cupidLink', firstNightOnly: true },
  doppelganger: { faction: 'village', weight: -2, difficulty: 3, nightAction: 'doppelgangerCopy', firstNightOnly: true },
  virginiaWoolf: { faction: 'village', weight: -2, difficulty: 2, nightAction: 'virginiaFear', firstNightOnly: true },

  // --- Wolves ----------------------------------------------------------------
  werewolf: { faction: 'werewolf', weight: -6, difficulty: 1, isWolf: true, nightAction: 'wolfKill', maxCopies: 10 },
  wolfCub: { faction: 'werewolf', weight: -8, difficulty: 2, isWolf: true, nightAction: 'wolfKill', abilities: ['kill'] },
  wolfMan: { faction: 'werewolf', weight: -9, difficulty: 1, isWolf: true, seerAppearance: 'village', nightAction: 'wolfKill' },
  bigBadWolf: { faction: 'werewolf', weight: -9, difficulty: 2, isWolf: true, nightAction: 'wolfKill', abilities: ['kill'] },
  direWolf: { faction: 'werewolf', weight: -4, difficulty: 2, isWolf: true, nightAction: 'direWolfCompanion', firstNightOnly: true },
  fangFace: { faction: 'werewolf', weight: -5, difficulty: 2, isWolf: true, nightAction: 'wolfKill' },
  fruitBrute: { faction: 'werewolf', weight: -3, difficulty: 1, isWolf: true, nightAction: 'wolfKill' },
  wolverine: { faction: 'werewolf', weight: -4, difficulty: 3, isWolf: true, nightAction: 'wolfKill' },
  minion: { faction: 'werewolf', weight: -6, difficulty: 2, nightAction: 'minionMeet', firstNightOnly: true },
  sorceress: { faction: 'werewolf', weight: -3, difficulty: 2, nightAction: 'sorceressInspect', abilities: ['info'] },
  loneWolf: { faction: 'werewolf', weight: -5, difficulty: 3, isWolf: true, winTeam: 'loneWolf', nightAction: 'wolfKill' },

  // --- Rare third parties ----------------------------------------------------
  tanner: { faction: 'neutral', weight: -2, difficulty: 3, winTeam: 'tanner' },
  vampire: { faction: 'vampire', weight: -7, difficulty: 3, nightAction: 'vampireBite', maxCopies: 4, abilities: ['kill'] },
  cultLeader: { faction: 'cult', weight: 1, difficulty: 3, nightAction: 'cultRecruit' },
};

export const ROLES: Record<RoleId, Role> = Object.fromEntries(
  (Object.entries(SPECS) as [RoleId, Spec][]).map(([id, spec]) => [
    id,
    {
      id,
      faction: spec.faction,
      winTeam: spec.winTeam ?? spec.faction,
      cardTone: spec.cardTone ?? spec.faction,
      weight: spec.weight,
      difficulty: spec.difficulty,
      isWolf: spec.isWolf ?? false,
      seerAppearance: spec.seerAppearance ?? (spec.isWolf ? 'werewolf' : 'village'),
      nightAction: spec.nightAction,
      nightOrder: spec.nightAction ? NIGHT_ORDER[spec.nightAction] : undefined,
      firstNightOnly: spec.firstNightOnly,
      maxCopies: spec.maxCopies ?? 1,
      abilities: spec.abilities ?? [],
    } satisfies Role,
  ]),
) as Record<RoleId, Role>;

export const ROLE_LIST: Role[] = Object.values(ROLES);

/** Display order for pickers: Village, then Wolves, then rare third parties. */
export const ROLE_ORDER: RoleId[] = Object.keys(SPECS) as RoleId[];

export const getRole = (id: RoleId): Role => ROLES[id];

/** Always part of a role pool (and always available in the Deck step) — they can't be removed. */
export const ALWAYS_IN_POOL: readonly RoleId[] = ['villager', 'werewolf'];

/** A pool's roles with Villager and Werewolf guaranteed, in catalogue order. */
export const withFillers = (roles: readonly RoleId[]): RoleId[] => {
  const set = new Set<RoleId>([...ALWAYS_IN_POOL, ...roles]);
  return ROLE_ORDER.filter((id) => set.has(id));
};

export type RoleSectionId = 'village' | 'wolves' | 'other';

/**
 * Roles grouped for pickers: Village, Wolves (incl. Minion & Sorceress), then the rare
 * third parties. Within a section: easiest first, then the roles that favour the section's
 * side most (highest weight for the Village, lowest for the others), then by English name.
 */
export const ROLE_SECTIONS: { id: RoleSectionId; roles: RoleId[] }[] = (() => {
  const sectionOf = (id: RoleId): RoleSectionId =>
    ROLES[id].faction === 'village' ? 'village' : ROLES[id].faction === 'werewolf' ? 'wolves' : 'other';
  const name = (id: RoleId) => dictionaries.en[`role.${id}.name`];
  return (['village', 'wolves', 'other'] as const).map((section) => {
    // Weights are + for the Village, − against it, so only the Village sorts high to low.
    const side = section === 'village' ? -1 : 1;
    const order = (a: RoleId, b: RoleId) =>
      ROLES[a].difficulty - ROLES[b].difficulty || side * (ROLES[a].weight - ROLES[b].weight) || name(a).localeCompare(name(b), 'en');
    return { id: section, roles: ROLE_ORDER.filter((r) => sectionOf(r) === section).sort(order) };
  });
})();

/** When a role is called at night. The Drunk only wakes on night 3. */
export const nightWake = (id: RoleId): NightWake => {
  const role = ROLES[id];
  if (!role.nightAction) return 'never';
  if (role.firstNightOnly) return 'firstNight';
  return id === 'drunk' ? 'later' : 'everyNight';
};

/** Plain Werewolf / Villager — what the Aura Seer reports as "ordinary". */
export const ORDINARY_ROLES: ReadonlySet<RoleId> = new Set<RoleId>(['villager', 'werewolf']);

// ---------------------------------------------------------------------------
// House rules that change a role's team (v1.0.0)
// ---------------------------------------------------------------------------

/** The Tanner rework moves the Tanner to the Village. */
const reworkedTanner = (id: RoleId, rules?: Partial<RebalanceRules> | null) => id === 'tanner' && !!rules?.tanner;

/** The team a role wins with under a game's house rules. */
export const roleWinTeam = (id: RoleId, rules?: Partial<RebalanceRules> | null): WinTeam =>
  reworkedTanner(id, rules) ? 'village' : ROLES[id].winTeam;

/** The faction a role counts toward (and is tinted with) under a game's house rules. */
export const roleFaction = (id: RoleId, rules?: Partial<RebalanceRules> | null): Faction =>
  reworkedTanner(id, rules) ? 'village' : ROLES[id].faction;
