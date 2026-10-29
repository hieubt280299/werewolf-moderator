import { FirebaseError } from 'firebase/app';
import {
  EmailAuthProvider,
  getAdditionalUserInfo,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  linkWithRedirect,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  unlink,
  type Auth,
  type OAuthCredential,
  type User,
  type UserCredential,
} from 'firebase/auth';
import type { GoogleOutcome, SignInProvider } from '../@types/auth';
import { assertPassword, AuthError, type AccountInfo, type AuthErrorCode } from './profileStore';

/**
 * Google sign-in and account linking (v1.2.0), on Firebase's recommended setup:
 *
 * - **One account per email.** The Firebase project keeps its default "Link accounts that use
 *   the same email", so a Google sign-in with a username account's email opens that same
 *   account (same uid, so the same profile, decks, history and stats):
 *   - Google is trusted for @gmail.com and Google Workspace addresses, and Firebase merges on
 *     its own. If the account's email was never verified, Google replaces its password, which
 *     the app then offers to set again (AccountPrompts).
 *   - For any other address Firebase answers `auth/account-exists-with-different-credential`.
 *     The Google credential is kept and the account's password is asked for once, to link it.
 *   `fetchSignInMethodsForEmail` isn't used: it is deprecated and returns nothing while Email
 *   Enumeration Protection is on (the default for new projects).
 * - **Popup first.** Redirects are used only where popups don't work: a blocked popup, or the
 *   installed home-screen app when the auth helper is served from the app's own domain
 *   (the `/__/auth` proxy in vercel.json). Otherwise browsers that block third-party storage
 *   lose the redirect result.
 * - **No wasted work on load.** The redirect result is only read when this app started one.
 */

export const GOOGLE_PROVIDER_ID = GoogleAuthProvider.PROVIDER_ID;

const codeOf = (err: unknown) => (err instanceof FirebaseError ? err.code : '');

const ERROR_CODES: Record<string, AuthErrorCode> = {
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
  // v1.2.0 — Google
  'auth/credential-already-in-use': 'googleInUse',
  'auth/operation-not-allowed': 'googleUnavailable',
  'auth/unauthorized-domain': 'unauthorizedDomain',
  'auth/user-mismatch': 'wrongGoogleAccount',
  'auth/provider-already-linked': 'alreadyLinked',
  'auth/requires-recent-login': 'recentLogin',
};

/** Firebase errors as the app's localized error codes. */
export function mapAuthError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  return new AuthError(ERROR_CODES[codeOf(err)] ?? 'generic', err instanceof Error ? err.message : String(err));
}

export const CREDENTIAL_ERRORS = new Set(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials']);
/** The moderator closed the Google window, or opened a second one: not an error. */
const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);
/** No popup here: go by redirect instead. */
const NO_POPUP = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment']);

/** Set just before leaving for Google, so only a return from there reads the redirect result. */
const REDIRECT_FLAG = 'wwgm:google-redirect:v1';

const markRedirect = () => {
  try {
    sessionStorage.setItem(REDIRECT_FLAG, '1');
  } catch {
    /* without the flag the result is simply not read back */
  }
};

/** True once per return from a redirect this app started. */
function takeRedirectFlag(): boolean {
  try {
    const started = sessionStorage.getItem(REDIRECT_FLAG) === '1';
    sessionStorage.removeItem(REDIRECT_FLAG);
    return started;
  } catch {
    return false;
  }
}

/** The installed home-screen app, where a popup opens outside it and can't report back. */
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const providersOf = (user: User): SignInProvider[] =>
  user.providerData.flatMap((p): SignInProvider[] => (p.providerId === 'password' ? ['password'] : p.providerId === GOOGLE_PROVIDER_ID ? ['google'] : []));

export const accountOf = (user: User): AccountInfo => ({ providers: providersOf(user), email: user.email, emailVerified: user.emailVerified });

export interface GoogleAuthService {
  signIn(): Promise<GoogleOutcome>;
  resumeRedirect(): Promise<GoogleOutcome | null>;
  linkPending(password: string): Promise<void>;
  cancelPending(): void;
  connect(): Promise<GoogleOutcome>;
  disconnect(): Promise<void>;
  /** Links a password to the signed-in account's email (no-op if it already has one). */
  addPassword(password: string): Promise<void>;
}

/**
 * @param language the app's language, so Google's account chooser matches it.
 * @param track wraps account changes that profile loads should wait for (see firebase.ts).
 */
export function createGoogleAuth(auth: Auth, language: () => string, track: <T>(work: Promise<T>) => Promise<T>): GoogleAuthService {
  /** The Google credential waiting for the existing account's password. */
  let pending: { credential: OAuthCredential; email: string } | null = null;

  const provider = () => {
    const google = new GoogleAuthProvider();
    // Always offer the account chooser, so a shared device can pick the right account.
    google.setCustomParameters({ prompt: 'select_account' });
    auth.languageCode = language();
    return google;
  };

  /** Redirects only survive third-party storage blocking when the helper is same-origin. */
  const preferRedirect = () => isStandalone() && auth.app.options.authDomain === window.location.host;

  const requireUser = (): User => {
    if (!auth.currentUser) throw new AuthError('generic', 'Not signed in');
    return auth.currentUser;
  };

  const redirect = async (go: () => Promise<never>): Promise<GoogleOutcome> => {
    markRedirect();
    await go();
    return { status: 'redirecting' };
  };

  const done = (result: UserCredential): GoogleOutcome => ({
    status: 'done',
    mode: result.operationType === 'link' ? 'link' : 'signIn',
    isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false,
  });

  /**
   * The account-linking credential resolver: a username account already owns the Google
   * email. Keep Google's credential and ask for that account's password.
   */
  const resolve = (err: unknown): GoogleOutcome => {
    if (CANCELLED.has(codeOf(err))) return { status: 'cancelled' };
    if (codeOf(err) === 'auth/account-exists-with-different-credential') {
      const credential = GoogleAuthProvider.credentialFromError(err as FirebaseError);
      const email = (err as FirebaseError).customData?.email;
      if (credential && typeof email === 'string') {
        pending = { credential, email };
        return { status: 'needsPassword', email };
      }
    }
    // Linking a Google account that already has its own profile.
    if (codeOf(err) === 'auth/credential-already-in-use' || codeOf(err) === 'auth/email-already-in-use') throw new AuthError('googleInUse');
    throw mapAuthError(err);
  };

  return {
    async signIn() {
      pending = null;
      const google = provider();
      if (preferRedirect()) return redirect(() => signInWithRedirect(auth, google));
      try {
        return done(await signInWithPopup(auth, google));
      } catch (err) {
        if (NO_POPUP.has(codeOf(err))) return redirect(() => signInWithRedirect(auth, google));
        return resolve(err);
      }
    },

    async resumeRedirect() {
      if (!takeRedirectFlag()) return null;
      try {
        const result = await getRedirectResult(auth);
        return result ? done(result) : null;
      } catch (err) {
        return resolve(err);
      }
    },

    linkPending: (password) =>
      track(
        (async () => {
          if (!pending) throw new AuthError('generic', 'No Google sign-in is waiting to be linked');
          const { credential, email } = pending;
          let user: User;
          try {
            ({ user } = await signInWithEmailAndPassword(auth, email, password));
          } catch (err) {
            throw CREDENTIAL_ERRORS.has(codeOf(err)) ? new AuthError('wrongPassword') : mapAuthError(err);
          }
          try {
            await linkWithCredential(user, credential);
          } catch (err) {
            if (codeOf(err) !== 'auth/provider-already-linked') throw mapAuthError(err);
          }
          pending = null;
        })(),
      ),

    cancelPending() {
      pending = null;
    },

    async connect() {
      const user = requireUser();
      const google = provider();
      if (preferRedirect()) return redirect(() => linkWithRedirect(user, google));
      try {
        return done(await linkWithPopup(user, google));
      } catch (err) {
        if (NO_POPUP.has(codeOf(err))) return redirect(() => linkWithRedirect(user, google));
        if (codeOf(err) === 'auth/provider-already-linked') return { status: 'done', mode: 'link', isNewUser: false };
        return resolve(err);
      }
    },

    async disconnect() {
      const user = requireUser();
      if (!providersOf(user).includes('password')) throw new AuthError('lastSignInMethod');
      try {
        await unlink(user, GOOGLE_PROVIDER_ID);
      } catch (err) {
        // Already gone (e.g. unlinked on another device): nothing left to do.
        if (codeOf(err) !== 'auth/no-such-provider') throw mapAuthError(err);
      }
    },

    async addPassword(password) {
      const user = requireUser();
      if (providersOf(user).includes('password')) return;
      if (!user.email) throw new AuthError('noRecoveryEmail');
      assertPassword(password);
      const credential = EmailAuthProvider.credential(user.email, password);
      try {
        await linkWithCredential(user, credential);
      } catch (err) {
        if (codeOf(err) !== 'auth/requires-recent-login') throw mapAuthError(err);
        // An old session: confirm with Google once, then link.
        try {
          await reauthenticateWithPopup(user, provider());
        } catch (reauthErr) {
          throw CANCELLED.has(codeOf(reauthErr)) ? mapAuthError(err) : mapAuthError(reauthErr);
        }
        await linkWithCredential(user, credential).catch((retryErr: unknown) => {
          throw mapAuthError(retryErr);
        });
      }
    },
  };
}
