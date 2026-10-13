import { MoonStar } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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

function Shell() {
  const { state } = useGame();
  const [view, setView] = useState<View>('home');
  const navigate = useCallback((next: View) => {
    setView(next);
    window.scrollTo({ top: 0 });
  }, []);

  // Braced body: in recent Chromium, scrollTo() returns a Promise, which must not leak out as an effect cleanup.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <>
      <AppHeader view={view} onNavigate={navigate} />
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
