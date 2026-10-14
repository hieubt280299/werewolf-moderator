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
import type { GameModifiers, GameState, NightActionField, NightTargetListField, Player, RoleId, SetupDraft } from '../@types/game';
import { buildGameRecord, createId, EMPTY_STATUS } from '../utils/gameCalculations';
import * as rules from '../utils/gameRules';
import { readJSON, STORAGE_KEYS, writeJSON } from '../utils/storage';
import { useAuth } from './AuthContext';

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'UPDATE_SETUP'; patch: Partial<SetupDraft> }
  | { type: 'START_GAME'; players: Player[] }
  | { type: 'START_NIGHT' }
  | { type: 'SET_NIGHT_STEP'; index: number }
  | { type: 'SET_NIGHT_ACTION'; field: NightActionField; value: string | null }
  | { type: 'SET_TARGET_LIST'; field: NightTargetListField; targets: string[] }
  | { type: 'RESOLVE_NIGHT' }
  | { type: 'START_DAY' }
  | { type: 'NOMINATE'; accusedId: string; accuserIds: string[] }
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
  | { type: 'MARK_RECORDED' }
  | { type: 'UNDO' };

/** Actions worth an undo checkpoint. Fine-grained edits (votes, night picks) are not. */
const UNDOABLE = new Set<GameAction['type']>([
  'START_GAME', 'START_NIGHT', 'RESOLVE_NIGHT', 'START_DAY', 'NOMINATE', 'REMOVE_NOMINATION',
  'EXECUTE', 'CLOSE_DAY', 'HUNTER_SHOT', 'MOD_ELIMINATE', 'REVIVE', 'REMATCH', 'NEW_GAME',
]);
const HISTORY_LIMIT = 40;

const DEFAULT_POOL: RoleId[] = [
  'villager', 'werewolf', 'seer', 'bodyguard', 'hunter', 'witch', 'prince', 'diseased', 'lycan', 'cursed', 'wolfCub', 'sorceress', 'spellcaster',
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const DEFAULT_MODIFIERS: GameModifiers = {
  wolvesSkipNextNight: false,
  wolvesDoubleKill: false,
  bodyguardLastTarget: null,
  witchHealUsed: false,
  witchKillUsed: false,
  vampireTriggeredToday: false,
  direWolfCompanion: null,
  doppelgangerTarget: null,
  virginiaTarget: null,
  priestUsed: false,
  piUsed: false,
  troublemakerUsed: false,
  extraExecution: false,
  tannerWinner: null,
};

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
    modifiers: { ...DEFAULT_MODIFIERS },
    lastReport: null,
    nominations: [],
    executedToday: null,
    executionsLeft: 1,
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

/** A game is "active" (resumable from the hub) once dealt and until it ends. */
export const isActiveGame = (s: GameState): boolean => s.phase === 'night' || s.phase === 'dawn' || s.phase === 'day';

const isGameState = (value: unknown): value is GameState =>
  !!value && typeof value === 'object' && (value as GameState).version === 1 && Array.isArray((value as GameState).players);

/**
 * Fills fields added after a game was saved (new roles' modifiers, statuses, report
 * fields), so older games from localStorage or Firestore keep loading.
 */
export function normalizeGameState(s: GameState): GameState {
  return {
    ...s,
    executionsLeft: s.executionsLeft ?? 1,
    nightActions: { ...rules.emptyNightActions(), ...s.nightActions },
    modifiers: { ...DEFAULT_MODIFIERS, ...s.modifiers },
    lastReport: s.lastReport ? { ...rules.emptyReport(s.lastReport.round), ...s.lastReport } : null,
    players: s.players.map((p) => ({ ...p, status: { ...EMPTY_STATUS, ...p.status } })),
    nominations: (s.nominations ?? []).map((n) => {
      const legacy = n as typeof n & { accuserId?: string | null };
      return { ...n, accuserIds: n.accuserIds ?? (legacy.accuserId ? [legacy.accuserId] : []) };
    }),
  };
}

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
    case 'SET_TARGET_LIST': {
      if (action.field === 'cupidTargets') {
        return { ...state, nightActions: { ...state.nightActions, cupidTargets: action.targets } };
      }
      // Retargeting the wolves invalidates the Leprechaun's redirect and a Witch heal
      // aimed at the old victim.
      const next = { ...state, nightActions: { ...state.nightActions, wolfTargets: action.targets, leprechaunTarget: null } };
      const save = next.nightActions.witchSaveTarget;
      next.nightActions.witchSaveTarget = save && rules.effectiveWolfTargets(next).includes(save) ? save : null;
      return next;
    }
    case 'RESOLVE_NIGHT':
      return rules.resolveNight(state);
    case 'START_DAY':
      return rules.startDay(state);
    case 'NOMINATE':
      return rules.nominate(state, action.accusedId, action.accuserIds);
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
      // Same players and deck, but the wizard starts over at the Players step.
      return createInitialState({ ...state.setup, names: state.players.map((p) => p.name), step: 'players', deal: null });
    case 'NEW_GAME':
      return createInitialState({ experience: state.setup.experience, pool: state.setup.pool });
    case 'HYDRATE':
      return normalizeGameState(action.state);
    case 'MARK_RECORDED':
      return { ...state, recordedAt: Date.now() };
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
  if (action.type === 'HYDRATE') return { past: [], present: normalizeGameState(action.state) };

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

/**
 * Game state for one signed-in moderator. Persisted per user in localStorage; with Firebase
 * it is also mirrored to users/{uid}/session/active so another device can continue it.
 * Finished games are written to the moderator's history exactly once per game id.
 */
export function GameProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const { store, recordGame } = useAuth();
  const storageKey = `${STORAGE_KEYS.game}:${uid}`;
  const [history, dispatch] = useReducer(historyReducer, undefined, () => {
    const stored = readJSON<unknown>(storageKey, null);
    return { past: [], present: isGameState(stored) ? normalizeGameState(stored) : createInitialState() };
  });
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncTimer = useRef<number>();
  const cloudChecked = useRef(false);
  const cloud = store?.mode === 'firebase' ? store : null;

  const { present } = history;

  useEffect(() => {
    writeJSON(storageKey, present);
  }, [storageKey, present]);

  // On sign-in, resume a cloud game if this device has nothing in progress.
  useEffect(() => {
    if (!cloud || cloudChecked.current) return;
    cloudChecked.current = true;
    if (isActiveGame(present)) return;
    cloud
      .loadActiveGame(uid)
      .then((remote) => {
        if (remote && isGameState(remote) && isActiveGame(remote)) dispatch({ type: 'HYDRATE', state: remote });
      })
      .catch((err: unknown) => setSyncError(err instanceof Error ? err.message : String(err)));
  }, [cloud, uid, present]);

  // Debounced mirror of the in-progress game.
  useEffect(() => {
    if (!cloud || !cloudChecked.current) return;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      cloud
        .saveActiveGame(uid, isActiveGame(present) ? present : null)
        .then(() => setSyncError(null))
        .catch((err: unknown) => setSyncError(err instanceof Error ? err.message : String(err)));
    }, 1500);
    return () => window.clearTimeout(syncTimer.current);
  }, [cloud, uid, present]);

  // Write finished games to history (and lifetime stats) once.
  useEffect(() => {
    if (present.phase !== 'gameOver' || present.recordedAt) return;
    const record = buildGameRecord(present);
    if (!record) return;
    dispatch({ type: 'MARK_RECORDED' });
    recordGame(record).catch((err: unknown) => setSyncError(err instanceof Error ? err.message : String(err)));
  }, [present, recordGame]);

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
