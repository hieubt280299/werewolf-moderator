import type { CardTone, Difficulty, Faction, NightActionKind, Role, RoleId, SeerAppearance, WinTeam } from '../@types/game';

/**
 * Ultimate Werewolf Deluxe role catalogue. Weights match the printed card values.
 * Display names / rules text live in the i18n dictionaries (role.<id>.*).
 *
 * Night order (lower wakes first):
 *   1–8   first night only: Cupid, Doppelgänger, Virginia Woolf, Masons, Minion
 *   10–12 Werewolves → Dire Wolf companion (night 1) → Leprechaun redirect
 *   20–31 information & protection: Seer, Aura Seer, P.I., Sorceress, Bodyguard, Priest
 *   40–75 Vampires, Witch, Old Hag, Spellcaster, Troublemaker, Cult Leader, Drunk (night 3)
 */

interface Spec {
  faction: Faction;
  weight: number;
  difficulty: Difficulty;
  winTeam?: WinTeam;
  cardTone?: CardTone;
  isWolf?: boolean;
  seerAppearance?: SeerAppearance;
  nightAction?: NightActionKind;
  nightOrder?: number;
  firstNightOnly?: boolean;
  maxCopies?: number;
}

const SPECS: Record<RoleId, Spec> = {
  // --- Village ---------------------------------------------------------------
  villager: { faction: 'village', weight: 1, difficulty: 1, maxCopies: 30 },
  seer: { faction: 'village', weight: 7, difficulty: 1, nightAction: 'seerInspect', nightOrder: 20 },
  apprenticeSeer: { faction: 'village', weight: 4, difficulty: 2 },
  auraSeer: { faction: 'village', weight: 3, difficulty: 2, nightAction: 'auraInspect', nightOrder: 21 },
  pi: { faction: 'village', weight: 3, difficulty: 2, nightAction: 'piInspect', nightOrder: 22 },
  bodyguard: { faction: 'village', weight: 3, difficulty: 1, nightAction: 'bodyguardProtect', nightOrder: 30 },
  priest: { faction: 'village', weight: 3, difficulty: 1, nightAction: 'priestBless', nightOrder: 31 },
  hunter: { faction: 'village', weight: 3, difficulty: 1 },
  witch: { faction: 'village', weight: 4, difficulty: 2, nightAction: 'witchPotion', nightOrder: 50 },
  prince: { faction: 'village', weight: 3, difficulty: 1 },
  mayor: { faction: 'village', weight: 2, difficulty: 1 },
  mason: { faction: 'village', weight: 2, difficulty: 1, nightAction: 'masonMeet', nightOrder: 4, firstNightOnly: true, maxCopies: 3 },
  toughGuy: { faction: 'village', weight: 3, difficulty: 2 },
  diseased: { faction: 'village', weight: 3, difficulty: 1 },
  villageIdiot: { faction: 'village', weight: 2, difficulty: 1 },
  pacifist: { faction: 'village', weight: -1, difficulty: 1 },
  ghost: { faction: 'village', weight: 2, difficulty: 2 },
  spellcaster: { faction: 'village', weight: 1, difficulty: 2, nightAction: 'spellcasterSilence', nightOrder: 60 },
  oldHag: { faction: 'village', weight: 1, difficulty: 2, nightAction: 'oldHagBanish', nightOrder: 55 },
  troublemaker: { faction: 'village', weight: -3, difficulty: 2, nightAction: 'troublemakerStir', nightOrder: 65 },
  leprechaun: { faction: 'village', weight: 5, difficulty: 3, nightAction: 'leprechaunRedirect', nightOrder: 12 },
  drunk: { faction: 'village', weight: 4, difficulty: 3, nightAction: 'drunkSober', nightOrder: 75 },
  lycan: { faction: 'village', weight: -1, difficulty: 2, seerAppearance: 'werewolf' },
  cursed: { faction: 'village', weight: -3, difficulty: 2, cardTone: 'werewolf' },
  cupid: { faction: 'village', weight: -3, difficulty: 2, nightAction: 'cupidLink', nightOrder: 1, firstNightOnly: true },
  doppelganger: { faction: 'village', weight: -2, difficulty: 3, nightAction: 'doppelgangerCopy', nightOrder: 2, firstNightOnly: true },
  virginiaWoolf: { faction: 'village', weight: -2, difficulty: 2, nightAction: 'virginiaFear', nightOrder: 3, firstNightOnly: true },

  // --- Wolves ----------------------------------------------------------------
  werewolf: { faction: 'werewolf', weight: -6, difficulty: 1, isWolf: true, nightAction: 'wolfKill', nightOrder: 10, maxCopies: 10 },
  wolfCub: { faction: 'werewolf', weight: -8, difficulty: 2, isWolf: true, nightAction: 'wolfKill', nightOrder: 10 },
  wolfMan: { faction: 'werewolf', weight: -9, difficulty: 1, isWolf: true, seerAppearance: 'village', nightAction: 'wolfKill', nightOrder: 10 },
  bigBadWolf: { faction: 'werewolf', weight: -9, difficulty: 2, isWolf: true, nightAction: 'wolfKill', nightOrder: 10 },
  direWolf: { faction: 'werewolf', weight: -4, difficulty: 2, isWolf: true, nightAction: 'direWolfCompanion', nightOrder: 11, firstNightOnly: true },
  fangFace: { faction: 'werewolf', weight: -5, difficulty: 2, isWolf: true, nightAction: 'wolfKill', nightOrder: 10 },
  fruitBrute: { faction: 'werewolf', weight: -3, difficulty: 1, isWolf: true, nightAction: 'wolfKill', nightOrder: 10 },
  wolverine: { faction: 'werewolf', weight: -4, difficulty: 3, isWolf: true, nightAction: 'wolfKill', nightOrder: 10 },
  minion: { faction: 'werewolf', weight: -6, difficulty: 2, nightAction: 'minionMeet', nightOrder: 8, firstNightOnly: true },
  sorceress: { faction: 'werewolf', weight: -3, difficulty: 2, nightAction: 'sorceressInspect', nightOrder: 25 },
  loneWolf: { faction: 'werewolf', weight: -5, difficulty: 3, isWolf: true, winTeam: 'loneWolf', nightAction: 'wolfKill', nightOrder: 10 },

  // --- Rare third parties ----------------------------------------------------
  tanner: { faction: 'neutral', weight: -2, difficulty: 3, winTeam: 'tanner' },
  vampire: { faction: 'vampire', weight: -7, difficulty: 3, nightAction: 'vampireBite', nightOrder: 40, maxCopies: 4 },
  cultLeader: { faction: 'cult', weight: 1, difficulty: 3, nightAction: 'cultRecruit', nightOrder: 70 },
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
      nightOrder: spec.nightOrder,
      firstNightOnly: spec.firstNightOnly,
      maxCopies: spec.maxCopies ?? 1,
    } satisfies Role,
  ]),
) as Record<RoleId, Role>;

export const ROLE_LIST: Role[] = Object.values(ROLES);

/** Display order for pickers: Village, then Wolves, then rare third parties. */
export const ROLE_ORDER: RoleId[] = Object.keys(SPECS) as RoleId[];

export const getRole = (id: RoleId): Role => ROLES[id];

/** Plain Werewolf / Villager — what the Aura Seer reports as "ordinary". */
export const ORDINARY_ROLES: ReadonlySet<RoleId> = new Set<RoleId>(['villager', 'werewolf']);
