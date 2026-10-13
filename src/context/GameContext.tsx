import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { GameState, NightActionField, Player, RoleId, SetupDraft } from '../@types/game';
import { cloudAvailable, pushToCloud } from '../services/cloud';
import { createId } from '../utils/gameCalculations';
import * as rules from '../utils/gameRules';
import { readJSON, STORAGE_KEYS, writeJSON } from '../utils/storage';
import { useSettings } from './SettingsContext';

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'UPDATE_SETUP'; patch: Partial<SetupDraft> }
  | { type: 'START_GAME'; players: Player[] }
  | { type: 'START_NIGHT' }
  | { type: 'SET_NIGHT_STEP'; index: number }
  | { type: 'SET_NIGHT_ACTION'; field: NightActionField; value: string | null }
  | { type: 'SET_WOLF_TARGETS'; targets: string[] }
  | { type: 'RESOLVE_NIGHT' }
  | { type: 'START_DAY' }
  | { type: 'NOMINATE'; accusedId: string; accuserId: string | null }
  | { type: 'SET_VOTERS'; nominationId: string; voters: string[] }
  | { type: 'REMOVE_NOMINATION'; nominationId: string }
  | { type: 'EXECUTE'; nominationId: string }
  | { type: 'CLOSE_DAY' }
  | { type: 'HUNTER_SHOT'; triggerId: string; targetId: string | null }
  | { type: 'MOD_ELIMINATE'; playerId: string }
  | { type: 'REVIVE'; playerId: string }
  | { type: 'REMATCH' }
  | { type: 'NEW_GAME' }
  | { type: 'HYDRATE'; state: GameState }
  | { type: 'UNDO' };

/** Actions worth an undo checkpoint. Fine-grained edits (votes, night picks) are not. */
const UNDOABLE = new Set<GameAction['type']>([
  'START_GAME', 'START_NIGHT', 'RESOLVE_NIGHT', 'START_DAY', 'NOMINATE', 'REMOVE_NOMINATION',
  'EXECUTE', 'CLOSE_DAY', 'HUNTER_SHOT', 'MOD_ELIMINATE', 'REVIVE', 'REMATCH', 'NEW_GAME',
]);
const HISTORY_LIMIT = 40;

const DEFAULT_POOL: RoleId[] = [
  'seer', 'bodyguard', 'hunter', 'witch', 'prince', 'diseased', 'lycan', 'cursed', 'wolfCub', 'sorceress', 'spellcaster',
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function createInitialState(setup?: Partial<SetupDraft>): GameState {
  const now = Date.now();
  return {
    version: 1,
    id: createId('game'),
    phase: 'setup',
    round: 0,
    dayStep: 'discussion',
    players: [],
    deck: [],
    nightStepIndex: 0,
    nightActions: rules.emptyNightActions(),
    modifiers: {
      wolvesSkipNextNight: false,
      wolvesDoubleKill: false,
      bodyguardLastTarget: null,
      witchHealUsed: false,
      witchKillUsed: false,
      vampireTriggeredToday: false,
    },
    lastReport: null,
    nominations: [],
    executedToday: null,
    pendingTriggers: [],
    winner: null,
    log: [],
    setup: {
      names: Array.from({ length: 8 }, () => ''),
      deck: [],
      pool: DEFAULT_POOL,
      experience: 'standard',
      ...setup,
    },
    createdAt: now,
    updatedAt: now,
  };
}

const isGameState = (value: unknown): value is GameState =>
  !!value && typeof value === 'object' && (value as GameState).version === 1 && Array.isArray((value as GameState).players);

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'UPDATE_SETUP':
      return { ...state, setup: { ...state.setup, ...action.patch } };
    case 'START_GAME': {
      const started: GameState = {
        ...createInitialState(state.setup),
        players: action.players,
        deck: action.players.map((p) => p.originalRoleId),
        log: [{ id: createId('log'), round: 0, phase: 'setup', key: 'log.gameStarted', params: { count: action.players.length } }],
      };
      return rules.startNight(started);
    }
    case 'START_NIGHT':
      return rules.startNight(state);
    case 'SET_NIGHT_STEP':
      return { ...state, nightStepIndex: Math.max(0, action.index) };
    case 'SET_NIGHT_ACTION':
      return { ...state, nightActions: { ...state.nightActions, [action.field]: action.value } };
    case 'SET_WOLF_TARGETS': {
      // Retargeting the wolves invalidates a Witch heal aimed at the old victim.
      const save = state.nightActions.witchSaveTarget;
      return {
        ...state,
        nightActions: {
          ...state.nightActions,
          wolfTargets: action.targets,
          witchSaveTarget: save && action.targets.includes(save) ? save : null,
        },
      };
    }
    case 'RESOLVE_NIGHT':
      return rules.resolveNight(state);
    case 'START_DAY':
      return rules.startDay(state);
    case 'NOMINATE':
      return rules.nominate(state, action.accusedId, action.accuserId);
    case 'SET_VOTERS':
      return rules.setVoters(state, action.nominationId, action.voters);
    case 'REMOVE_NOMINATION':
      return rules.removeNomination(state, action.nominationId);
    case 'EXECUTE':
      return rules.executeNomination(state, action.nominationId);
    case 'CLOSE_DAY':
      return rules.closeDayWithoutExecution(state);
    case 'HUNTER_SHOT':
      return rules.resolveHunterShot(state, action.triggerId, action.targetId);
    case 'MOD_ELIMINATE':
      return rules.moderatorEliminate(state, action.playerId);
    case 'REVIVE':
      return rules.revivePlayer(state, action.playerId);
    case 'REMATCH':
      return createInitialState({ ...state.setup, names: state.players.map((p) => p.name) });
    case 'NEW_GAME':
      return createInitialState({ experience: state.setup.experience, pool: state.setup.pool });
    case 'HYDRATE':
      return action.state;
    case 'UNDO':
      return state; // handled by historyReducer
  }
}

interface History {
  past: GameState[];
  present: GameState;
}

function historyReducer(history: History, action: GameAction): History {
  if (action.type === 'UNDO') {
    const previous = history.past[history.past.length - 1];
    return previous ? { past: history.past.slice(0, -1), present: previous } : history;
  }
  if (action.type === 'HYDRATE') return { past: [], present: action.state };

  const next = gameReducer(history.present, action);
  if (next === history.present) return history;
  const present = { ...next, updatedAt: Date.now() };
  const past = UNDOABLE.has(action.type)
    ? [...history.past, history.present].slice(-HISTORY_LIMIT)
    : history.past;
  return { past, present };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canUndo: boolean;
  syncError: string | null;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { cloudSync } = useSettings();
  const [history, dispatch] = useReducer(historyReducer, undefined, () => {
    const stored = readJSON<unknown>(STORAGE_KEYS.game, null);
    return { past: [], present: isGameState(stored) ? stored : createInitialState() };
  });
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncTimer = useRef<number>();

  const { present } = history;

  useEffect(() => {
    writeJSON(STORAGE_KEYS.game, present);
  }, [present]);

  // Debounced Firestore backup — only when the moderator opted in and Firebase is configured.
  useEffect(() => {
    if (!cloudSync || !cloudAvailable) return;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      pushToCloud(present)
        .then(() => setSyncError(null))
        .catch((err: unknown) => setSyncError(err instanceof Error ? err.message : String(err)));
    }, 1500);
    return () => window.clearTimeout(syncTimer.current);
  }, [present, cloudSync]);

  const value = useMemo<GameContextValue>(
    () => ({ state: present, dispatch, canUndo: history.past.length > 0, syncError }),
    [present, history.past.length, syncError],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
