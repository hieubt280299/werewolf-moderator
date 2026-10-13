import { MotionConfig } from 'framer-motion';
import { ModeratorDashboard } from './components/dashboard/ModeratorDashboard';
import { SetupScreen } from './components/setup/SetupScreen';
import { AppHeader } from './components/shared/AppHeader';
import { GameProvider, useGame } from './context/GameContext';
import { SettingsProvider } from './context/SettingsContext';
import { I18nProvider } from './i18n/I18nContext';

function Screens() {
  const { state } = useGame();
  return (
    <>
      <AppHeader />
      <main>{state.phase === 'setup' ? <SetupScreen /> : <ModeratorDashboard />}</main>
    </>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <SettingsProvider>
          <GameProvider>
            <Screens />
          </GameProvider>
        </SettingsProvider>
      </I18nProvider>
    </MotionConfig>
  );
}
