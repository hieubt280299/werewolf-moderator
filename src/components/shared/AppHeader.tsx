import { House, MoonStar, Undo2, UserRound } from 'lucide-react';
import type { View } from '../../App';
import { useAuth } from '../../context/AuthContext';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';

const TITLES: Record<Exclude<View, 'home'>, 'hub.newGame' | 'hub.pools' | 'hub.history'> = {
  game: 'hub.newGame',
  pools: 'hub.pools',
  history: 'hub.history',
};

interface AppHeaderProps {
  view: View;
  /** Returns to the hub. (The browser's Back still returns to the previous screen.) */
  onHome: () => void;
  /** Opens the settings modal over the current screen. */
  onOpenSettings: () => void;
}

export function AppHeader({ view, onHome, onOpenSettings }: AppHeaderProps) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { state, canUndo, undo } = useGameEngine();
  const inGame = view === 'game' && state.phase !== 'setup';
  const subtitle = view === 'home' ? t('app.tagline') : view === 'game' && state.phase !== 'setup' ? t(`phase.${state.phase}`) : t(TITLES[view as Exclude<View, 'home'>]);

  return (
    <header className="sticky top-0 z-30 border-b border-panel-edge/70 bg-ink/95">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 sm:px-4">
        {view === 'home' ? (
          <span className="flex h-10 w-10 items-center justify-center">
            <MoonStar className="h-5 w-5 text-wolf" />
          </span>
        ) : (
          <button
            type="button"
            onClick={onHome}
            aria-label={t('hub.home')}
            title={t('hub.home')}
            className="press flex items-center gap-1.5 rounded-full p-2.5 text-bone-dim hover:text-bone"
          >
            <House className="h-5 w-5" />
            <span className="hidden text-xs sm:inline">{t('hub.home')}</span>
          </button>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-display text-base font-bold tracking-wide text-bone">{t('app.title')}</p>
          <p className="truncate text-[11px] text-bone-faint">{subtitle}</p>
        </div>
        {inGame && (
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="press flex items-center gap-1.5 rounded-full border border-panel-edge px-3 py-1.5 text-xs text-bone-dim hover:text-bone disabled:opacity-30"
          >
            <Undo2 className="h-4 w-4" />
            {t('settings.undo')}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t('hub.profile')}
          className="press flex items-center gap-2 rounded-full border border-panel-edge bg-panel-2 py-1 pl-1 pr-3 text-xs text-bone-dim hover:text-bone"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-village/20 text-village">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="hidden max-w-[8rem] truncate sm:inline">{profile?.displayName}</span>
        </button>
      </div>
    </header>
  );
}
