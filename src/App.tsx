import { MoonStar } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthScreen } from './components/auth/AuthScreen';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { DeckBuilder } from './components/dashboard/DeckBuilder';
import { HistoryStats } from './components/dashboard/HistoryStats';
import { ProfileSettings } from './components/dashboard/ProfileSettings';
import { ModeratorDashboard } from './components/game/ModeratorDashboard';
import { SetupScreen } from './components/game/SetupScreen';
import { AppHeader } from './components/shared/AppHeader';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import { SettingsProvider } from './context/SettingsContext';
import { I18nProvider, useI18n } from './i18n/I18nContext';

export type View = 'home' | 'game' | 'decks' | 'history' | 'profile';

interface NavState {
  view: View;
  /** Depth in this app's own history, so Back never leaves the app. */
  depth: number;
}

/**
 * Screen navigation backed by the History API: the header's Back arrow, the browser
 * Back button and the Android back gesture all return to the previous screen.
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
      setNav(state?.view ? state : { view: 'home', depth: 0 });
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
    setNav(next);
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(() => {
    if (nav.depth > 0) window.history.back();
    else navigate('home');
  }, [nav.depth, navigate]);

  return { view: nav.view, navigate, back };
}

function Shell() {
  const { state } = useGame();
  const { view, navigate, back } = useViewHistory();

  return (
    <>
      <AppHeader view={view} onNavigate={navigate} onBack={back} />
      <main>
        {view === 'home' && <DashboardHome onNavigate={navigate} />}
        {view === 'game' && (state.phase === 'setup' ? <SetupScreen /> : <ModeratorDashboard />)}
        {view === 'decks' && <DeckBuilder />}
        {view === 'history' && <HistoryStats />}
        {view === 'profile' && <ProfileSettings />}
      </main>
    </>
  );
}

function Gate() {
  const { t } = useI18n();
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-bone-dim">
        <MoonStar className="h-8 w-8 animate-pulse text-wolf" />
        <p className="text-sm">{t('auth.loading')}</p>
      </div>
    );
  }
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
