import { useSyncExternalStore } from 'react';
import { readJSON, STORAGE_KEYS, writeJSON } from '../utils/storage';

/**
 * How players are shown wherever they're listed or picked (the board and the night script):
 * as a list or round the table. One choice and one table orientation for the whole app,
 * kept in sync live between every open view and remembered on the device.
 */
export type BoardView = 'list' | 'map';

const SAVE_DELAY_MS = 300;

let view: BoardView = readJSON<BoardView>(STORAGE_KEYS.boardView, 'list') === 'map' ? 'map' : 'list';
const viewListeners = new Set<() => void>();

export function setBoardView(next: BoardView): void {
  if (next === view) return;
  view = next;
  writeJSON(STORAGE_KEYS.boardView, next);
  viewListeners.forEach((listener) => listener());
}

const subscribeView = (listener: () => void) => {
  viewListeners.add(listener);
  return () => void viewListeners.delete(listener);
};

export function useBoardView(): [BoardView, (next: BoardView) => void] {
  return [useSyncExternalStore(subscribeView, () => view), setBoardView];
}

export interface RotationChange {
  deg: number;
  /** Ease to the new angle (preset buttons) instead of following a drag. */
  settle: boolean;
  /** The seat map that turned, so it doesn't apply its own change twice. */
  source: symbol | null;
}

let rotation = Number(readJSON<number>(STORAGE_KEYS.seatRotation, 0)) || 0;
const rotationListeners = new Set<(change: RotationChange) => void>();
let saveTimer: number | undefined;

/**
 * The seat map's orientation in degrees. Read and pushed outside React state: a drag turns
 * every open map straight through a CSS variable, with no re-render per frame.
 */
export const seatRotation = {
  get: (): number => rotation,
  set(deg: number, settle: boolean, source: symbol | null = null): void {
    rotation = deg;
    rotationListeners.forEach((listener) => listener({ deg, settle, source }));
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => writeJSON(STORAGE_KEYS.seatRotation, ((rotation % 360) + 360) % 360), SAVE_DELAY_MS);
  },
  subscribe(listener: (change: RotationChange) => void): () => void {
    rotationListeners.add(listener);
    return () => void rotationListeners.delete(listener);
  },
};
