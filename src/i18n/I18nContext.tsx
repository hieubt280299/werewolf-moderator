import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Language } from '../@types/game';
import { readJSON, STORAGE_KEYS, writeJSON } from '../utils/storage';
import { dictionaries, type TranslationKey } from './translations';

type Params = Record<string, string | number>;

interface I18nValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Typed lookup — keys are checked at compile time. */
  t: (key: TranslationKey, params?: Params) => string;
  /** Lookup for keys built at runtime (e.g. stored log entries). Falls back to the key. */
  tx: (key: string, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const interpolate = (text: string, params?: Params) =>
  params ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`)) : text;

function detectLanguage(): Language {
  const stored = readJSON<Language | null>(STORAGE_KEYS.language, null);
  if (stored === 'en' || stored === 'vi') return stored;
  return 'vi'; // Vietnamese is the default language; English is a hot-swap in settings.
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    writeJSON(STORAGE_KEYS.language, language);
  }, [language]);

  const tx = useCallback(
    (key: string, params?: Params) => {
      const dict = dictionaries[language] as Record<string, string>;
      const text = dict[key] ?? (dictionaries.en as Record<string, string>)[key] ?? key;
      return interpolate(text, params);
    },
    [language],
  );

  const value = useMemo<I18nValue>(() => ({ language, setLanguage, t: tx, tx }), [language, tx]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
