import type { Role, RoleId } from '../@types/game';

/**
 * Ultimate Werewolf Deluxe role catalogue. Weights match the printed card values.
 * Display names / rules text live in the i18n dictionaries (role.<id>.*).
 */
export const ROLES: Record<RoleId, Role> = {
  villager: {
    id: 'villager', faction: 'village', winTeam: 'village', cardTone: 'village',
    weight: 1, icon: 'villager', isWolf: false, seerAppearance: 'village', maxCopies: 30,
  },
  seer: {
    id: 'seer', faction: 'village', winTeam: 'village', cardTone: 'village',
    weight: 7, icon: 'seer', isWolf: false, seerAppearance: 'village',
    nightAction: 'seerInspect', nightOrder: 20, maxCopies: 1,
  },
  bodyguard: {
    id: 'bodyguard', faction: 'village', winTeam: 'village', cardTone: 'village',
    weight: 3, icon: 'bodyguard', isWolf: false, seerAppearance: 'village',
    nightAction: 'bodyguardProtect', nightOrder: 30, maxCopies: 1,
  },
  hunter: {
    id: 'hunter', faction: 'village', winTeam: 'village', cardTone: 'village',
    weight: 3, icon: 'hunter', isWolf: false, seerAppearance: 'village', maxCopies: 1,
  },
  witch: {
    id: 'witch', faction: 'village', winTeam: 'village', cardTone: 'village',
    weight: 4, icon: 'witch', isWolf: false, seerAppearance: 'village',
    nightAction: 'witchPotion', nightOrder: 50, maxCopies: 1,
  },
  prince: {
    id: 'prince', faction: 'village', winTeam: 'village', cardTone: 'village',
    weight: 3, icon: 'prince', isWolf: false, seerAppearance: 'village', maxCopies: 1,
  },
  diseased: {
    id: 'diseased', faction: 'village', winTeam: 'village', cardTone: 'village',
    weight: 3, icon: 'diseased', isWolf: false, seerAppearance: 'village', maxCopies: 1,
  },
  spellcaster: {
    id: 'spellcaster', faction: 'village', winTeam: 'village', cardTone: 'village',
    weight: 1, icon: 'spellcaster', isWolf: false, seerAppearance: 'village',
    nightAction: 'spellcasterSilence', nightOrder: 60, maxCopies: 1,
  },
  lycan: {
    id: 'lycan', faction: 'village', winTeam: 'village', cardTone: 'village',
    weight: -1, icon: 'lycan', isWolf: false, seerAppearance: 'werewolf', maxCopies: 1,
  },
  cursed: {
    id: 'cursed', faction: 'village', winTeam: 'village', cardTone: 'werewolf',
    weight: -3, icon: 'cursed', isWolf: false, seerAppearance: 'village', maxCopies: 1,
  },
  werewolf: {
    id: 'werewolf', faction: 'werewolf', winTeam: 'werewolf', cardTone: 'werewolf',
    weight: -6, icon: 'werewolf', isWolf: true, seerAppearance: 'werewolf',
    nightAction: 'wolfKill', nightOrder: 10, maxCopies: 10,
  },
  wolfCub: {
    id: 'wolfCub', faction: 'werewolf', winTeam: 'werewolf', cardTone: 'werewolf',
    weight: -8, icon: 'wolfCub', isWolf: true, seerAppearance: 'werewolf',
    nightAction: 'wolfKill', nightOrder: 10, maxCopies: 1,
  },
  loneWolf: {
    id: 'loneWolf', faction: 'werewolf', winTeam: 'loneWolf', cardTone: 'werewolf',
    weight: -5, icon: 'loneWolf', isWolf: true, seerAppearance: 'werewolf',
    nightAction: 'wolfKill', nightOrder: 10, maxCopies: 1,
  },
  sorceress: {
    id: 'sorceress', faction: 'werewolf', winTeam: 'werewolf', cardTone: 'werewolf',
    weight: -3, icon: 'sorceress', isWolf: false, seerAppearance: 'village',
    nightAction: 'sorceressInspect', nightOrder: 25, maxCopies: 1,
  },
  vampire: {
    id: 'vampire', faction: 'vampire', winTeam: 'vampire', cardTone: 'vampire',
    weight: -7, icon: 'vampire', isWolf: false, seerAppearance: 'village',
    nightAction: 'vampireBite', nightOrder: 40, maxCopies: 4,
  },
  cultLeader: {
    id: 'cultLeader', faction: 'cult', winTeam: 'cult', cardTone: 'cult',
    weight: 1, icon: 'cultLeader', isWolf: false, seerAppearance: 'village',
    nightAction: 'cultRecruit', nightOrder: 70, maxCopies: 1,
  },
};

export const ROLE_LIST: Role[] = Object.values(ROLES);

/** Display order for pickers: village first, then threats. */
export const ROLE_ORDER: RoleId[] = [
  'villager', 'seer', 'bodyguard', 'hunter', 'witch', 'prince', 'diseased', 'spellcaster',
  'lycan', 'cursed', 'werewolf', 'wolfCub', 'loneWolf', 'sorceress', 'vampire', 'cultLeader',
];

export const getRole = (id: RoleId): Role => ROLES[id];
