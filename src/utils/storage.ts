/** localStorage wrappers that never throw (private mode, quota, disabled storage). */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the game still runs in memory */
  }
}

export const STORAGE_KEYS = {
  game: 'wwgm:game:v1',
  settings: 'wwgm:settings:v1',
  language: 'wwgm:lang:v1',
  /** Players list or seat map on the moderator board. */
  boardView: 'wwgm:board-view:v1',
  /** Seat map orientation, in degrees, so it stays aligned with the moderator's seat. */
  seatRotation: 'wwgm:seat-rotation:v1',
  /** Accounts (uids) whose "set a password again" prompt was dismissed on this device. */
  restorePasswordDismissed: 'wwgm:restore-password-dismissed:v1',
} as const;
