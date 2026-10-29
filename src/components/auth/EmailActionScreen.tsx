import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AuthActionLink } from '../../@types/auth';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { Button } from '../shared/ui';
import { describeAuthError } from './authErrors';

/**
 * Lands an emailed Firebase account link other than a password reset — the confirmation
 * sent to a new recovery email, or (v1.2.0) the email verification sent at sign-up.
 */
export function EmailActionScreen({ mode, oobCode, onDone }: { mode?: AuthActionLink['mode']; oobCode: string; onDone: () => void }) {
  const { t } = useI18n();
  const { applyEmailAction } = useAuth();
  const [result, setResult] = useState<{ ok: true } | { ok: false; error: string } | null>(null);
  // A link's code works once, so it is applied once — not again when the auth state changes.
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    applyEmailAction(oobCode)
      .then(() => setResult({ ok: true }))
      .catch((err: unknown) => setResult({ ok: false, error: describeAuthError(err, t) }));
  }, [oobCode, applyEmailAction, t]);

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div role="status" className="panel animate-step-in w-full max-w-md space-y-4 border border-panel-edge p-5 text-center">
        {!result && (
          <>
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-village" />
            <p className="text-sm text-bone-dim">{t('action.checking')}</p>
          </>
        )}
        {result?.ok && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-village" />
            {/* Verifying keeps the session; changing the email signs the account out. */}
            <p className="text-bone">{mode === 'verifyEmail' ? t('action.emailVerified') : t('action.emailConfirmed')}</p>
          </>
        )}
        {result && !result.ok && (
          <>
            <TriangleAlert className="mx-auto h-10 w-10 text-wolf-bright" />
            <p className="text-bone">{result.error}</p>
          </>
        )}
        {result && (
          <Button variant="village" size="lg" block onClick={onDone}>
            {t('action.continue')}
          </Button>
        )}
      </div>
    </div>
  );
}
