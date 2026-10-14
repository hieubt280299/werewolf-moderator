import type { GameRecord, GameState, LifetimeStats, RolePool, SessionUser, UserProfile, WinTeam } from '../@types/game';

/**
 * Storage backend for moderator accounts. Two implementations share this contract:
 * - Firebase (Auth + Firestore) when the VITE_FIREBASE_* env vars are present;
 * - a device-local fallback so the app stays fully usable offline / before setup.
 */
export interface ProfileStore {
  mode: 'firebase' | 'local';
  onAuthChange(callback: (user: SessionUser | null) => void): () => void;
  signUp(username: string, password: string, displayName: string): Promise<void>;
  signIn(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  loadProfile(user: SessionUser): Promise<UserProfile>;
  saveProfile(uid: string, patch: Partial<Pick<UserProfile, 'displayName' | 'pools'>>): Promise<void>;
  /** Upserts the record and keeps lifetime stats consistent if the same game is re-recorded. */
  recordGame(uid: string, record: GameRecord): Promise<LifetimeStats>;
  listGames(uid: string): Promise<GameRecord[]>;
  saveActiveGame(uid: string, state: GameState | null): Promise<void>;
  loadActiveGame(uid: string): Promise<GameState | null>;
}

export type AuthErrorCode =
  | 'invalidUsername'
  | 'weakPassword'
  | 'taken'
  | 'badCredentials'
  | 'network'
  | 'tooMany'
  | 'generic';

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/;
export const MIN_PASSWORD = 6;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertCredentials(username: string, password: string) {
  if (!USERNAME_PATTERN.test(username)) throw new AuthError('invalidUsername');
  if (password.length < MIN_PASSWORD) throw new AuthError('weakPassword');
}

export const EMPTY_STATS: LifetimeStats = { gamesModerated: 0, werewolfWins: 0, villageWins: 0, otherWins: 0 };

const statKey = (team: WinTeam): keyof LifetimeStats =>
  team === 'werewolf' ? 'werewolfWins' : team === 'village' ? 'villageWins' : 'otherWins';

/** Stats delta for recording `next`, replacing `previous` if the game was recorded before. */
export function statsDelta(next: WinTeam, previous: WinTeam | null): Partial<Record<keyof LifetimeStats, number>> {
  const delta: Partial<Record<keyof LifetimeStats, number>> = {};
  if (previous === null) delta.gamesModerated = 1;
  else delta[statKey(previous)] = -1;
  delta[statKey(next)] = (delta[statKey(next)] ?? 0) + 1;
  return delta;
}

export function applyStatsDelta(stats: LifetimeStats, delta: Partial<Record<keyof LifetimeStats, number>>): LifetimeStats {
  const out = { ...stats };
  for (const [k, v] of Object.entries(delta) as [keyof LifetimeStats, number][]) out[k] = Math.max(0, out[k] + v);
  return out;
}

export function newProfile(user: SessionUser, displayName?: string): UserProfile {
  return {
    uid: user.uid,
    username: user.username,
    displayName: displayName?.trim() || user.username,
    pools: [] as RolePool[],
    stats: { ...EMPTY_STATS },
    createdAt: new Date().toISOString(),
  };
}

export const cloudAvailable = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_APP_ID,
);

let storePromise: Promise<ProfileStore> | null = null;

/** Firebase SDK is only downloaded when it's actually configured. */
export function getProfileStore(): Promise<ProfileStore> {
  storePromise ??= cloudAvailable
    ? import('./firebase').then((m) => m.createFirebaseStore())
    : import('./localStore').then((m) => m.createLocalStore());
  return storePromise;
}
