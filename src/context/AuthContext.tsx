import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  RESET_RESEND_SECONDS,
  type AuthActionLink,
  type GoogleOutcome,
  type RecoveryEmailChange,
  type RecoveryStage,
  type ResetDelivery,
  type SessionUser,
} from '../@types/auth';
import { MAX_POOLS, NO_REBALANCES, type GameRecord, type RebalanceRules, type RolePool, type UserProfile } from '../@types/game';
import { AuthError, getProfileStore, type CloudAccounts, type ProfileStore } from '../services/profileStore';

type Status = 'loading' | 'signedOut' | 'signedIn';

/**
 * An account outcome to show until dismissed:
 * - `connected` / `error`: a Google redirect that finished as the app loaded;
 * - `notLinked`: signed in by password to link Google, but the link was refused (e.g. a
 *   recovery-email change is pending). Shown once the app is up, never on the sign-in screen.
 */
export type AccountNotice = { kind: 'connected' } | { kind: 'error'; error: unknown } | { kind: 'notLinked'; error: unknown };

interface AuthValue {
  status: Status;
  mode: ProfileStore['mode'] | null;
  user: SessionUser | null;
  profile: UserProfile | null;
  store: ProfileStore | null;
  // v1.2.0 — Google (Firebase only) -----------------------------------------
  /** Google sign-in is offered (Firebase mode). */
  googleEnabled: boolean;
  /** A Google redirect is being picked up as the app loads. */
  googleResuming: boolean;
  signInWithGoogle: () => Promise<GoogleOutcome>;
  /** Google found a username account with the same email: its password links the two. */
  pendingGoogle: { email: string } | null;
  linkPendingGoogle: (password: string) => Promise<void>;
  cancelPendingGoogle: () => void;
  /** Refused while a recovery-email change waits for confirmation (cancelEmailChange). */
  connectGoogle: () => Promise<GoogleOutcome>;
  disconnectGoogle: () => Promise<void>;
  cancelEmailChange: () => Promise<void>;
  /** Username + password for an account made with Google (or just a password, if it has a username). */
  addPasswordSignIn: (password: string, username?: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  accountNotice: AccountNotice | null;
  dismissAccountNotice: () => void;
  signIn: (username: string, password: string) => Promise<void>;
  /** The recovery email is required: it's where password resets are sent. */
  signUp: (username: string, password: string, displayName: string, recoveryEmail: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  /** Needs the current password. With Firebase the new address is pending until confirmed. */
  changeRecoveryEmail: (currentPassword: string, email: string) => Promise<RecoveryEmailChange>;
  /** Forgot password: send a 6-digit code (device accounts) or a reset link (Firebase). */
  requestPasswordReset: (username: string) => Promise<ResetDelivery>;
  /** Returns a single-use ticket for `completePasswordReset`. */
  verifyResetCode: (username: string, code: string) => Promise<string>;
  /** The email an emailed reset link belongs to (rejects expired / used links). */
  checkResetLink: (oobCode: string) => Promise<string>;
  completePasswordReset: (ticket: string, newPassword: string) => Promise<void>;
  applyEmailAction: (oobCode: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  /** House rules for games dealt from now on (a game in progress keeps its own). */
  updateRebalances: (rules: RebalanceRules) => Promise<void>;
  /** Insert or update; rejects a new pool beyond MAX_POOLS. */
  savePool: (pool: RolePool) => Promise<void>;
  deletePool: (id: string) => Promise<void>;
  recordGame: (record: GameRecord) => Promise<void>;
  listGames: () => Promise<GameRecord[]>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ProfileStore | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = profile;
  const [pendingGoogle, setPendingGoogle] = useState<{ email: string } | null>(null);
  const [googleResuming, setGoogleResuming] = useState(false);
  const [accountNotice, setAccountNotice] = useState<AccountNotice | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getProfileStore().then((s) => {
      if (cancelled) return;
      setStore(s);
      unsubscribe = s.onAuthChange(async (next) => {
        if (!next) {
          setUser(null);
          setProfile(null);
          setStatus('signedOut');
          return;
        }
        try {
          const loaded = await s.loadProfile(next);
          // Firebase accounts sign in by email, so the username comes from the profile. Sign-in
          // methods are read again: Google may have been linked while the profile loaded.
          setUser({ ...next, ...s.cloud?.account(), username: loaded.username || next.username });
          setProfile(loaded);
          setStatus('signedIn');
        } catch {
          setStatus('signedOut');
        }
      });
      // Back from Google after a redirect sign-in (or connecting Google in Settings).
      if (s.cloud) {
        setGoogleResuming(true);
        s.cloud
          .resumeGoogleRedirect()
          .then((outcome) => {
            if (outcome?.status === 'needsPassword') setPendingGoogle({ email: outcome.email });
            if (outcome?.status === 'done' && outcome.mode === 'link') setAccountNotice({ kind: 'connected' });
          })
          .catch((error: unknown) => setAccountNotice({ kind: 'error', error }))
          .finally(() => setGoogleResuming(false));
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const requireStore = useCallback(() => {
    if (!store) throw new Error('Auth is still loading');
    return store;
  }, [store]);

  const requireCloud = useCallback((): CloudAccounts => {
    const cloud = requireStore().cloud;
    if (!cloud) throw new AuthError('googleUnavailable');
    return cloud;
  }, [requireStore]);

  /** Re-reads the account's sign-in methods after linking, unlinking or verifying. */
  const refreshAccount = useCallback(() => {
    const account = store?.cloud?.account();
    if (account) setUser((u) => (u ? { ...u, ...account } : u));
  }, [store]);

  const patchProfile = useCallback(
    async (patch: Partial<Pick<UserProfile, 'displayName' | 'pools' | 'rebalances'>>) => {
      const current = profileRef.current;
      if (!current) return;
      setProfile({ ...current, ...patch }); // optimistic
      try {
        await requireStore().saveProfile(current.uid, patch);
      } catch (err) {
        setProfile(current);
        throw err;
      }
    },
    [requireStore],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status,
      mode: store?.mode ?? null,
      user,
      profile,
      store,
      googleEnabled: !!store?.cloud,
      googleResuming,
      signInWithGoogle: async () => {
        const outcome = await requireCloud().signInWithGoogle();
        setPendingGoogle(outcome.status === 'needsPassword' ? { email: outcome.email } : null);
        return outcome;
      },
      pendingGoogle,
      linkPendingGoogle: async (password) => {
        try {
          await requireCloud().linkPendingGoogle(password);
        } catch (err) {
          if (!(err instanceof AuthError && err.code === 'emailChangePending')) throw err;
          // Signed in, but Google stays unlinked: the app opens and says why.
          setAccountNotice({ kind: 'notLinked', error: err });
        }
        setPendingGoogle(null);
        refreshAccount();
      },
      cancelPendingGoogle: () => {
        store?.cloud?.cancelPendingGoogle();
        setPendingGoogle(null);
      },
      connectGoogle: async () => {
        const outcome = await requireCloud().connectGoogle();
        refreshAccount();
        return outcome;
      },
      disconnectGoogle: async () => {
        // Without a username, the password alone can't be used to sign in.
        if (!profileRef.current?.username) throw new AuthError('lastSignInMethod');
        await requireCloud().disconnectGoogle();
        refreshAccount();
      },
      cancelEmailChange: async () => {
        await requireCloud().cancelEmailChange();
        setProfile((p) => (p ? { ...p, pendingRecoveryEmail: null } : p));
      },
      addPasswordSignIn: async (password, username) => {
        const claimed = await requireCloud().addPasswordSignIn(password, username);
        setProfile((p) => (p ? { ...p, username: claimed } : p));
        setUser((u) => (u ? { ...u, username: claimed } : u));
        refreshAccount();
      },
      sendVerificationEmail: () => requireCloud().sendVerificationEmail(),
      accountNotice,
      dismissAccountNotice: () => setAccountNotice(null),
      signIn: (u, p) => requireStore().signIn(u, p),
      signUp: (u, p, name, email) => requireStore().signUp(u, p, name, email),
      signOut: () => requireStore().signOut(),
      changePassword: (c, n) => requireStore().changePassword(c, n),
      changeRecoveryEmail: async (current, email) => {
        const change = await requireStore().changeRecoveryEmail(current, email);
        setProfile((p) =>
          p ? (change.pending ? { ...p, pendingRecoveryEmail: change.email } : { ...p, recoveryEmail: change.email, pendingRecoveryEmail: null }) : p,
        );
        return change;
      },
      requestPasswordReset: (u) => requireStore().requestPasswordReset(u),
      verifyResetCode: (u, code) => requireStore().verifyResetCode(u, code),
      checkResetLink: (code) => requireStore().checkResetLink(code),
      completePasswordReset: (ticket, next) => requireStore().completePasswordReset(ticket, next),
      applyEmailAction: async (code) => {
        await requireStore().applyEmailAction(code);
        refreshAccount();
      },
      updateDisplayName: (name) => patchProfile({ displayName: name.trim() }),
      updateRebalances: (rules) => patchProfile({ rebalances: { ...NO_REBALANCES, ...rules } }),
      savePool: async (pool) => {
        const pools = profileRef.current?.pools ?? [];
        const exists = pools.some((p) => p.id === pool.id);
        if (!exists && pools.length >= MAX_POOLS) throw new Error(`Pool limit (${MAX_POOLS}) reached`);
        await patchProfile({ pools: exists ? pools.map((p) => (p.id === pool.id ? pool : p)) : [...pools, pool] });
      },
      deletePool: (id) => patchProfile({ pools: (profileRef.current?.pools ?? []).filter((p) => p.id !== id) }),
      recordGame: async (record) => {
        const current = profileRef.current;
        if (!current) return;
        const stats = await requireStore().recordGame(current.uid, record);
        setProfile((p) => (p ? { ...p, stats } : p));
      },
      listGames: async () => (profileRef.current ? requireStore().listGames(profileRef.current.uid) : []),
    }),
    [status, store, user, profile, requireStore, patchProfile, requireCloud, refreshAccount, pendingGoogle, googleResuming, accountNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------

/**
 * The Forgot Password flow as a small state machine:
 *   request → (code | linkSent) → newPassword → done
 *
 * Sending starts a RESET_RESEND_SECONDS cooldown before the code (or link) can be re-sent.
 * Device accounts verify a 6-digit code; Firebase accounts follow the emailed link, which
 * reopens the app with `oobCode` and starts this flow at `newPassword`.
 */
export function usePasswordRecovery(oobCode?: string | null) {
  const auth = useAuth();
  const [stage, setStage] = useState<RecoveryStage>(oobCode ? 'newPassword' : 'request');
  const [username, setUsername] = useState('');
  const [delivery, setDelivery] = useState<ResetDelivery | null>(null);
  const [ticket, setTicket] = useState<string | null>(oobCode ?? null);
  /** Whose password an emailed link resets, once the link checks out. */
  const [linkEmail, setLinkEmail] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);
  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // An emailed link is checked before its form is shown.
  const { checkResetLink } = auth;
  useEffect(() => {
    if (!oobCode) return;
    let live = true;
    checkResetLink(oobCode)
      .then((email) => live && setLinkEmail(email))
      .catch((err: unknown) => {
        if (!live) return;
        setError(err);
        setTicket(null);
        setStage('request');
      });
    return () => {
      live = false;
    };
  }, [oobCode, checkResetLink]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const send = (name: string) =>
    run(async () => {
      const sent = await auth.requestPasswordReset(name);
      const at = Date.now();
      setUsername(name);
      setDelivery(sent);
      setCooldownUntil(at + RESET_RESEND_SECONDS * 1000);
      setNow(at);
      setStage(sent.method === 'code' ? 'code' : 'linkSent');
    });

  return {
    stage,
    username,
    delivery,
    linkEmail,
    secondsLeft,
    busy,
    error,
    send,
    /** Disabled (a no-op) until the cooldown runs out. */
    resend: () => (secondsLeft > 0 || !username ? Promise.resolve() : send(username)),
    verify: (code: string) =>
      run(async () => {
        setTicket(await auth.verifyResetCode(username, code));
        setStage('newPassword');
      }),
    submitNewPassword: (password: string, confirm: string) =>
      run(async () => {
        if (password !== confirm) throw new AuthError('mismatch');
        if (!ticket) throw new AuthError('codeExpired');
        await auth.completePasswordReset(ticket, password);
        setTicket(null);
        setStage('done');
      }),
    /** Back to the username step (e.g. to try another username). */
    restart: () => {
      setStage('request');
      setDelivery(null);
      setTicket(null);
      setError(null);
      setCooldownUntil(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Emailed account links
// ---------------------------------------------------------------------------

const ACTION_MODES: readonly AuthActionLink['mode'][] = ['resetPassword', 'verifyAndChangeEmail', 'verifyEmail', 'recoverEmail'];

/** A Firebase account link the app was opened with (`?mode=…&oobCode=…`), if any. */
export function readAuthActionLink(): AuthActionLink | null {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') as AuthActionLink['mode'] | null;
  const oobCode = params.get('oobCode');
  return mode && oobCode && ACTION_MODES.includes(mode) ? { mode, oobCode } : null;
}

/** Drops the link's one-time code from the address bar once it has been handled. */
export function clearAuthActionLink() {
  window.history.replaceState(window.history.state, '', window.location.pathname);
}
