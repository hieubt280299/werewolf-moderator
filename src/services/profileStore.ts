import type { AuthErrorCode, GoogleOutcome, RecoveryEmailChange, ResetDelivery, SessionUser } from '../@types/auth';
import type { GameRecord, GameState, LifetimeStats, RolePool, UserProfile, WinTeam } from '../@types/game';

export type { AuthErrorCode } from '../@types/auth';

/** The signed-in account's sign-in methods and email, as Firebase knows them right now. */
export type AccountInfo = Pick<SessionUser, 'providers' | 'email' | 'emailVerified'>;

/** Firebase only (v1.2.0): Google sign-in and managing how an account signs in. */
export interface CloudAccounts {
  /** Popup, or a redirect where popups don't work (the installed app, a blocked popup). */
  signInWithGoogle(): Promise<GoogleOutcome>;
  /** Picks up a Google redirect started before the page reloaded; null if there was none. */
  resumeGoogleRedirect(): Promise<GoogleOutcome | null>;
  /** After `needsPassword`: signs in to the account that owns the email and links Google to it. */
  linkPendingGoogle(password: string): Promise<void>;
  cancelPendingGoogle(): void;
  /** Links Google to the signed-in account. */
  connectGoogle(): Promise<GoogleOutcome>;
  /** Refused when Google is the account's only way to sign in. */
  disconnectGoogle(): Promise<void>;
  /**
   * Adds username + password sign-in to an account made with Google, or just a password when
   * the profile already has a username (e.g. Google replaced an unverified one). Returns the username.
   */
  addPasswordSignIn(password: string, username?: string): Promise<string>;
  /** Sends the verification link to the account's email. */
  sendVerificationEmail(): Promise<void>;
  account(): AccountInfo | null;
}

/**
 * Storage backend for moderator accounts. Two implementations share this contract:
 * - Firebase (Auth + Firestore) when the VITE_FIREBASE_* env vars are present;
 * - a device-local fallback so the app stays fully usable offline / before setup.
 */
export interface ProfileStore {
  mode: 'firebase' | 'local';
  /** Firebase only: Google sign-in and sign-in methods. */
  cloud?: CloudAccounts;
  onAuthChange(callback: (user: SessionUser | null) => void): () => void;
  signUp(username: string, password: string, displayName: string, recoveryEmail: string): Promise<void>;
  signIn(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  /** Sets a new recovery email; requires the current password. */
  changeRecoveryEmail(currentPassword: string, email: string): Promise<RecoveryEmailChange>;
  /**
   * Forgot password, step 1: sends a 6-digit code (local) or a reset link (Firebase) to the
   * account's recovery email. Local accounts enforce the resend cooldown.
   */
  requestPasswordReset(username: string): Promise<ResetDelivery>;
  /** Step 2 (code delivery only): checks the code and returns a single-use reset ticket. */
  verifyResetCode(username: string, code: string): Promise<string>;
  /** Firebase: the email an emailed reset link belongs to; rejects expired or used links. */
  checkResetLink(oobCode: string): Promise<string>;
  /** Step 3: sets the new password with a ticket (local) or the link's oobCode (Firebase). */
  completePasswordReset(ticket: string, newPassword: string): Promise<void>;
  /** Firebase: applies an emailed account link (confirming a new recovery email). */
  applyEmailAction(oobCode: string): Promise<void>;
  loadProfile(user: SessionUser): Promise<UserProfile>;
  saveProfile(uid: string, patch: Partial<Pick<UserProfile, 'displayName' | 'pools' | 'rebalances'>>): Promise<void>;
  /** Upserts the record and keeps lifetime stats consistent if the same game is re-recorded. */
  recordGame(uid: string, record: GameRecord): Promise<LifetimeStats>;
  listGames(uid: string): Promise<GameRecord[]>;
  saveActiveGame(uid: string, state: GameState | null): Promise<void>;
  loadActiveGame(uid: string): Promise<GameState | null>;
}

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

export function assertPassword(password: string) {
  if (password.length < MIN_PASSWORD) throw new AuthError('weakPassword');
}

export function assertCredentials(username: string, password: string) {
  if (!USERNAME_PATTERN.test(username)) throw new AuthError('invalidUsername');
  assertPassword(password);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export function assertEmail(email: string) {
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new AuthError('invalidEmail');
}

/** "jane.doe@gmail.com" → "j•••e@gmail.com", so a reset screen never shows the full address. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return '•••';
  const shown = name.length <= 2 ? `${name[0] ?? ''}•••` : `${name[0]}•••${name[name.length - 1]}`;
  return `${shown}@${domain}`;
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

export function newProfile(user: SessionUser, displayName?: string, recoveryEmail: string | null = null): UserProfile {
  return {
    uid: user.uid,
    username: user.username,
    // Accounts made with Google have no username: fall back to the email's name.
    displayName: (displayName?.trim() || user.username || recoveryEmail?.split('@')[0] || 'Moderator').slice(0, 30),
    recoveryEmail,
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
