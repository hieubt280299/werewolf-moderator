import { CheckCircle2, KeyRound, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { AuthError } from '../../services/profileStore';
import { readJSON, STORAGE_KEYS, writeJSON } from '../../utils/storage';
import { Button, Sheet, TextField } from '../shared/ui';
import { describeAuthError } from './authErrors';

/**
 * Account notices over the signed-in app (Firebase, v1.2.0):
 * - Google replaced an unverified account's password: offer, once per device, to set one
 *   again so the username keeps working;
 * - connecting Google by redirect finished (or failed) while the app reloaded.
 */
export function AccountPrompts() {
  const { mode, user, profile, redirectNotice } = useAuth();
  const [dismissed, setDismissed] = useState(() => readJSON<string[]>(STORAGE_KEYS.restorePasswordDismissed, []));

  const lostPassword =
    mode === 'firebase' && !!user && !!profile?.username && !!user.providers && !user.providers.includes('password') && !dismissed.includes(user.uid);

  const dismiss = () => {
    if (!user) return;
    const next = [...dismissed, user.uid];
    writeJSON(STORAGE_KEYS.restorePasswordDismissed, next);
    setDismissed(next);
  };

  if (redirectNotice) return <RedirectNoticeSheet />;
  return <RestorePasswordSheet open={lostPassword} username={profile?.username ?? ''} onClose={dismiss} />;
}

function RestorePasswordSheet({ open, username, onClose }: { open: boolean; username: string; onClose: () => void }) {
  const { t } = useI18n();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (password !== confirm) throw new AuthError('mismatch');
      // The prompt closes by itself once the account has a password again.
      await auth.addPasswordSignIn(password);
    } catch (err) {
      setError(describeAuthError(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('restore.title')} closeLabel={t('restore.later')}>
      <form onSubmit={submit} className="space-y-4 pb-6">
        <p className="text-sm text-bone-dim">{t('restore.body', { username })}</p>
        {/* Lets password managers save the new password under the username. */}
        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
        <TextField
          label={t('forgot.newPassword')}
          hint={t('auth.passwordHint')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <TextField label={t('forgot.confirmPassword')} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        {error && <p className="text-xs text-wolf-bright">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={onClose} disabled={busy}>
            {t('restore.later')}
          </Button>
          <Button type="submit" variant="village" block disabled={busy} icon={<KeyRound className="h-4 w-4" />}>
            {t('restore.save')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function RedirectNoticeSheet() {
  const { t } = useI18n();
  const { redirectNotice, dismissRedirectNotice } = useAuth();
  const ok = redirectNotice?.kind === 'connected';
  return (
    <Sheet open={!!redirectNotice} onClose={dismissRedirectNotice} title={t('signin.google')} closeLabel={t('action.continue')}>
      <div className="space-y-4 pb-6 text-center">
        {ok ? <CheckCircle2 className="mx-auto h-10 w-10 text-village" /> : <TriangleAlert className="mx-auto h-10 w-10 text-wolf-bright" />}
        <p className="text-bone">{redirectNotice?.kind === 'error' ? describeAuthError(redirectNotice.error, t) : t('signin.connected')}</p>
        <Button variant="village" block onClick={dismissRedirectNotice}>
          {t('action.continue')}
        </Button>
      </div>
    </Sheet>
  );
}
