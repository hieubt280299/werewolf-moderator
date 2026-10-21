import { CheckCircle2, KeyRound, MailCheck, RotateCw, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { RESET_CODE_LENGTH } from '../../@types/auth';
import { useAuth, usePasswordRecovery } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { Button, TextField } from '../shared/ui';
import { describeAuthError } from './authErrors';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Forgot Password: username → verification code (device accounts) or emailed link
 * (Firebase) with a resend cooldown → new password + confirmation → success.
 * `oobCode` starts at the new-password step, for a reset link that opened the app.
 */
export function ForgotPassword({ oobCode, onDone }: { oobCode?: string | null; onDone: () => void }) {
  const { t } = useI18n();
  const { mode } = useAuth();
  const flow = usePasswordRecovery(oobCode);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const byLink = mode === 'firebase';
  const error = flow.error ? describeAuthError(flow.error, t) : null;

  // A full code verifies itself; a wrong one stays editable for another try.
  const { verify, stage, busy } = flow;
  useEffect(() => {
    if (stage === 'code' && code.length === RESET_CODE_LENGTH && !busy) void verify(code);
    // Only a newly completed code verifies (not every re-render while busy).
  }, [code, stage]);

  const submitUsername = (e: FormEvent) => {
    e.preventDefault();
    setCode('');
    void flow.send(username);
  };
  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === RESET_CODE_LENGTH) void flow.verify(code);
  };
  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    void flow.submitNewPassword(password, confirm);
  };
  const resendLabel = byLink ? t('forgot.resendLink') : t('forgot.resendCode');

  if (flow.stage === 'done') {
    return (
      <div role="status" className="panel animate-step-in space-y-4 border border-village/40 p-5 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-village" />
        <h2 className="text-lg text-bone">{t('forgot.done')}</h2>
        <p className="text-sm text-bone-dim">{t('forgot.doneBody')}</p>
        <Button variant="village" size="lg" block onClick={onDone}>
          {t('forgot.backToSignIn')}
        </Button>
      </div>
    );
  }

  return (
    <div className="panel animate-step-in space-y-4 border border-panel-edge p-5">
      <h2 className="text-lg text-bone">{t('forgot.title')}</h2>

      {flow.stage === 'request' && (
        <form onSubmit={submitUsername} className="space-y-4">
          <p className="text-sm text-bone-dim">{byLink ? t('forgot.hintLink') : t('forgot.hint')}</p>
          <TextField
            label={t('auth.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
          />
          {error && <ErrorNote text={error} />}
          <Button type="submit" variant="village" size="lg" block disabled={flow.busy || !username.trim()} icon={<Send className="h-5 w-5" />}>
            {byLink ? t('forgot.sendLink') : t('forgot.sendCode')}
          </Button>
        </form>
      )}

      {(flow.stage === 'code' || flow.stage === 'linkSent') && flow.delivery && (
        <form onSubmit={submitCode} className="space-y-4">
          {flow.delivery.method === 'code' && flow.delivery.shownCode ? (
            // Device accounts have no mail service: the code is shown here instead.
            <div className="rounded-xl border border-village/40 bg-village/10 px-3 py-3 text-sm text-bone">
              <p>{t('forgot.localCode')}</p>
              <p className="mt-1 text-center font-display text-3xl tracking-[0.4em] text-village">{flow.delivery.shownCode}</p>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-xl border border-village/40 bg-village/10 px-3 py-2.5 text-sm text-bone">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-village" />
              {byLink ? t('forgot.linkSent', { email: flow.delivery.maskedEmail }) : t('forgot.codeSent', { email: flow.delivery.maskedEmail })}
            </p>
          )}
          {flow.stage === 'code' && (
            <TextField
              label={t('forgot.code')}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, RESET_CODE_LENGTH))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern={`\\d{${RESET_CODE_LENGTH}}`}
              maxLength={RESET_CODE_LENGTH}
              placeholder={'•'.repeat(RESET_CODE_LENGTH)}
              className="[&_input]:text-center [&_input]:font-display [&_input]:text-2xl [&_input]:tracking-[0.5em]"
              autoFocus
              required
            />
          )}
          {error && <ErrorNote text={error} />}
          <Button
            variant={flow.stage === 'linkSent' ? 'village' : 'ghost'}
            size="lg"
            block
            disabled={flow.secondsLeft > 0 || flow.busy}
            onClick={() => {
              setCode('');
              void flow.resend();
            }}
            icon={<RotateCw className="h-5 w-5" />}
          >
            {flow.secondsLeft > 0 ? `${resendLabel} (${clock(flow.secondsLeft)})` : resendLabel}
          </Button>
          <button type="button" onClick={flow.restart} className="block w-full text-center text-sm text-bone-dim underline-offset-2 hover:underline">
            {t('forgot.changeUser')}
          </button>
        </form>
      )}

      {flow.stage === 'newPassword' && (
        <form onSubmit={submitPassword} className="space-y-4">
          {flow.linkEmail && (
            <p className="flex items-center gap-2 text-sm text-bone-dim">
              <ShieldCheck className="h-4 w-4 text-village" /> {t('forgot.newPasswordFor', { email: flow.linkEmail })}
            </p>
          )}
          <TextField
            label={t('forgot.newPassword')}
            hint={t('auth.passwordHint')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            required
          />
          <TextField
            label={t('forgot.confirmPassword')}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          {error && <ErrorNote text={error} />}
          <Button type="submit" variant="village" size="lg" block disabled={flow.busy} icon={<KeyRound className="h-5 w-5" />}>
            {t('forgot.save')}
          </Button>
        </form>
      )}

      {flow.stage !== 'newPassword' && (
        <button type="button" onClick={onDone} className="block w-full text-center text-sm font-semibold text-village underline-offset-2 hover:underline">
          {t('forgot.backToSignIn')}
        </button>
      )}
    </div>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="rounded-lg border border-wolf/50 bg-wolf/10 px-3 py-2 text-sm text-bone">
      {text}
    </p>
  );
}
