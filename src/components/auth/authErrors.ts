import type { TranslationKey } from '../../i18n/translations';
import { AuthError } from '../../services/profileStore';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** A localized message for anything an account call can throw. */
export function describeAuthError(err: unknown, t: Translate): string {
  const code = err instanceof AuthError ? err.code : 'generic';
  if (code === 'generic') return t('auth.error.generic', { error: err instanceof Error ? err.message : String(err) });
  return t(`auth.error.${code}`);
}
