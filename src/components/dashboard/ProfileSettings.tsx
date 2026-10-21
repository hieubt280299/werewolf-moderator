import clsx from 'clsx';
import { Cloud, HardDrive, KeyRound, LogOut, Mail, MailCheck, Save, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isActiveGame, useGame } from '../../context/GameContext';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../i18n/I18nContext';
import { describeAuthError } from '../auth/authErrors';
import { RebalancesSection } from '../settings/RebalancesSection';
import { LanguageToggle } from '../shared/LanguageToggle';
import { Button, Sheet, TextField, Toggle } from '../shared/ui';

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

/**
 * Profile (name, password, recovery email), house rules and app settings (language,
 * sound), plus sign-out.
 */
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
  // The password and email forms stay hidden until asked for, so settings stay short.
  const [pwOpen, setPwOpen] = useState(false);
  const pwSection = useRef<HTMLDivElement>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const emailSection = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pwOpen) pwSection.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [pwOpen]);
  useEffect(() => {
    if (emailOpen) emailSection.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [emailOpen]);

  const openPassword = () => {
    setPwMsg(null);
    setEmailOpen(false);
    setPwOpen(true);
  };

  const openEmail = () => {
    setEmailMsg(null);
    setPwOpen(false);
    setEmailOpen(true);
  };

  const closeEmail = () => {
    setNewEmail('');
    setEmailPassword('');
    setEmailOpen(false);
  };

  const changeEmail = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const change = await auth.changeRecoveryEmail(emailPassword, newEmail);
      closeEmail();
      setEmailMsg({ ok: true, text: change.pending ? t('profile.emailPending', { email: change.email }) : t('profile.emailChanged') });
    } catch (err) {
      setEmailMsg({ ok: false, text: describeAuthError(err, t) });
    }
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
      setPwMsg({ ok: false, text: describeAuthError(err, t) });
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
        <div className="border-t border-panel-edge pt-3 text-sm">
          <p className="font-display text-xs uppercase tracking-grimoire text-bone-dim">{t('profile.currentEmail')}</p>
          {auth.profile?.recoveryEmail ? (
            <p className="flex items-center gap-1.5 break-all text-bone">
              <Mail className="h-3.5 w-3.5 shrink-0 text-village" /> {auth.profile.recoveryEmail}
            </p>
          ) : (
            <p className="text-xs text-ember">{t('profile.noEmail')}</p>
          )}
          {auth.profile?.pendingRecoveryEmail && (
            <p className="mt-1 break-all text-xs text-bone-dim">{t('profile.pendingEmail', { email: auth.profile.pendingRecoveryEmail })}</p>
          )}
        </div>
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
        <Toggle checked={settings.sfx} onChange={(sfx) => settings.update({ sfx })} label={t('settings.sfx')} hint={t('settings.sfxHint')} />
      </Section>

      <RebalancesSection />

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

      {emailOpen && (
        <div ref={emailSection}>
          <Section title={t('profile.email')}>
            <form onSubmit={changeEmail} className="space-y-3">
              <TextField
                label={t('profile.newEmail')}
                hint={t('auth.recoveryEmailHint')}
                type="email"
                inputMode="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                autoFocus
                required
              />
              <TextField
                label={t('profile.currentPassword')}
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              {emailMsg && !emailMsg.ok && <p className="text-xs text-wolf-bright">{emailMsg.text}</p>}
              <div className="flex gap-2">
                <Button onClick={closeEmail}>{t('pools.cancel')}</Button>
                <Button type="submit" variant="village" block icon={<MailCheck className="h-4 w-4" />}>
                  {t('profile.changeEmail')}
                </Button>
              </div>
            </form>
          </Section>
        </div>
      )}

      <div className="space-y-3 pt-2">
        {pwMsg?.ok && <p className="text-center text-xs text-village">{pwMsg.text}</p>}
        {emailMsg?.ok && <p className="text-center text-xs text-village">{emailMsg.text}</p>}
        {/* Account security: password and recovery email side by side. */}
        {(!pwOpen || !emailOpen) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!pwOpen && (
              <Button block onClick={openPassword} icon={<KeyRound className="h-4 w-4" />}>
                {t('profile.password')}
              </Button>
            )}
            {!emailOpen && (
              <Button block onClick={openEmail} icon={<Mail className="h-4 w-4" />}>
                {t('profile.email')}
              </Button>
            )}
          </div>
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
