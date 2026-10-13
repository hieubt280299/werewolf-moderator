import { useMemo } from 'react';
import type { NightActionField, NightStep, Player, RoleId } from '../@types/game';
import { useGame } from '../context/GameContext';
import { ROLES } from '../data/roles';
import { playCue } from '../services/sfx';
import { calculateBalance } from '../utils/gameCalculations';
import {
  alivePlayers,
  buildNightSteps,
  eligibleTargets,
  evaluateWinner,
  isWolfPlayer,
  seerResult,
  sorceressResult,
  votesNeeded,
  type WitchMode,
} from '../utils/gameRules';

/**
 * The moderator-facing game API: derived state (night script, living players,
 * thresholds) plus intent-named commands that wrap dispatch and fire SFX cues.
 */
export function useGameEngine() {
  const { state, dispatch, canUndo, syncError } = useGame();

  // The script only depends on who is alive and the modifiers, which are frozen during a night.
  const nightSteps = useMemo<NightStep[]>(
    () => (state.phase === 'night' ? buildNightSteps(state) : []),
    [state.phase, state.players, state.deck, state.modifiers],
  );

  const derived = useMemo(() => {
    const alive = alivePlayers(state.players);
    const byId = new Map<string, Player>(state.players.map((p) => [p.id, p]));
    return {
      alive,
      byId,
      wolvesAlive: alive.filter(isWolfPlayer).length,
      threatsAlive: alive.filter((p) => isWolfPlayer(p) || p.roleId === 'vampire').length,
      deckBalance: calculateBalance(state.deck),
      votesNeeded: votesNeeded(state),
      pendingTrigger: state.pendingTriggers[0] ?? null,
      projectedWinner: evaluateWinner(state.players),
    };
  }, [state]);

  const commands = useMemo(
    () => ({
      startGame: (players: Player[]) => {
        dispatch({ type: 'START_GAME', players });
        playCue('sleep');
      },
      startNight: () => {
        dispatch({ type: 'START_NIGHT' });
        playCue('sleep');
      },
      goToNightStep: (index: number) => {
        dispatch({ type: 'SET_NIGHT_STEP', index });
        playCue('wake');
      },
      setNightAction: (field: NightActionField, value: string | null) => {
        dispatch({ type: 'SET_NIGHT_ACTION', field, value });
        playCue('select');
      },
      setWolfTargets: (targets: string[]) => {
        dispatch({ type: 'SET_WOLF_TARGETS', targets });
        playCue('select');
      },
      resolveNight: () => {
        dispatch({ type: 'RESOLVE_NIGHT' });
        playCue('dawn');
      },
      startDay: () => dispatch({ type: 'START_DAY' }),
      nominate: (accusedId: string, accuserId: string | null) => {
        dispatch({ type: 'NOMINATE', accusedId, accuserId });
        playCue('vote');
      },
      setVoters: (nominationId: string, voters: string[]) => dispatch({ type: 'SET_VOTERS', nominationId, voters }),
      withdrawNomination: (nominationId: string) => dispatch({ type: 'REMOVE_NOMINATION', nominationId }),
      execute: (nominationId: string) => {
        dispatch({ type: 'EXECUTE', nominationId });
        playCue('death');
      },
      closeDay: () => dispatch({ type: 'CLOSE_DAY' }),
      hunterShot: (triggerId: string, targetId: string | null) => {
        dispatch({ type: 'HUNTER_SHOT', triggerId, targetId });
        if (targetId) playCue('death');
      },
      eliminate: (playerId: string) => {
        dispatch({ type: 'MOD_ELIMINATE', playerId });
        playCue('death');
      },
      revive: (playerId: string) => dispatch({ type: 'REVIVE', playerId }),
      rematch: () => dispatch({ type: 'REMATCH' }),
      newGame: () => dispatch({ type: 'NEW_GAME' }),
      undo: () => dispatch({ type: 'UNDO' }),
    }),
    [dispatch],
  );

  const queries = useMemo(
    () => ({
      targetsFor: (step: NightStep, mode?: WitchMode) => eligibleTargets(state, step, mode),
      seerResult,
      sorceressResult,
      role: (id: RoleId) => ROLES[id],
    }),
    [state],
  );

  return { state, nightSteps, canUndo, syncError, dispatch, ...derived, ...commands, ...queries };
}
