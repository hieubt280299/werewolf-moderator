import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { GameState } from '../@types/game';

/**
 * Optional Firebase sync. The app is fully playable offline; when the VITE_FIREBASE_*
 * env vars are present the moderator can back the game up to Firestore under an
 * anonymous account (games/{uid}) and restore it later in the same browser profile.
 *
 * Suggested Firestore rule:
 *   match /games/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; }
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function ensureApp(): { auth: Auth; db: Firestore } {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured');
  app ??= initializeApp(config);
  auth ??= getAuth(app);
  db ??= getFirestore(app);
  return { auth, db };
}

async function ensureUser(): Promise<string> {
  const { auth } = ensureApp();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export async function saveGameToCloud(state: GameState): Promise<void> {
  const uid = await ensureUser();
  const { db } = ensureApp();
  // Stored as a JSON string: Firestore rejects `undefined` fields and nested arrays are awkward.
  await setDoc(doc(db, 'games', uid), { state: JSON.stringify(state), savedAt: serverTimestamp() });
}

export async function loadGameFromCloud(): Promise<GameState | null> {
  const uid = await ensureUser();
  const { db } = ensureApp();
  const snap = await getDoc(doc(db, 'games', uid));
  if (!snap.exists()) return null;
  const raw = snap.data().state;
  return typeof raw === 'string' ? (JSON.parse(raw) as GameState) : null;
}
