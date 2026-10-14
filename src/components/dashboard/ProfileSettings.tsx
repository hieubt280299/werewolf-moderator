import clsx from 'clsx';
import { Cloud, HardDrive, KeyRound, LogOut, Save, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isActiveGame, useGame } from '../../context/GameContext';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../i18n/I18nContext';
import { AuthError } from '../../services/profileStore';
import { LanguageToggle } from '../shared/LanguageToggle';
import { Button, Sheet, TextField } from '../shared/ui';

/**
 * Profile & settings as a modal sheet, so opening it never unmounts the screen underneath
 * (an in-progress setup wizard or game keeps its place).
 */
export function ProfileSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.title')} closeLabel={t('settings.close')}>
      <ProfileSettings onDone={onClose} />
    </Sheet>
  );
}

/** Profile (name, password) and app settings (language, sound), plus sign-out. */
function ProfileSettings({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const auth = useAuth();
  const settings = useSettings();
  const { state, dispatch } = useGame();
  const [name, setName] = useState(auth.profile?.displayName ?? '');
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // The password form stays hidden until asked for, so settings stay short.
  const [pwOpen, setPwOpen] = useState(false);
  const pwSection = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pwOpen) pwSection.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [pwOpen]);

  const openPassword = () => {
    setPwMsg(null);
    setPwOpen(true);
  };

  const closePassword = () => {
    setCurrent('');
    setNext('');
    setPwOpen(false);
  };

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
      closePassword();
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
    <div className="space-y-4 pb-6">
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

      {pwOpen && (
        <div ref={pwSection}>
          <Section title={t('profile.password')}>
            <form onSubmit={changePassword} className="space-y-3">
              <TextField
                label={t('profile.currentPassword')}
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
              <TextField
                label={t('profile.newPassword')}
                hint={t('auth.passwordHint')}
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                required
              />
              {pwMsg && !pwMsg.ok && <p className="text-xs text-wolf-bright">{pwMsg.text}</p>}
              <div className="flex gap-2">
                <Button onClick={closePassword}>{t('pools.cancel')}</Button>
                <Button type="submit" variant="village" block icon={<KeyRound className="h-4 w-4" />}>
                  {t('profile.changePassword')}
                </Button>
              </div>
            </form>
          </Section>
        </div>
      )}

      <div className="space-y-3 pt-2">
        {pwMsg?.ok && <p className="text-center text-xs text-village">{pwMsg.text}</p>}
        {!pwOpen && (
          <Button block onClick={openPassword} icon={<KeyRound className="h-4 w-4" />}>
            {t('profile.password')}
          </Button>
        )}
        {isActiveGame(state) && (
          <Button
            variant="wolf"
            block
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              if (window.confirm(t('settings.abandonConfirm'))) {
                dispatch({ type: 'NEW_GAME' });
                onDone();
              }
            }}
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
