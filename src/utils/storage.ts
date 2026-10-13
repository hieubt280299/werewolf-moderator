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
} as const;
