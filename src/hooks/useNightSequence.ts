import { useMemo } from 'react';
import type { NightGroup, NightStep, Player } from '../@types/game';
import {
  actionSeduced,
  inspectionResult,
  rulesOf,
  seducedPlayer,
  witchSeesVictims,
  wolfAttacks,
  type InspectAction,
} from '../utils/gameRules';
import { useGameEngine } from './useGameEngine';

/**
 * The night's wake-up calls, one at a time, in strict order: night-1 setup →
 * transformations & delayed roles → Hooker / Bodyguard → Vampires → Werewolves → Minion /
 * Sorceress → everyone else.
 *
 * On top of the game engine it answers what the moderator needs at each call: whether the
 * Hooker's seduction cancels this power, what an inspector is told (inverted when seduced),
 * and what the Witch may see under the house rules.
 */
export function useNightSequence() {
  const engine = useGameEngine();
  const { state, nightSteps } = engine;
  const total = nightSteps.length;
  const index = Math.min(state.nightStepIndex, Math.max(0, total - 1));
  const step: NightStep | undefined = nightSteps[index];

  const derived = useMemo(() => {
    const seduced = seducedPlayer(state) ?? null;
    return {
      /** Tonight's seduced player, if the Hooker has chosen. */
      seduced,
      /** Wolf attacks that will land (after the Leprechaun, minus seduced attackers). */
      attacks: wolfAttacks(state),
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
