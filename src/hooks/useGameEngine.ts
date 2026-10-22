import { useMemo } from 'react';
import { NO_REBALANCES, type NightActionField, type NightStep, type NightTargetListField, type Player, type RebalanceRules, type RoleId } from '../@types/game';
import { useGame } from '../context/GameContext';
import { ROLES } from '../data/roles';
import { playCue } from '../services/sfx';
import { calculateBalance } from '../utils/gameCalculations';
import {
  alivePlayers,
  auraResult,
  buildNightSteps,
  canNominate,
  eligibleTargets,
  eligibleVoters,
  evaluateWinner,
  isWolfPlayer,
  neighbors,
  piResult,
  seerResult,
  sorceressResult,
  voteCount,
  witchVictims,
  votesNeeded,
  type WitchMode,
} from '../utils/gameRules';

/**
 * The moderator-facing game API: derived state (night script, living players,
 * thresholds) plus intent-named commands that wrap dispatch and fire SFX cues.
 */
export function useGameEngine() {
  const { state, dispatch, canUndo, syncError } = useGame();

  // The script only depends on who is alive, the modifiers (frozen during a night) and the
  // game's house rules (frozen at deal time).
  const nightSteps = useMemo<NightStep[]>(
    () => (state.phase === 'night' ? buildNightSteps(state) : []),
    [state.phase, state.round, state.players, state.deck, state.modifiers, state.rules],
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
      canNominate: canNominate(state),
      projectedWinner: evaluateWinner(state),
    };
  }, [state]);

  const commands = useMemo(
    () => ({
      /** Deals the game; `rules` (house rules at this moment) are frozen for its whole length. */
      startGame: (players: Player[], rules: RebalanceRules = NO_REBALANCES) => {
        dispatch({ type: 'START_GAME', players, rules });
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
      setTargetList: (field: NightTargetListField, targets: string[]) => {
        dispatch({ type: 'SET_TARGET_LIST', field, targets });
        playCue('select');
      },
      resolveNight: () => {
        dispatch({ type: 'RESOLVE_NIGHT' });
        playCue('dawn');
      },
      /** Wolverine's tell, played aloud at dawn. */
      playMetallic: () => playCue('metal'),
      startDay: () => dispatch({ type: 'START_DAY' }),
      nominate: (accusedId: string, accuserIds: string[]) => {
        dispatch({ type: 'NOMINATE', accusedId, accuserIds });
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
      auraResult,
      piResult: (id: string) => piResult(state, id),
      neighborsOf: (id: string) => neighbors(state.players, id),
      /** Who the Witch is shown: the pack's victims (never the Big Bad Wolf's own strike). */
      wolfVictims: () => witchVictims(state),
      voteCount: (nominationId: string) => {
        const nom = state.nominations.find((n) => n.id === nominationId);
        return nom ? voteCount(state, nom) : 0;
      },
      voters: () => eligibleVoters(state),
      role: (id: RoleId) => ROLES[id],
    }),
    [state],
  );

  return { state, nightSteps, canUndo, syncError, dispatch, ...derived, ...commands, ...queries };
}
