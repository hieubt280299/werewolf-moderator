/**
 * Moderator accounts: sign-in session, recovery email and password reset (v1.0.0).
 *
 * Password reset works differently per backend:
 * - device-local accounts get a 6-digit verification code. There is no mail service on a
 *   device, so the code is shown on screen instead of being emailed;
 * - Firebase accounts get Firebase's own password-reset link, sent to the recovery email.
 *   Opening it brings the moderator back to the app's New Password form (or Firebase's
 *   page, if the console's action URL isn't pointed at the app).
 */

export interface SessionUser {
  uid: string;
  username: string;
}

/** Digits in a password-reset verification code. */
export const RESET_CODE_LENGTH = 6;
/** Seconds before another code / link can be sent. */
export const RESET_RESEND_SECONDS = 120;
/** A verification code is valid for this long after it is sent. */
export const RESET_CODE_TTL_MS = 10 * 60_000;
/** Wrong codes allowed before a new one must be requested. */
export const RESET_MAX_ATTEMPTS = 5;

/** How a password-reset request reached the moderator. */
export type ResetDelivery =
  | {
      method: 'code';
      maskedEmail: string;
      /** Device-local accounts have no mail service, so the code is shown on screen. */
      shownCode?: string;
    }
  | { method: 'link'; maskedEmail: string };

/** Forgot-password wizard: who → verify (code, or the emailed link) → new password → done. */
export type RecoveryStage = 'request' | 'code' | 'linkSent' | 'newPassword' | 'done';

export interface RecoveryEmailChange {
  email: string;
  /** Firebase: the address becomes active once the confirmation link sent to it is opened. */
  pending: boolean;
}

/** An emailed Firebase account link that opened the app (`?mode=…&oobCode=…`). */
export interface AuthActionLink {
  mode: 'resetPassword' | 'verifyAndChangeEmail' | 'verifyEmail' | 'recoverEmail';
  oobCode: string;
}

export type AuthErrorCode =
  | 'invalidUsername'
  | 'weakPassword'
  | 'taken'
  | 'badCredentials'
  | 'network'
  | 'tooMany'
  | 'generic'
  // v1.0.0 — recovery email & password reset
  | 'invalidEmail'
  | 'emailTaken'
  | 'unknownUser'
  | 'noRecoveryEmail'
  | 'badCode'
  | 'codeExpired'
  | 'cooldown'
  | 'linkInvalid'
  /** New password and its confirmation differ. */
  | 'mismatch';
