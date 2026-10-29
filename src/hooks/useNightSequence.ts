import { useMemo } from 'react';
import type { NightGroup, NightStep, Player } from '../@types/game';
import {
  actionSeduced,
  inspectionResult,
  killDebuffs,
  rulesOf,
  seducedPlayer,
  setupIncomplete,
  witchSeesVictims,
  wolfAttacks,
  type InspectAction,
  type KillDebuffs,
} from '../utils/gameRules';
import { useGameEngine } from './useGameEngine';

/**
 * The night's wake-up calls, one at a time, in strict order (night-1 setup must be finished
 * before the night moves past it): night-1 setup →
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
  // Night-1 setup can't be skipped: nothing past the first unfinished setup call is reachable.
  const blocked = nightSteps.findIndex((s) => setupIncomplete(state, s));
  const furthest = blocked >= 0 ? blocked : Math.max(0, total - 1);
  const index = Math.min(state.nightStepIndex, furthest);
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

    const goTo = (i: number) => engine.goToNightStep(Math.max(0, Math.min(i, furthest)));

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
      /** This call is unfinished night-1 setup: Next stays off until its picks are made. */
      setupPending: !!step && setupIncomplete(state, step),
      /** The night can only end once every night-1 setup call is done. */
      canFinish: blocked < 0,
      /** Past the first unfinished setup call: shown, but not reachable yet. */
      locked: (i: number) => i > furthest,
      inspection: (action: InspectAction, targetId: string) => inspectionResult(state, action, targetId),
      goTo,
      next: () => goTo(index + 1),
      back: () => goTo(index - 1),
      finish: () => {
        if (blocked < 0) engine.resolveNight();
      },
    };
  }, [state, nightSteps, step, index, total, blocked, furthest, derived, engine.goToNightStep, engine.resolveNight]);
}
