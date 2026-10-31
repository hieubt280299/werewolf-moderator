import clsx from 'clsx';
import { KeyRound, MailCheck, Plus, Unlink } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { AuthError } from '../../services/profileStore';
import { describeAuthError } from '../auth/authErrors';
import { GoogleMark } from '../auth/GoogleButton';
import { Button, TextField } from '../shared/ui';

type Busy = 'connect' | 'disconnect' | 'verify' | 'add' | null;

/**
 * Firebase only (v1.2.0): how this account signs in — Google and/or username + password —
 * with connect / disconnect, adding username & password to a Google account, and the
 * email-verification nudge (a verified email keeps its password when Google joins later).
 */
export function SignInMethodsSection() {
  const { t } = useI18n();
  const auth = useAuth();
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [verifySent, setVerifySent] = useState(false);

  if (!auth.googleEnabled || !auth.user) return null;
  const providers = auth.user.providers ?? [];
  const hasGoogle = providers.includes('google');
  const hasPassword = providers.includes('password');
  const username = auth.profile?.username ?? '';
  const email = auth.user.email ?? '';
  const passwordReady = hasPassword && !!username;
  // Linking now would let the pending change's link move the account off the Google address.
  const pendingEmail = auth.profile?.pendingRecoveryEmail && auth.profile.pendingRecoveryEmail !== email ? auth.profile.pendingRecoveryEmail : null;

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<string | null>) => {
    setBusy(kind);
    setMsg(null);
    try {
      const text = await fn();
      if (text) setMsg({ ok: true, text });
    } catch (err) {
      setMsg({ ok: false, text: describeAuthError(err, t) });
    } finally {
      setBusy(null);
    }
  };

  const connect = () =>
    run('connect', async () => {
      const outcome = await auth.connectGoogle();
      return outcome.status === 'done' ? t('signin.connected') : null;
    });

  const disconnect = () => {
    if (!window.confirm(t('signin.disconnectConfirm', { username }))) return;
    void run('disconnect', async () => {
      await auth.disconnectGoogle();
      return t('signin.disconnected');
    });
  };

  const closeAdd = () => {
    setAdding(false);
    setNewUsername('');
    setPassword('');
    setConfirm('');
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    void run('add', async () => {
      if (password !== confirm) throw new AuthError('mismatch');
      await auth.addPasswordSignIn(password, username ? undefined : newUsername);
      closeAdd();
      return t('signin.added');
    });
  };

  const verify = () =>
    run('verify', async () => {
      await auth.sendVerificationEmail();
      setVerifySent(true);
      return t('signin.verifySent', { email });
    });

  return (
    <section className="panel animate-step-in space-y-3 p-4">
      <h3 className="text-sm text-bone-dim">{t('signin.title')}</h3>

      <MethodRow
        icon={<GoogleMark className="h-5 w-5" />}
        name={t('signin.google')}
        status={hasGoogle ? t('signin.on') : t('signin.off')}
        on={hasGoogle}
        action={
          hasGoogle ? (
            <Button size="sm" onClick={disconnect} disabled={!!busy || !passwordReady} icon={<Unlink className="h-3.5 w-3.5" />}>
              {t('signin.disconnect')}
            </Button>
          ) : (
            <Button size="sm" variant="village" onClick={() => void connect()} disabled={!!busy || !!pendingEmail}>
              {t('signin.connect')}
            </Button>
          )
        }
      />
      {hasGoogle && !passwordReady && <p className="-mt-1 pl-8 text-[11px] text-bone-faint">{t('signin.onlyGoogle')}</p>}
      {!hasGoogle && pendingEmail && <p className="-mt-1 pl-8 text-[11px] text-bone-faint">{t('signin.pendingBlocks', { email: pendingEmail })}</p>}

      <MethodRow
        icon={<KeyRound className="h-5 w-5 text-village" />}
        name={t('signin.password')}
        status={passwordReady ? `@${username}` : t('signin.off')}
        on={passwordReady}
        action={
          !passwordReady &&
          !adding && (
            <Button size="sm" variant="village" onClick={() => setAdding(true)} disabled={!!busy} icon={<Plus className="h-3.5 w-3.5" />}>
              {t('signin.add')}
            </Button>
          )
        }
      />

      {adding && (
        <form onSubmit={add} className="space-y-3 border-t border-panel-edge pt-3">
          <p className="font-display text-xs tracking-wide text-bone">{username ? t('signin.setPassword') : t('signin.addTitle')}</p>
          <p className="text-xs text-bone-dim">{t('signin.addHint', { email })}</p>
          {!username && (
            <TextField
              label={t('auth.username')}
              hint={t('auth.usernameHint')}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
            />
          )}
          <TextField
            label={t('auth.password')}
            hint={t('auth.passwordHint')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus={!!username}
            required
          />
          <TextField label={t('auth.confirmPassword')} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          <div className="flex gap-2">
            <Button onClick={closeAdd} disabled={busy === 'add'}>
              {t('pools.cancel')}
            </Button>
            <Button type="submit" variant="village" block disabled={busy === 'add'} icon={<KeyRound className="h-4 w-4" />}>
              {t('signin.save')}
            </Button>
          </div>
        </form>
      )}

      {/* An unverified email loses its password to a later Google sign-in: nudge to verify. */}
      {hasPassword && !auth.user.emailVerified && email && (
        <div className="space-y-2 rounded-xl border border-ember/40 bg-ember/5 p-3">
          <p className="text-xs text-bone/85">{t('signin.verifyBody', { email })}</p>
          <Button size="sm" onClick={() => void verify()} disabled={!!busy || verifySent} icon={<MailCheck className="h-3.5 w-3.5" />}>
            {verifySent ? t('signin.verifySentShort') : t('signin.verifySend')}
          </Button>
        </div>
      )}

      {msg && <p className={clsx('text-xs', msg.ok ? 'text-village' : 'text-wolf-bright')}>{msg.text}</p>}
    </section>
  );
}

function MethodRow({ icon, name, status, on, action }: { icon: ReactNode; name: string; status: string; on: boolean; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm tracking-wide text-bone">{name}</span>
        <span className={clsx('block truncate text-xs', on ? 'text-village' : 'text-bone-faint')}>{status}</span>
      </span>
      {action}
    </div>
  );
}
