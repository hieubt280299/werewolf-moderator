import clsx from 'clsx';
import { Cloud, HardDrive, KeyRound, LogOut, Save, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isActiveGame, useGame } from '../../context/GameContext';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../i18n/I18nContext';
import { AuthError } from '../../services/profileStore';
import { LanguageToggle } from '../shared/LanguageToggle';
import { Button, TextField } from '../shared/ui';

/** Profile (name, password) and app settings (language, sound), plus sign-out. */
export function ProfileSettings() {
  const { t } = useI18n();
  const auth = useAuth();
  const settings = useSettings();
  const { state, dispatch } = useGame();
  const [name, setName] = useState(auth.profile?.displayName ?? '');
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await auth.updateDisplayName(name);
      setNameMsg(t('profile.nameSaved'));
    } catch (err) {
      setNameMsg(t('auth.error.generic', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await auth.changePassword(current, next);
      setCurrent('');
      setNext('');
      setPwMsg({ ok: true, text: t('profile.passwordChanged') });
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'generic';
      setPwMsg({
        ok: false,
        text: code === 'generic' ? t('auth.error.generic', { error: err instanceof Error ? err.message : String(err) }) : t(`auth.error.${code}`),
      });
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 pb-16 pt-6">
      <Section title={t('profile.account')}>
        <p className="font-display text-lg tracking-grimoire text-bone">@{auth.user?.username}</p>
        <p className={clsx('flex items-center gap-1.5 text-xs', auth.mode === 'firebase' ? 'text-village' : 'text-bone-faint')}>
          {auth.mode === 'firebase' ? <Cloud className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
          {auth.mode === 'firebase' ? t('profile.storageCloud') : t('profile.storageLocal')}
        </p>
      </Section>

      <Section title={t('profile.displayName')}>
        <form onSubmit={saveName} className="flex gap-2">
          <input
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-panel-edge bg-ink px-3 text-bone focus:border-village focus:outline-none"
          />
          <Button type="submit" variant="village" icon={<Save className="h-4 w-4" />}>
            {t('profile.saveName')}
          </Button>
        </form>
        {nameMsg && <p className="text-xs text-bone-dim">{nameMsg}</p>}
      </Section>

      <Section title={t('profile.password')}>
        <form onSubmit={changePassword} className="space-y-3">
          <TextField label={t('profile.currentPassword')} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          <TextField
            label={t('profile.newPassword')}
            hint={t('auth.passwordHint')}
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
          />
          <Button type="submit" icon={<KeyRound className="h-4 w-4" />}>
            {t('profile.changePassword')}
          </Button>
          {pwMsg && <p className={clsx('text-xs', pwMsg.ok ? 'text-village' : 'text-wolf-bright')}>{pwMsg.text}</p>}
        </form>
      </Section>

      <Section title={t('settings.language')}>
        <LanguageToggle wide />
      </Section>

      <Section>
        <label className="flex cursor-pointer items-start justify-between gap-4">
          <span>
            <span className="block font-display text-sm uppercase tracking-grimoire text-bone">{t('settings.sfx')}</span>
            <span className="block text-xs text-bone-dim">{t('settings.sfxHint')}</span>
          </span>
          <input type="checkbox" className="peer sr-only" checked={settings.sfx} onChange={(e) => settings.update({ sfx: e.target.checked })} />
          <span
            aria-hidden
            className={clsx(
              'relative mt-1 h-7 w-12 shrink-0 rounded-full border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-village',
              settings.sfx ? 'border-village bg-village/30 shadow-inner-village' : 'border-panel-edge bg-panel-2',
            )}
          >
            <span
              className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-bone transition-transform"
              style={{ transform: settings.sfx ? 'translate3d(20px,0,0)' : 'translate3d(0,0,0)' }}
            />
          </span>
        </label>
      </Section>

      <div className="space-y-3 pt-2">
        {isActiveGame(state) && (
          <Button
            variant="wolf"
            block
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => window.confirm(t('settings.abandonConfirm')) && dispatch({ type: 'NEW_GAME' })}
          >
            {t('settings.abandon')}
          </Button>
        )}
        <Button block onClick={() => void auth.signOut()} icon={<LogOut className="h-4 w-4" />}>
          {t('auth.signOut')}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="panel animate-step-in space-y-3 p-4">
      {title && <h3 className="text-sm text-bone-dim">{title}</h3>}
      {children}
    </section>
  );
}
