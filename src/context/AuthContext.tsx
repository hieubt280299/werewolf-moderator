import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MAX_POOLS, type GameRecord, type RolePool, type SessionUser, type UserProfile } from '../@types/game';
import { getProfileStore, type ProfileStore } from '../services/profileStore';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: Status;
  mode: ProfileStore['mode'] | null;
  user: SessionUser | null;
  profile: UserProfile | null;
  store: ProfileStore | null;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
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
          setUser(next);
          setProfile(loaded);
          setStatus('signedIn');
        } catch {
          setStatus('signedOut');
        }
      });
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

  const patchProfile = useCallback(
    async (patch: Partial<Pick<UserProfile, 'displayName' | 'pools'>>) => {
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
      signIn: (u, p) => requireStore().signIn(u, p),
      signUp: (u, p, name) => requireStore().signUp(u, p, name),
      signOut: () => requireStore().signOut(),
      changePassword: (c, n) => requireStore().changePassword(c, n),
      updateDisplayName: (name) => patchProfile({ displayName: name.trim() }),
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
    [status, store, user, profile, requireStore, patchProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
