import type { GameRecord, GameState, LifetimeStats, SessionUser, UserProfile } from '../@types/game';
import { createId } from '../utils/gameCalculations';
import { readJSON, writeJSON } from '../utils/storage';
import {
  applyStatsDelta,
  assertCredentials,
  AuthError,
  newProfile,
  normalizeUsername,
  statsDelta,
  type ProfileStore,
} from './profileStore';

/**
 * Device-local accounts (offline fallback). Passwords are salted + SHA-256 hashed so they
 * aren't stored in plain text, but this is a convenience lock, not real security —
 * anyone with access to the browser profile can read the data.
 */

interface Account {
  uid: string;
  salt: string;
  hash: string;
}

const KEYS = {
  accounts: 'wwgm:accounts:v1',
  session: 'wwgm:session:v1',
  profile: (uid: string) => `wwgm:profile:v1:${uid}`,
  history: (uid: string) => `wwgm:history:v1:${uid}`,
};
const HISTORY_LIMIT = 100;

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Insecure-context fallback (plain http on a LAN IP): FNV-1a — still avoids plain text.
  let h = 0x811c9dc5;
  for (const byte of data) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  return h.toString(16);
}

export function createLocalStore(): ProfileStore {
  const listeners = new Set<(u: SessionUser | null) => void>();
  const accounts = () => readJSON<Record<string, Account>>(KEYS.accounts, {});
  const session = () => readJSON<SessionUser | null>(KEYS.session, null);
  const setSession = (user: SessionUser | null) => {
    writeJSON(KEYS.session, user);
    listeners.forEach((cb) => cb(user));
  };
  const current = () => {
    const user = session();
    if (!user) throw new AuthError('generic', 'Not signed in');
    return user;
  };

  return {
    mode: 'local',

    onAuthChange(callback) {
      listeners.add(callback);
      queueMicrotask(() => callback(session()));
      return () => listeners.delete(callback);
    },

    async signUp(rawUsername, password, displayName) {
      const username = normalizeUsername(rawUsername);
      assertCredentials(username, password);
      const all = accounts();
      if (all[username]) throw new AuthError('taken');
      const salt = createId('salt');
      const uid = createId('u');
      all[username] = { uid, salt, hash: await hashPassword(password, salt) };
      writeJSON(KEYS.accounts, all);
      writeJSON(KEYS.profile(uid), newProfile({ uid, username }, displayName));
      setSession({ uid, username });
    },

    async signIn(rawUsername, password) {
      const username = normalizeUsername(rawUsername);
      const account = accounts()[username];
      if (!account || account.hash !== (await hashPassword(password, account.salt))) {
        throw new AuthError('badCredentials');
      }
      setSession({ uid: account.uid, username });
    },

    async signOut() {
      setSession(null);
    },

    async changePassword(currentPassword, next) {
      const { username } = current();
      const all = accounts();
      const account = all[username];
      if (!account || account.hash !== (await hashPassword(currentPassword, account.salt))) {
        throw new AuthError('badCredentials');
      }
      assertCredentials(username, next);
      account.salt = createId('salt');
      account.hash = await hashPassword(next, account.salt);
      writeJSON(KEYS.accounts, all);
    },

    async loadProfile(user) {
      const stored = readJSON<UserProfile | null>(KEYS.profile(user.uid), null);
      if (stored) return stored;
      const fresh = newProfile(user);
      writeJSON(KEYS.profile(user.uid), fresh);
      return fresh;
    },

    async saveProfile(uid, patch) {
      const profile = readJSON<UserProfile | null>(KEYS.profile(uid), null);
      if (profile) writeJSON(KEYS.profile(uid), { ...profile, ...patch });
    },

    async recordGame(uid, record): Promise<LifetimeStats> {
      const history = readJSON<GameRecord[]>(KEYS.history(uid), []);
      const previous = history.find((g) => g.id === record.id) ?? null;
      writeJSON(KEYS.history(uid), [record, ...history.filter((g) => g.id !== record.id)].slice(0, HISTORY_LIMIT));
      const profile = readJSON<UserProfile | null>(KEYS.profile(uid), null);
      if (!profile) throw new AuthError('generic', 'Profile missing');
      const stats = applyStatsDelta(profile.stats, statsDelta(record.winner, previous?.winner ?? null));
      writeJSON(KEYS.profile(uid), { ...profile, stats });
      return stats;
    },

    async listGames(uid) {
      return readJSON<GameRecord[]>(KEYS.history(uid), []);
    },

    // The active game already lives in localStorage (GameContext); nothing extra to sync.
    async saveActiveGame(_uid: string, _state: GameState | null) {},
    async loadActiveGame() {
      return null;
    },
  };
}
