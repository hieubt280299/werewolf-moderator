import { MoonStar, Settings, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { SettingsSheet } from './SettingsSheet';

export function AppHeader() {
  const { t } = useI18n();
  const { state, canUndo, undo } = useGameEngine();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-panel-edge/70 bg-ink/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <MoonStar className="h-5 w-5 text-wolf" />
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="truncate text-base text-bone">{t('app.title')}</h1>
            <p className="truncate text-[11px] text-bone-faint">
              {state.phase === 'setup' ? t('setup.title') : t('app.tagline')}
            </p>
          </div>
          {state.phase !== 'setup' && (
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              aria-label={t('settings.undo')}
              title={t('settings.undo')}
              className="rounded-full p-2.5 text-bone-dim hover:text-bone disabled:opacity-30"
            >
              <Undo2 className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t('settings.title')}
            className="rounded-full p-2.5 text-bone-dim hover:text-bone"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
