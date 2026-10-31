import { MoonStar } from 'lucide-react';
import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AccountPrompts } from './components/auth/AccountPrompts';
import { AuthScreen } from './components/auth/AuthScreen';
import { EmailActionScreen } from './components/auth/EmailActionScreen';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { ProfileSettingsSheet } from './components/dashboard/ProfileSettings';
import { AppHeader } from './components/shared/AppHeader';
import { AuthProvider, clearAuthActionLink, readAuthActionLink, useAuth } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import { HouseRulesProvider } from './context/HouseRulesContext';
import { SettingsProvider } from './context/SettingsContext';
import { I18nProvider, useI18n } from './i18n/I18nContext';

export type View = 'home' | 'game' | 'pools' | 'history';

// Screens past the hub load on demand (the deal board's drag-and-drop library included),
// keeping the first load small. They are prefetched in idle time after the hub is up.
const loaders = {
  setup: () => import('./components/game/SetupScreen'),
  board: () => import('./components/game/ModeratorDashboard'),
  pools: () => import('./components/dashboard/PoolBuilder'),
  history: () => import('./components/dashboard/HistoryStats'),
};
const SetupScreen = lazy(() => loaders.setup().then((m) => ({ default: m.SetupScreen })));
const ModeratorDashboard = lazy(() => loaders.board().then((m) => ({ default: m.ModeratorDashboard })));
const PoolBuilder = lazy(() => loaders.pools().then((m) => ({ default: m.PoolBuilder })));
const HistoryStats = lazy(() => loaders.history().then((m) => ({ default: m.HistoryStats })));

function usePrefetchScreens() {
  useEffect(() => {
    const prefetch = () => Object.values(loaders).forEach((load) => void load().catch(() => undefined));
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(prefetch, 1500);
    return () => window.clearTimeout(id);
  }, []);
}

interface NavState {
  view: View;
  /** Depth in this app's own history, so Back never leaves the app. */
  depth: number;
}

/**
 * Screen navigation backed by the History API: the browser Back button and the Android back
 * gesture return to the previous screen, and the header's Home button unwinds to the hub.
 */
function useViewHistory() {
  const [nav, setNav] = useState<NavState>({ view: 'home', depth: 0 });
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    window.history.replaceState({ view: 'home', depth: 0 } satisfies NavState, '');
    window.scrollTo({ top: 0 });
    const onPop = (e: PopStateEvent) => {
      const state = e.state as NavState | null;
      // A transition keeps the current screen up while a not-yet-loaded one downloads.
      startTransition(() => setNav(state?.view ? state : { view: 'home', depth: 0 }));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((view: View) => {
    const current = navRef.current;
    if (current.view === view) return;
    // pushState stays outside any state updater (StrictMode would run it twice).
    const next: NavState = { view, depth: current.depth + 1 };
    window.history.pushState(next, '');
    navRef.current = next;
    startTransition(() => setNav(next));
    window.scrollTo({ top: 0 });
  }, []);

  // Steps back through this app's own entries rather than pushing a new one, so Back from the
  // hub doesn't return to the screen just left.
  const home = useCallback(() => {
    if (nav.depth > 0) window.history.go(-nav.depth);
    else navigate('home');
  }, [nav.depth, navigate]);

  return { view: nav.view, navigate, home };
}

function Shell() {
  const { state } = useGame();
  const { profile } = useAuth();
  const { view, navigate, home } = useViewHistory();
  // Settings is a modal on top of the current screen, not a screen of its own.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  usePrefetchScreens();

  return (
    // Cards describe roles as the dealt game plays them; before dealing, as the next game will.
    <HouseRulesProvider rules={state.phase === 'setup' ? profile?.rebalances : state.rules}>
      <AppHeader view={view} onHome={home} onOpenSettings={openSettings} />
      <main>
        <Suspense fallback={<div className="min-h-[calc(100svh-3.5rem)]" />}>
          {view === 'home' && <DashboardHome onNavigate={navigate} onOpenSettings={openSettings} />}
          {view === 'game' && (state.phase === 'setup' ? <SetupScreen /> : <ModeratorDashboard />)}
          {view === 'pools' && <PoolBuilder />}
          {view === 'history' && <HistoryStats onNavigate={navigate} />}
        </Suspense>
      </main>
      <ProfileSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AccountPrompts />
    </HouseRulesProvider>
  );
}

function Gate() {
  const { t } = useI18n();
  const { status, user } = useAuth();
  // An emailed account link (password reset, recovery-email confirmation) opened the app.
  const [link, setLink] = useState(readAuthActionLink);
  const linkDone = useCallback(() => {
    clearAuthActionLink();
    setLink(null);
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-bone-dim">
        <MoonStar className="h-8 w-8 animate-pulse text-wolf" />
        <p className="text-sm">{t('auth.loading')}</p>
      </div>
    );
  }
  if (link?.mode === 'resetPassword') return <AuthScreen resetLink={link.oobCode} onResetDone={linkDone} />;
  if (link) return <EmailActionScreen mode={link.mode} oobCode={link.oobCode} onDone={linkDone} />;
  if (status === 'signedOut' || !user) return <AuthScreen />;
  // Keyed by uid so switching accounts gets a fresh, per-user game state.
  return (
    <GameProvider key={user.uid} uid={user.uid}>
      <Shell />
    </GameProvider>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <SettingsProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}
