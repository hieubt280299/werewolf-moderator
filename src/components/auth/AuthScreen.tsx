import clsx from 'clsx';
import { Cloud, HardDrive, LogIn, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { RoleCard } from '../shared/RoleCard';
import { Button, TextField } from '../shared/ui';
import { LanguageToggle } from '../shared/LanguageToggle';
import { describeAuthError } from './authErrors';
import { ForgotPassword } from './ForgotPassword';

type Mode = 'signIn' | 'signUp' | 'forgot';

interface AuthScreenProps {
  /** An emailed password-reset link opened the app: go straight to its New Password form. */
  resetLink?: string | null;
  /** Called once that link's flow ends (success or back to sign in). */
  onResetDone?: () => void;
}

/** Combined username + password sign-in / sign-up, plus Forgot Password. */
export function AuthScreen({ resetLink, onResetDone }: AuthScreenProps = {}) {
  const { t } = useI18n();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>(resetLink ? 'forgot' : 'signIn');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'signUp' && password !== confirm) {
      setError(t('auth.error.mismatch'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') await auth.signIn(username, password);
      else await auth.signUp(username, password, displayName || username, email);
    } catch (err) {
      setError(describeAuthError(err, t));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
    setError(null);
  };

  return (
    <div className="flex min-h-svh flex-col bg-[radial-gradient(110%_60%_at_50%_0%,rgba(200,16,46,0.14),transparent_70%)]">
      <div className="flex justify-end p-4">
        <LanguageToggle />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
        {/* A fanned hand of cards as the brand mark. */}
        <div className="relative mx-auto mb-8 h-44 w-64" aria-hidden>
          {/* Outer wrappers own position/rotation; the card itself plays the deal keyframes. */}
          <div className="absolute left-3 top-5 -rotate-12">
            <RoleCard roleId="seer" size="sm" showWeight={false} className="animate-deal" />
          </div>
          <div className="absolute right-3 top-5 rotate-12">
            <RoleCard roleId="witch" size="sm" showWeight={false} className="animate-deal" style={{ animationDelay: '80ms' }} />
          </div>
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
            <RoleCard roleId="werewolf" size="sm" showWeight={false} className="animate-deal" style={{ animationDelay: '160ms' }} />
          </div>
        </div>

        <h1 className="text-center text-3xl text-bone text-shadow-title">{t('app.title')}</h1>
        <p className="mb-8 mt-1 text-center text-sm text-bone-dim">{t('app.tagline')}</p>

        {mode === 'forgot' ? (
          <ForgotPassword
            oobCode={resetLink}
            onDone={() => {
              setMode('signIn');
              setError(null);
              onResetDone?.();
            }}
          />
        ) : (
          <form onSubmit={submit} className="panel animate-step-in space-y-4 border border-panel-edge p-5">
            <h2 className="text-lg text-bone">{mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}</h2>
            <TextField
              label={t('auth.username')}
              hint={mode === 'signUp' ? t('auth.usernameHint') : undefined}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            {mode === 'signUp' && (
              <>
                <TextField label={t('auth.displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} />
                <TextField
                  label={t('auth.recoveryEmail')}
                  hint={t('auth.recoveryEmailHint')}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  required
                />
              </>
            )}
            <TextField
              label={t('auth.password')}
              hint={mode === 'signUp' ? t('auth.passwordHint') : undefined}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              required
            />
            {mode === 'signIn' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError(null);
                }}
                className="-mt-2 block text-sm text-village underline-offset-2 hover:underline"
              >
                {t('auth.forgot')}
              </button>
            )}
            {mode === 'signUp' && (
              <TextField
                label={t('auth.confirmPassword')}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            )}
            {error && (
              <p role="alert" className="rounded-lg border border-wolf/50 bg-wolf/10 px-3 py-2 text-sm text-bone">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant={mode === 'signIn' ? 'village' : 'wolf'}
              size="lg"
              block
              disabled={busy || auth.status === 'loading'}
              icon={mode === 'signIn' ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            >
              {mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
            </Button>
            <p className="text-center text-sm text-bone-dim">
              {mode === 'signIn' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
              <button type="button" onClick={switchMode} className="font-semibold text-village underline-offset-2 hover:underline">
                {mode === 'signIn' ? t('auth.switchToSignUp') : t('auth.switchToSignIn')}
              </button>
            </p>
          </form>
        )}

        <p className={clsx('mt-4 flex items-center justify-center gap-1.5 text-center text-xs', auth.mode === 'firebase' ? 'text-village' : 'text-bone-faint')}>
          {auth.mode === 'firebase' ? <Cloud className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
          {auth.mode === 'firebase' ? t('auth.cloudMode') : t('auth.localMode')}
        </p>
      </div>
    </div>
  );
}
