import {
  RESET_CODE_LENGTH,
  RESET_CODE_TTL_MS,
  RESET_MAX_ATTEMPTS,
  RESET_RESEND_SECONDS,
  type SessionUser,
} from '../@types/auth';
import type { GameRecord, GameState, LifetimeStats, UserProfile } from '../@types/game';
import { createId, secureRandom } from '../utils/gameCalculations';
import { readJSON, writeJSON } from '../utils/storage';
import {
  applyStatsDelta,
  assertCredentials,
  assertEmail,
  assertPassword,
  AuthError,
  maskEmail,
  newProfile,
  normalizeEmail,
  normalizeUsername,
  statsDelta,
  type ProfileStore,
} from './profileStore';

/**
 * Device-local accounts (offline fallback). Passwords are salted + SHA-256 hashed so they
 * aren't stored in plain text, but this is a convenience lock, not real security —
 * anyone with access to the browser profile can read the data.
 *
 * Password reset uses a 6-digit verification code. A device has no mail service, so the
 * code is handed back to the screen instead of being emailed; it is stored only as a salted
 * hash, expires, allows a few attempts and can be re-sent after a cooldown.
 */

interface Account {
  uid: string;
  salt: string;
  hash: string;
  /** Recovery email (accounts made before v1.0.0 have none until one is added). */
  email?: string;
}

/** An open password reset for one username. */
interface ResetRecord {
  salt: string;
  codeHash: string | null;
  sentAt: number;
  expiresAt: number;
  attempts: number;
  /** Issued once the code checks out; spent by the new-password step. */
  ticketHash?: string | null;
  ticketExpiresAt?: number;
}

const KEYS = {
  accounts: 'wwgm:accounts:v1',
  session: 'wwgm:session:v1',
  resets: 'wwgm:resets:v1',
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

const randomCode = () => Math.floor(secureRandom() * 10 ** RESET_CODE_LENGTH).toString().padStart(RESET_CODE_LENGTH, '0');

export function createLocalStore(): ProfileStore {
  const listeners = new Set<(u: SessionUser | null) => void>();
  const accounts = () => readJSON<Record<string, Account>>(KEYS.accounts, {});
  const resets = () => readJSON<Record<string, ResetRecord>>(KEYS.resets, {});
  const saveResets = (all: Record<string, ResetRecord>) => writeJSON(KEYS.resets, all);
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
  const checkPassword = async (account: Account | undefined, password: string) => {
    if (!account || account.hash !== (await hashPassword(password, account.salt))) throw new AuthError('badCredentials');
  };
  const setPassword = async (account: Account, password: string) => {
    account.salt = createId('salt');
    account.hash = await hashPassword(password, account.salt);
  };
  const patchStoredProfile = (uid: string, patch: Partial<UserProfile>) => {
    const profile = readJSON<UserProfile | null>(KEYS.profile(uid), null);
    if (profile) writeJSON(KEYS.profile(uid), { ...profile, ...patch });
  };

  return {
    mode: 'local',

    onAuthChange(callback) {
      listeners.add(callback);
      queueMicrotask(() => callback(session()));
      return () => listeners.delete(callback);
    },

    async signUp(rawUsername, password, displayName, rawEmail) {
      const username = normalizeUsername(rawUsername);
      const email = normalizeEmail(rawEmail);
      assertCredentials(username, password);
      assertEmail(email);
      const all = accounts();
      if (all[username]) throw new AuthError('taken');
      const salt = createId('salt');
      const uid = createId('u');
      all[username] = { uid, salt, hash: await hashPassword(password, salt), email };
      writeJSON(KEYS.accounts, all);
      writeJSON(KEYS.profile(uid), newProfile({ uid, username }, displayName, email));
      setSession({ uid, username });
    },

    async signIn(rawUsername, password) {
      const username = normalizeUsername(rawUsername);
      const account = accounts()[username];
      await checkPassword(account, password);
      setSession({ uid: account.uid, username });
    },

    async signOut() {
      setSession(null);
    },

    async changePassword(currentPassword, next) {
      const { username } = current();
      const all = accounts();
      await checkPassword(all[username], currentPassword);
      assertPassword(next);
      await setPassword(all[username], next);
      writeJSON(KEYS.accounts, all);
    },

    async changeRecoveryEmail(currentPassword, rawEmail) {
      const { uid, username } = current();
      const email = normalizeEmail(rawEmail);
      assertEmail(email);
      const all = accounts();
      await checkPassword(all[username], currentPassword);
      all[username].email = email;
      writeJSON(KEYS.accounts, all);
      patchStoredProfile(uid, { recoveryEmail: email, pendingRecoveryEmail: null });
      return { email, pending: false };
    },

    async requestPasswordReset(rawUsername) {
      const username = normalizeUsername(rawUsername);
      const account = accounts()[username];
      if (!account) throw new AuthError('unknownUser');
      if (!account.email) throw new AuthError('noRecoveryEmail');
      const all = resets();
      const now = Date.now();
      const previous = all[username];
      if (previous && now - previous.sentAt < RESET_RESEND_SECONDS * 1000) throw new AuthError('cooldown');
      const code = randomCode();
      const salt = createId('salt');
      all[username] = { salt, codeHash: await hashPassword(code, salt), sentAt: now, expiresAt: now + RESET_CODE_TTL_MS, attempts: 0 };
      saveResets(all);
      return { method: 'code', maskedEmail: maskEmail(account.email), shownCode: code };
    },

    async verifyResetCode(rawUsername, rawCode) {
      const username = normalizeUsername(rawUsername);
      const code = rawCode.replace(/\D/g, '');
      const all = resets();
      const record = all[username];
      if (!record?.codeHash || Date.now() > record.expiresAt) throw new AuthError('codeExpired');
      if (record.attempts >= RESET_MAX_ATTEMPTS) throw new AuthError('tooMany');
      if (code.length !== RESET_CODE_LENGTH || record.codeHash !== (await hashPassword(code, record.salt))) {
        record.attempts += 1;
        saveResets(all);
        throw new AuthError(record.attempts >= RESET_MAX_ATTEMPTS ? 'tooMany' : 'badCode');
      }
      // A code works once: it is swapped for a short-lived ticket for the new-password step.
      const secret = createId('rst');
      record.codeHash = null;
      record.ticketHash = await hashPassword(secret, record.salt);
      record.ticketExpiresAt = Date.now() + RESET_CODE_TTL_MS;
      saveResets(all);
      // Usernames never contain ':', so the ticket splits back unambiguously.
      return `${username}:${secret}`;
    },

    async checkResetLink() {
      throw new AuthError('linkInvalid');
    },

    async completePasswordReset(ticket, next) {
      const split = ticket.indexOf(':');
      const username = ticket.slice(0, split);
      const secret = ticket.slice(split + 1);
      const all = resets();
      const record = all[username];
      if (split < 0 || !record?.ticketHash || Date.now() > (record.ticketExpiresAt ?? 0)) throw new AuthError('codeExpired');
      if (record.ticketHash !== (await hashPassword(secret, record.salt))) throw new AuthError('codeExpired');
      assertPassword(next);
      const accountsNow = accounts();
      const account = accountsNow[username];
      if (!account) throw new AuthError('unknownUser');
      await setPassword(account, next);
      writeJSON(KEYS.accounts, accountsNow);
      delete all[username];
      saveResets(all);
    },

    async applyEmailAction() {
      throw new AuthError('linkInvalid');
    },

    async loadProfile(user) {
      const stored = readJSON<(UserProfile & { decks?: unknown }) | null>(KEYS.profile(user.uid), null);
      const email = accounts()[user.username]?.email ?? null;
      if (stored) {
        // Saved decks from before role pools are discarded (one-off cleanup).
        const { decks: _legacy, ...rest } = stored;
        const cleaned: UserProfile = { ...rest, pools: rest.pools ?? [], recoveryEmail: rest.recoveryEmail ?? email };
        if ('decks' in stored || !Array.isArray(stored.pools) || stored.recoveryEmail === undefined) {
          writeJSON(KEYS.profile(user.uid), cleaned);
        }
        return cleaned;
      }
      const fresh = newProfile(user, undefined, email);
      writeJSON(KEYS.profile(user.uid), fresh);
      return fresh;
    },

    async saveProfile(uid, patch) {
      patchStoredProfile(uid, patch);
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
