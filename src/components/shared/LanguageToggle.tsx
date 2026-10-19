import clsx from 'clsx';
import type { Language } from '../../@types/game';
import { useI18n } from '../../i18n/I18nContext';

const LANGS: { id: Language; label: string; full: string }[] = [
  { id: 'vi', label: 'VI', full: 'Tiếng Việt' },
  { id: 'en', label: 'EN', full: 'English' },
];

/** VI / EN hot-swap. `wide` shows full names (settings), compact shows codes (headers). */
export function LanguageToggle({ wide }: { wide?: boolean }) {
  const { language, setLanguage } = useI18n();
  return (
    <div className={clsx('grid grid-cols-2 gap-1 rounded-xl border border-panel-edge bg-panel-2 p-1', !wide && 'w-28')}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          aria-pressed={language === l.id}
          onClick={() => setLanguage(l.id)}
          className={clsx(
            'press rounded-lg font-semibold',
            wide ? 'min-h-11 text-sm' : 'min-h-8 font-display text-xs tracking-grimoire',
            language === l.id ? 'bg-village/20 text-bone shadow-inner-village' : 'text-bone-dim',
          )}
        >
          {wide ? l.full : l.label}
        </button>
      ))}
    </div>
  );
}
