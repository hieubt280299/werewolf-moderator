import { FirebaseError } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGoogleAuth, mapAuthError, providersOf } from './authService';
import { AuthError } from './profileStore';

vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    static PROVIDER_ID = 'google.com';
    static credentialFromError = vi.fn();
    setCustomParameters = vi.fn();
  }
  return {
    GoogleAuthProvider,
    EmailAuthProvider: { credential: vi.fn((email: string, password: string) => ({ email, password })) },
    getAdditionalUserInfo: vi.fn(() => ({ isNewUser: true })),
    getRedirectResult: vi.fn(),
    linkWithCredential: vi.fn(),
    linkWithPopup: vi.fn(),
    linkWithRedirect: vi.fn(),
    reauthenticateWithPopup: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signInWithRedirect: vi.fn(),
    unlink: vi.fn(),
  };
});

const fb = vi.mocked(firebaseAuth);
const user = (providers: string[], email = 'mod@example.com') =>
  ({ uid: 'u1', email, emailVerified: false, providerData: providers.map((providerId) => ({ providerId })) }) as unknown as User;

function setup({ standalone = false, authDomain = 'proj.firebaseapp.com', currentUser = null as User | null } = {}) {
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', { location: { host: 'app.example.com' }, matchMedia: () => ({ matches: standalone }) });
  vi.stubGlobal('navigator', {});
  const auth = { currentUser, app: { options: { authDomain } }, languageCode: null } as unknown as Auth;
  return { auth, google: createGoogleAuth(auth, () => 'vi', (work) => work), redirected: () => store.size > 0 };
}

const accountExists = () =>
  new FirebaseError('auth/account-exists-with-different-credential', 'exists', { email: 'mod@example.com' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('Google sign-in', () => {
  it('signs in with a popup and reports a brand-new account', async () => {
    const { auth, google } = setup();
    fb.signInWithPopup.mockResolvedValue({ operationType: 'signIn' } as never);
    await expect(google.signIn()).resolves.toEqual({ status: 'done', mode: 'signIn', isNewUser: true });
    expect(auth.languageCode).toBe('vi');
    expect(fb.signInWithRedirect).not.toHaveBeenCalled();
  });

  it('falls back to a redirect when the popup is blocked, and only then reads the result back', async () => {
    const { google, redirected } = setup();
    fb.signInWithPopup.mockRejectedValue(new FirebaseError('auth/popup-blocked', 'blocked'));
    fb.signInWithRedirect.mockResolvedValue(undefined as never);
    await expect(google.signIn()).resolves.toEqual({ status: 'redirecting' });
    expect(redirected()).toBe(true);
    fb.getRedirectResult.mockResolvedValue({ operationType: 'signIn' } as never);
    await expect(google.resumeRedirect()).resolves.toMatchObject({ status: 'done' });
    // The flag is spent: a normal reload doesn't touch the redirect machinery.
    await expect(google.resumeRedirect()).resolves.toBeNull();
    expect(fb.getRedirectResult).toHaveBeenCalledTimes(1);
  });

  it('goes straight to a redirect in the installed app when the helper is same-origin', async () => {
    const { google } = setup({ standalone: true, authDomain: 'app.example.com' });
    fb.signInWithRedirect.mockResolvedValue(undefined as never);
    await expect(google.signIn()).resolves.toEqual({ status: 'redirecting' });
    expect(fb.signInWithPopup).not.toHaveBeenCalled();
  });

  it('keeps using the popup in the installed app when the helper is cross-origin', async () => {
    const { google } = setup({ standalone: true });
    fb.signInWithPopup.mockResolvedValue({ operationType: 'signIn' } as never);
    await google.signIn();
    expect(fb.signInWithRedirect).not.toHaveBeenCalled();
  });

  it('treats a closed popup as cancelled, not an error', async () => {
    const { google } = setup();
    fb.signInWithPopup.mockRejectedValue(new FirebaseError('auth/popup-closed-by-user', 'closed'));
    await expect(google.signIn()).resolves.toEqual({ status: 'cancelled' });
  });
});

describe('account linking', () => {
  it('asks for the password of the account that owns the email, then links Google to it', async () => {
    const { google } = setup();
    const credential = { providerId: 'google.com' };
    fb.signInWithPopup.mockRejectedValue(accountExists());
    vi.mocked(firebaseAuth.GoogleAuthProvider.credentialFromError).mockReturnValue(credential as never);
    await expect(google.signIn()).resolves.toEqual({ status: 'needsPassword', email: 'mod@example.com' });

    const existing = user(['password']);
    fb.signInWithEmailAndPassword.mockResolvedValue({ user: existing } as never);
    await google.linkPending('secret1');
    expect(fb.signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'mod@example.com', 'secret1');
    expect(fb.linkWithCredential).toHaveBeenCalledWith(existing, credential);
    // Used once.
    await expect(google.linkPending('secret1')).rejects.toBeInstanceOf(AuthError);
  });

  it('reports a wrong password and keeps the Google credential for another try', async () => {
    const { google } = setup();
    fb.signInWithPopup.mockRejectedValue(accountExists());
    vi.mocked(firebaseAuth.GoogleAuthProvider.credentialFromError).mockReturnValue({} as never);
    await google.signIn();
    fb.signInWithEmailAndPassword.mockRejectedValueOnce(new FirebaseError('auth/invalid-credential', 'bad'));
    await expect(google.linkPending('nope')).rejects.toMatchObject({ code: 'wrongPassword' });
    fb.signInWithEmailAndPassword.mockResolvedValue({ user: user(['password']) } as never);
    await expect(google.linkPending('right1')).resolves.toBeUndefined();
  });

  it('picks the link-up prompt out of a redirect that came back with the conflict', async () => {
    const { google } = setup();
    fb.signInWithPopup.mockRejectedValue(new FirebaseError('auth/popup-blocked', 'blocked'));
    fb.signInWithRedirect.mockResolvedValue(undefined as never);
    await google.signIn();
    fb.getRedirectResult.mockRejectedValue(accountExists());
    vi.mocked(firebaseAuth.GoogleAuthProvider.credentialFromError).mockReturnValue({} as never);
    await expect(google.resumeRedirect()).resolves.toEqual({ status: 'needsPassword', email: 'mod@example.com' });
  });

  it('refuses to connect a Google account that already has its own profile', async () => {
    const { google } = setup({ currentUser: user(['password']) });
    fb.linkWithPopup.mockRejectedValue(new FirebaseError('auth/credential-already-in-use', 'in use'));
    await expect(google.connect()).rejects.toMatchObject({ code: 'googleInUse' });
  });

  it('never disconnects the only way to sign in', async () => {
    const onlyGoogle = setup({ currentUser: user(['google.com']) });
    await expect(onlyGoogle.google.disconnect()).rejects.toMatchObject({ code: 'lastSignInMethod' });
    const both = setup({ currentUser: user(['password', 'google.com']) });
    await both.google.disconnect();
    expect(fb.unlink).toHaveBeenCalledWith(expect.anything(), 'google.com');
  });

  it('adds a password to a Google account, confirming with Google if the session is old', async () => {
    const googleUser = user(['google.com'], 'mod@gmail.com');
    const { google } = setup({ currentUser: googleUser });
    fb.linkWithCredential.mockRejectedValueOnce(new FirebaseError('auth/requires-recent-login', 'old')).mockResolvedValueOnce({} as never);
    await google.addPassword('secret1');
    expect(fb.reauthenticateWithPopup).toHaveBeenCalledTimes(1);
    expect(fb.linkWithCredential).toHaveBeenLastCalledWith(googleUser, { email: 'mod@gmail.com', password: 'secret1' });
  });
});

describe('helpers', () => {
  it('maps providers and Firebase errors', () => {
    expect(providersOf(user(['password', 'google.com', 'phone']))).toEqual(['password', 'google']);
    expect(mapAuthError(new FirebaseError('auth/unauthorized-domain', 'x')).code).toBe('unauthorizedDomain');
    expect(mapAuthError(new FirebaseError('auth/something-new', 'x')).code).toBe('generic');
  });
});
