import type { GameState } from '../@types/game';

/**
 * Thin lazy wrapper around ./firebase so the Firebase SDK is only downloaded
 * once cloud sync is actually used.
 */
export const cloudAvailable = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID,
);

export async function pushToCloud(state: GameState): Promise<void> {
  const { saveGameToCloud } = await import('./firebase');
  await saveGameToCloud(state);
}

export async function pullFromCloud(): Promise<GameState | null> {
  const { loadGameFromCloud } = await import('./firebase');
  return loadGameFromCloud();
}
