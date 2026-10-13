import { FirebaseError, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
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
import type { GameRecord, GameState, UserProfile } from '../@types/game';
import {
  applyStatsDelta,
  assertCredentials,
  AuthError,
  EMPTY_STATS,
  newProfile,
  normalizeUsername,
  statsDelta,
  type AuthErrorCode,
  type ProfileStore,
} from './profileStore';

/**
 * Firebase backend.
 *
 * Firebase Auth has no username provider, so each username maps to a synthetic email
 * under a reserved domain (no mail is ever sent). Firestore layout — all private to the owner:
 *   users/{uid}                 profile: username, displayName, decks (≤10), stats
 *   users/{uid}/games/{gameId}  finished game records
 *   users/{uid}/session/active  the in-progress game (JSON string)
 */
const USERNAME_EMAIL_DOMAIN = 'werewolf-gm.example.com';
const toEmail = (username: string) => `${username}@${USERNAME_EMAIL_DOMAIN}`;
const toUsername = (email: string | null) => (email ?? '').split('@')[0];

const HISTORY_PAGE = 50;

/** Firestore rejects `undefined`; a JSON round-trip strips it. */
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function mapError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  const code = err instanceof FirebaseError ? err.code : '';
  const map: Record<string, AuthErrorCode> = {
    'auth/email-already-in-use': 'taken',
    'auth/invalid-credential': 'badCredentials',
    'auth/wrong-password': 'badCredentials',
    'auth/user-not-found': 'badCredentials',
    'auth/invalid-email': 'invalidUsername',
    'auth/weak-password': 'weakPassword',
    'auth/too-many-requests': 'tooMany',
    'auth/network-request-failed': 'network',
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

  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      throw mapError(err);
    }
  };

  return {
    mode: 'firebase',

    onAuthChange(callback) {
      return onAuthStateChanged(auth, (user) =>
        callback(user ? { uid: user.uid, username: toUsername(user.email) } : null),
      );
    },

    signUp: (rawUsername, password, displayName) =>
      wrap(async () => {
        const username = normalizeUsername(rawUsername);
        assertCredentials(username, password);
        const cred = await createUserWithEmailAndPassword(auth, toEmail(username), password);
        const profile = newProfile({ uid: cred.user.uid, username }, displayName);
        await updateProfile(cred.user, { displayName: profile.displayName });
        await setDoc(userDoc(cred.user.uid), { ...clean(profile), updatedAt: serverTimestamp() });
      }),

    signIn: (rawUsername, password) =>
      wrap(async () => {
        await signInWithEmailAndPassword(auth, toEmail(normalizeUsername(rawUsername)), password);
      }),

    signOut: () => wrap(() => signOut(auth)),

    changePassword: (current, next) =>
      wrap(async () => {
        const user = auth.currentUser;
        if (!user?.email) throw new AuthError('generic', 'Not signed in');
        assertCredentials(toUsername(user.email), next);
        // Firebase requires a recent sign-in before a password change.
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
        await updatePassword(user, next);
      }),

    loadProfile: (user) =>
      wrap(async () => {
        const snap = await getDoc(userDoc(user.uid));
        if (snap.exists()) {
          const data = snap.data() as Partial<UserProfile>;
          return {
            ...newProfile(user),
            ...data,
            uid: user.uid,
            decks: data.decks ?? [],
            stats: { ...EMPTY_STATS, ...data.stats },
          } as UserProfile;
        }
        // Account exists but its profile doc doesn't (e.g. sign-up interrupted) — heal it.
        const fresh = newProfile(user, auth.currentUser?.displayName ?? undefined);
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
