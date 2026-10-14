import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setSfxEnabled } from '../services/sfx';
import { readJSON, STORAGE_KEYS, writeJSON } from '../utils/storage';

export interface Settings {
  sfx: boolean;
}

interface SettingsValue extends Settings {
  update: (patch: Partial<Settings>) => void;
}

const DEFAULTS: Settings = { sfx: true };
const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULTS,
    ...readJSON<Partial<Settings>>(STORAGE_KEYS.settings, {}),
  }));

  useEffect(() => {
    writeJSON(STORAGE_KEYS.settings, settings);
    setSfxEnabled(settings.sfx);
  }, [settings]);

  const value = useMemo<SettingsValue>(
    () => ({ ...settings, update: (patch) => setSettings((s) => ({ ...s, ...patch })) }),
    [settings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
