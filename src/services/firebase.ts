import { FirebaseError, initializeApp } from 'firebase/app';
import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  verifyPasswordResetCode,
  type ActionCodeSettings,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { GameRecord, GameState, Language, UserProfile } from '../@types/game';
import { readJSON, STORAGE_KEYS } from '../utils/storage';
import {
  applyStatsDelta,
  assertCredentials,
  assertEmail,
  assertPassword,
  AuthError,
  EMPTY_STATS,
  maskEmail,
  newProfile,
  normalizeEmail,
  normalizeUsername,
  statsDelta,
  USERNAME_PATTERN,
  type AuthErrorCode,
  type ProfileStore,
} from './profileStore';

/**
 * Firebase backend.
 *
 * Moderators sign in with a username, but Firebase Auth signs in by email, so each username
 * maps to its account's email in `usernames/{username}`. Since v1.0.0 that email is the
 * moderator's recovery email, which lets Firebase send its own password-reset link there.
 * Accounts made before v1.0.0 use a synthetic address under a reserved domain (no mail is
 * ever sent to it) until a recovery email is added and confirmed.
 *
 * Firestore layout:
 *   usernames/{username}        { uid, email, pendingEmail? } — readable by id, so sign-in
 *                               can find the email before anyone is signed in
 *   users/{uid}                 profile: username, displayName, recoveryEmail, pools (≤10),
 *                               stats, rebalances — private to the owner
 *   users/{uid}/games/{gameId}  finished game records
 *   users/{uid}/session/active  the in-progress game (JSON string)
 */
const USERNAME_EMAIL_DOMAIN = 'werewolf-gm.example.com';
const legacyEmail = (username: string) => `${username}@${USERNAME_EMAIL_DOMAIN}`;
const isLegacyEmail = (email: string | null | undefined) => !!email && email.endsWith(`@${USERNAME_EMAIL_DOMAIN}`);
/** Only synthetic addresses carry the username; real ones are resolved from the profile. */
const legacyUsername = (email: string | null) => (isLegacyEmail(email) ? (email ?? '').split('@')[0] : '');

interface UsernameEntry {
  uid: string;
  email: string;
  /** A new recovery email whose confirmation link hasn't been opened yet. */
  pendingEmail?: string;
}

const HISTORY_PAGE = 50;

/** Firestore rejects `undefined`; a JSON round-trip strips it. */
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const CREDENTIAL_ERRORS = new Set(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials']);
/** Continue URLs need the app's domain in the console's Authorized domains; without it, send the plain email. */
const CONTINUE_URL_ERRORS = new Set(['auth/unauthorized-continue-uri', 'auth/invalid-continue-uri', 'auth/missing-continue-uri']);
const codeOf = (err: unknown) => (err instanceof FirebaseError ? err.code : '');

function mapError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  const code = codeOf(err);
  const map: Record<string, AuthErrorCode> = {
    'auth/email-already-in-use': 'emailTaken',
    'auth/invalid-credential': 'badCredentials',
    'auth/invalid-login-credentials': 'badCredentials',
    'auth/wrong-password': 'badCredentials',
    'auth/user-not-found': 'badCredentials',
    'auth/invalid-email': 'invalidEmail',
    'auth/weak-password': 'weakPassword',
    'auth/too-many-requests': 'tooMany',
    'auth/network-request-failed': 'network',
    'auth/invalid-action-code': 'linkInvalid',
    'auth/expired-action-code': 'linkInvalid',
  };
  return new AuthError(map[code] ?? 'generic', err instanceof Error ? err.message : String(err));
}

export function createFirebaseStore(): ProfileStore {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const userDoc = (uid: string) => doc(db, 'users', uid);
  const usernameDoc = (username: string) => doc(db, 'usernames', username);
  /** Sign-up writes the profile right after the account exists; profile loads wait for it. */
  let signUpInFlight: Promise<unknown> | null = null;

  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      throw mapError(err);
    }
  };

  const lookup = async (username: string): Promise<UsernameEntry | null> => {
    const snap = await getDoc(usernameDoc(username));
    return snap.exists() ? (snap.data() as UsernameEntry) : null;
  };

  /** Firebase's emails follow the app's language; links bring the moderator back to the app. */
  const sendWithContinueUrl = async (send: (settings?: ActionCodeSettings) => Promise<void>) => {
    auth.languageCode = readJSON<Language>(STORAGE_KEYS.language, 'vi');
    try {
      await send({ url: `${window.location.origin}/` });
    } catch (err) {
      if (!CONTINUE_URL_ERRORS.has(codeOf(err))) throw err;
      await send();
    }
  };

  const reauthenticate = async (current: string): Promise<User & { email: string }> => {
    const user = auth.currentUser;
    if (!user?.email) throw new AuthError('generic', 'Not signed in');
    // Firebase requires a recent sign-in before changing the password or email.
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
    return user as User & { email: string };
  };

  /**
   * Keeps `usernames/{username}` and the profile in step with the account's real email: adds
   * the entry for accounts made before it existed, and promotes a pending recovery email once
   * its confirmation link has been opened (Firebase then switches the account's email).
   */
  const syncRecoveryEmail = async (uid: string, username: string, profile: UserProfile): Promise<UserProfile> => {
    const authEmail = auth.currentUser?.email ?? null;
    if (!username || !authEmail) return profile;
    let next = profile;
    if (!isLegacyEmail(authEmail) && profile.recoveryEmail !== authEmail) {
      const pending = profile.pendingRecoveryEmail === authEmail ? null : (profile.pendingRecoveryEmail ?? null);
      next = { ...profile, recoveryEmail: authEmail, pendingRecoveryEmail: pending };
      // Best effort: a failed write is retried on the next load and never blocks sign-in.
      await updateDoc(userDoc(uid), { recoveryEmail: authEmail, pendingRecoveryEmail: pending, updatedAt: serverTimestamp() }).catch(() => undefined);
    }
    try {
      const entry = await lookup(username);
      if (!entry || entry.email !== authEmail) {
        const pending = entry?.pendingEmail && entry.pendingEmail !== authEmail ? { pendingEmail: entry.pendingEmail } : {};
        await setDoc(usernameDoc(username), { uid, email: authEmail, ...pending });
      }
    } catch {
      // Another account holds this username entry (rules refuse the write) — leave it.
    }
    return next;
  };

  return {
    mode: 'firebase',

    onAuthChange(callback) {
      return onAuthStateChanged(auth, (user) =>
        callback(user ? { uid: user.uid, username: legacyUsername(user.email) } : null),
      );
    },

    signUp: (rawUsername, password, displayName, rawEmail) => {
      const run = wrap(async () => {
        const username = normalizeUsername(rawUsername);
        const email = normalizeEmail(rawEmail);
        assertCredentials(username, password);
        assertEmail(email);
        if (await lookup(username)) throw new AuthError('taken');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        try {
          await setDoc(usernameDoc(username), { uid: cred.user.uid, email });
        } catch {
          // Someone claimed the username in the meantime: undo the account.
          await deleteUser(cred.user).catch(() => undefined);
          throw new AuthError('taken');
        }
        const profile = newProfile({ uid: cred.user.uid, username }, displayName, email);
        await updateProfile(cred.user, { displayName: profile.displayName });
        await setDoc(userDoc(cred.user.uid), { ...clean(profile), updatedAt: serverTimestamp() });
      });
      signUpInFlight = run;
      return run.finally(() => {
        if (signUpInFlight === run) signUpInFlight = null;
      });
    },

    signIn: (rawUsername, password) =>
      wrap(async () => {
        const username = normalizeUsername(rawUsername);
        const entry = await lookup(username);
        // A pending email becomes the account's email once confirmed, so try it as well.
        const candidates = entry ? [entry.email, entry.pendingEmail].filter((e): e is string => !!e) : [legacyEmail(username)];
        let failure: unknown = new AuthError('badCredentials');
        for (const email of candidates) {
          try {
            await signInWithEmailAndPassword(auth, email, password);
            return;
          } catch (err) {
            if (!CREDENTIAL_ERRORS.has(codeOf(err))) throw err;
            failure = err;
          }
        }
        throw failure;
      }),

    signOut: () => wrap(() => signOut(auth)),

    changePassword: (current, next) =>
      wrap(async () => {
        const user = await reauthenticate(current);
        assertPassword(next);
        await updatePassword(user, next);
      }),

    changeRecoveryEmail: (current, rawEmail) =>
      wrap(async () => {
        const email = normalizeEmail(rawEmail);
        assertEmail(email);
        const user = await reauthenticate(current);
        if (email === user.email) return { email, pending: false };
        // Firebase switches the account's email only once the link sent to the new address is opened.
        await sendWithContinueUrl((settings) => verifyBeforeUpdateEmail(user, email, settings));
        const username = ((await getDoc(userDoc(user.uid))).data() as Partial<UserProfile> | undefined)?.username;
        if (username) await setDoc(usernameDoc(username), { uid: user.uid, email: user.email, pendingEmail: email });
        await updateDoc(userDoc(user.uid), { pendingRecoveryEmail: email, updatedAt: serverTimestamp() });
        return { email, pending: true };
      }),

    requestPasswordReset: (rawUsername) =>
      wrap(async () => {
        const username = normalizeUsername(rawUsername);
        if (!USERNAME_PATTERN.test(username)) throw new AuthError('invalidUsername');
        const entry = await lookup(username);
        // Unconfirmed or confirmed, one of these is the account's email right now; Firebase only
        // mails an address that has an account.
        const targets = [...new Set([entry?.pendingEmail, entry?.email])].filter((e): e is string => !!e && !isLegacyEmail(e));
        if (targets.length === 0) throw new AuthError('noRecoveryEmail');
        let sent = 0;
        for (const email of targets) {
          try {
            await sendWithContinueUrl((settings) => sendPasswordResetEmail(auth, email, settings));
            sent += 1;
          } catch (err) {
            if (codeOf(err) !== 'auth/user-not-found') throw err;
          }
        }
        if (sent === 0) throw new AuthError('noRecoveryEmail');
        return { method: 'link', maskedEmail: targets.map(maskEmail).join(' · ') };
      }),

    verifyResetCode: () => Promise.reject(new AuthError('generic', 'Firebase accounts reset by emailed link')),

    checkResetLink: (oobCode) => wrap(() => verifyPasswordResetCode(auth, oobCode)),

    completePasswordReset: (oobCode, next) =>
      wrap(async () => {
        assertPassword(next);
        await confirmPasswordReset(auth, oobCode, next);
      }),

    applyEmailAction: (oobCode) =>
      wrap(async () => {
        await applyActionCode(auth, oobCode);
        await auth.currentUser?.reload().catch(() => undefined);
      }),

    loadProfile: (user) =>
      wrap(async () => {
        await signUpInFlight?.catch(() => undefined);
        const snap = await getDoc(userDoc(user.uid));
        if (snap.exists()) {
          const data = snap.data() as Partial<UserProfile> & { decks?: unknown };
          // Saved decks from before role pools are discarded (one-off cleanup).
          if ('decks' in data || !Array.isArray(data.pools)) {
            await updateDoc(userDoc(user.uid), { decks: deleteField(), pools: data.pools ?? [] });
          }
          const { decks: _legacy, ...rest } = data;
          const profile = {
            ...newProfile(user),
            ...rest,
            uid: user.uid,
            recoveryEmail: data.recoveryEmail ?? null,
            pools: data.pools ?? [],
            stats: { ...EMPTY_STATS, ...data.stats },
          } as UserProfile;
          return syncRecoveryEmail(user.uid, profile.username, profile);
        }
        // Account exists but its profile doc doesn't (e.g. sign-up interrupted) — heal it.
        const email = auth.currentUser?.email ?? null;
        const fresh = newProfile(user, auth.currentUser?.displayName ?? undefined, isLegacyEmail(email) ? null : email);
        await setDoc(userDoc(user.uid), { ...clean(fresh), updatedAt: serverTimestamp() });
        return fresh;
      }),

    saveProfile: (uid, patch) =>
      wrap(async () => {
        await updateDoc(userDoc(uid), { ...clean(patch), updatedAt: serverTimestamp() });
        if (patch.displayName && auth.currentUser) await updateProfile(auth.currentUser, { displayName: patch.displayName });
      }),

    recordGame: (uid, record) =>
      wrap(async () => {
        const gameRef = doc(db, 'users', uid, 'games', record.id);
        const [existing, profileSnap] = await Promise.all([getDoc(gameRef), getDoc(userDoc(uid))]);
        const previous = existing.exists() ? ((existing.data() as GameRecord).winner ?? null) : null;
        const delta = statsDelta(record.winner, previous);

        const batch = writeBatch(db);
        batch.set(gameRef, clean(record));
        batch.update(
          userDoc(uid),
          Object.fromEntries([
            ...Object.entries(delta).map(([k, v]) => [`stats.${k}`, increment(v)]),
            ['updatedAt', serverTimestamp()],
          ]),
        );
        await batch.commit();
        const stats = { ...EMPTY_STATS, ...(profileSnap.data() as Partial<UserProfile> | undefined)?.stats };
        return applyStatsDelta(stats, delta);
      }),

    listGames: (uid) =>
      wrap(async () => {
        const snap = await getDocs(query(collection(db, 'users', uid, 'games'), orderBy('finishedAt', 'desc'), limit(HISTORY_PAGE)));
        return snap.docs.map((d) => d.data() as GameRecord);
      }),

    saveActiveGame: (uid, state) =>
      wrap(async () => {
        await setDoc(doc(db, 'users', uid, 'session', 'active'), {
          state: state ? JSON.stringify(state) : null,
          savedAt: serverTimestamp(),
        });
      }),

    loadActiveGame: (uid) =>
      wrap(async () => {
        const snap = await getDoc(doc(db, 'users', uid, 'session', 'active'));
        const raw = snap.exists() ? snap.data().state : null;
        return typeof raw === 'string' ? (JSON.parse(raw) as GameState) : null;
      }),
  };
}
