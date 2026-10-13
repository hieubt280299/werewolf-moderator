import clsx from 'clsx';
import { CloudDownload, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Language } from '../../@types/game';
import { useGame } from '../../context/GameContext';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../i18n/I18nContext';
import { cloudAvailable, pullFromCloud } from '../../services/cloud';
import { Button, Sheet } from './ui';

const LANGS: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
];

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, language, setLanguage } = useI18n();
  const settings = useSettings();
  const { state, dispatch, syncError } = useGame();
  const [message, setMessage] = useState<string | null>(null);

  const restore = async () => {
    try {
      const cloud = await pullFromCloud();
      if (cloud) {
        dispatch({ type: 'HYDRATE', state: cloud });
        setMessage(t('settings.restored'));
      } else {
        setMessage(t('settings.noCloud'));
      }
    } catch (err) {
      setMessage(t('settings.cloudError', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('settings.title')} closeLabel={t('settings.close')}>
      <div className="space-y-6 pb-6">
        <Row label={t('settings.language')}>
          <div className="grid grid-cols-2 gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={language === l.id}
                onClick={() => setLanguage(l.id)}
                className={clsx(
                  'min-h-11 rounded-xl border font-semibold',
                  language === l.id ? 'border-village bg-village/10 text-bone shadow-inner-village' : 'border-panel-edge bg-panel-2 text-bone-dim',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </Row>

        <Toggle label={t('settings.sfx')} hint={t('settings.sfxHint')} checked={settings.sfx} onChange={(v) => settings.update({ sfx: v })} />

        <div className="space-y-3">
          <Toggle
            label={t('settings.cloud')}
            hint={cloudAvailable ? t('settings.cloudHint') : t('settings.cloudUnavailable')}
            checked={settings.cloudSync && cloudAvailable}
            disabled={!cloudAvailable}
            onChange={(v) => settings.update({ cloudSync: v })}
          />
          {cloudAvailable && (
            <Button size="sm" onClick={restore} icon={<CloudDownload className="h-4 w-4" />}>
              {t('settings.restore')}
            </Button>
          )}
          {syncError && settings.cloudSync && <p className="text-xs text-wolf-bright">{t('settings.cloudError', { error: syncError })}</p>}
          {message && <p className="text-xs text-bone-dim">{message}</p>}
        </div>

        {state.phase !== 'setup' && (
          <Button
            variant="wolf"
            block
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              if (window.confirm(t('settings.abandonConfirm'))) {
                dispatch({ type: 'NEW_GAME' });
                onClose();
              }
            }}
          >
            {t('settings.abandon')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-display text-sm uppercase tracking-grimoire text-bone-dim">{label}</p>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={clsx('flex cursor-pointer items-start justify-between gap-4', disabled && 'cursor-not-allowed opacity-60')}>
      <span>
        <span className="block font-display text-sm uppercase tracking-grimoire text-bone">{label}</span>
        {hint && <span className="block text-xs text-bone-dim">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={clsx(
          'relative mt-1 h-7 w-12 shrink-0 rounded-full border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-village',
          checked ? 'border-village bg-village/30 shadow-inner-village' : 'border-panel-edge bg-panel-2',
        )}
      >
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-bone transition-all', checked ? 'left-6' : 'left-0.5')} />
      </span>
    </label>
  );
}
