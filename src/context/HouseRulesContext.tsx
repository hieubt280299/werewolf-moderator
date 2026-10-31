import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { NO_REBALANCES, REBALANCE_IDS, type RebalanceId, type RebalanceRules, type RoleId } from '../@types/game';
import type { TranslationKey } from '../i18n/translations';

/**
 * The house rules role cards are described with: the game's frozen rules once it has been
 * dealt, otherwise the moderator's current settings (for the next game). Outside a signed-in
 * session (the sign-in screen) cards show the standard rules.
 */
const HouseRulesContext = createContext<RebalanceRules>(NO_REBALANCES);

export function HouseRulesProvider({ rules, children }: { rules: Partial<RebalanceRules> | null | undefined; children: ReactNode }) {
  // Memoized on the switches' values, not the object: every game action clones the state,
  // and a new-but-equal object must not re-render every card on screen.
  const key = REBALANCE_IDS.map((id) => (rules?.[id] ? 1 : 0)).join('');
  const value = useMemo<RebalanceRules>(() => ({ ...NO_REBALANCES, ...rules }), [key]);
  return <HouseRulesContext.Provider value={value}>{children}</HouseRulesContext.Provider>;
}

export const useHouseRules = (): RebalanceRules => useContext(HouseRulesContext);

const isRebalanceId = (id: RoleId): id is RoleId & RebalanceId => (REBALANCE_IDS as readonly string[]).includes(id);

/** True when a house rule changes how this role plays. */
export const isRebalanced = (roleId: RoleId, rules: RebalanceRules): boolean => isRebalanceId(roleId) && rules[roleId];

/** The role's rules text: its rebalanced version when that house rule is on. */
export const roleDescKey = (roleId: RoleId, rules: RebalanceRules): TranslationKey =>
  isRebalanceId(roleId) && rules[roleId] ? `role.${roleId}.descRebalanced` : `role.${roleId}.desc`;
