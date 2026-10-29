import { useMemo } from 'react';
import type { NightGroup, NightStep, Player } from '../@types/game';
import {
  actionSeduced,
  inspectionResult,
  killDebuffs,
  rulesOf,
  seducedPlayer,
  witchSeesVictims,
  wolfAttacks,
  type InspectAction,
  type KillDebuffs,
} from '../utils/gameRules';
import { useGameEngine } from './useGameEngine';

/**
 * The night's wake-up calls, one at a time, in strict order: night-1 setup →
 * transformations & delayed roles → Hooker / Bodyguard → Vampires → Werewolves → Minion /
 * Sorceress → everyone else.
 *
 * On top of the game engine it answers what the moderator needs at each call: whether the
 * Hooker's seduction cancels this power, what an inspector is told (inverted when seduced),
 * what the Witch may see under the house rules, and the resolution queue of tonight's kill
 * debuffs — `[WolfpackKill, BBWKill]` per victim, with what lifts each (see killDebuffs).
 */
export function useNightSequence() {
  const engine = useGameEngine();
  const { state, nightSteps } = engine;
  const total = nightSteps.length;
  const index = Math.min(state.nightStepIndex, Math.max(0, total - 1));
  const step: NightStep | undefined = nightSteps[index];

  const derived = useMemo(() => {
    const seduced = seducedPlayer(state) ?? null;
    const debuffs = killDebuffs(state);
    return {
      /** Tonight's seduced player, if the Hooker has chosen. */
      seduced,
      /** Wolf attacks that will land (after the Leprechaun, minus seduced attackers). */
      attacks: wolfAttacks(state),
      /** Each victim's kill debuffs as things stand, with what lifts them, in attack order. */
      debuffs,
      /** One player's kill debuffs tonight, if any wolf attack falls on them. */
      debuffsOf: (playerId: string): KillDebuffs | undefined => debuffs.find((d) => d.targetId === playerId),
      witchSeesVictims: witchSeesVictims(state),
      rules: rulesOf(state),
    };
  }, [state]);

  return useMemo(() => {
    /** The seduced player whose power this call cancels, or null. */
    const seducedActor = (s: NightStep): Player | null =>
      derived.seduced && s.action !== 'hookerSeduce' && actionSeduced(state, s.action) ? derived.seduced : null;

    /** True for the first call of each block, where the modal shows the block's heading. */
    const opensGroup = (i: number): NightGroup | null =>
      nightSteps[i] && nightSteps[i].group !== nightSteps[i - 1]?.group ? nightSteps[i].group : null;

    return {
      steps: nightSteps,
      step,
      index,
      total,
      isFirst: index === 0,
      isLast: index >= total - 1,
      ...derived,
      seducedActor,
      opensGroup,
      inspection: (action: InspectAction, targetId: string) => inspectionResult(state, action, targetId),
      goTo: engine.goToNightStep,
      next: () => engine.goToNightStep(Math.min(index + 1, total - 1)),
      back: () => engine.goToNightStep(Math.max(index - 1, 0)),
      finish: engine.resolveNight,
    };
  }, [state, nightSteps, step, index, total, derived, engine.goToNightStep, engine.resolveNight]);
}
