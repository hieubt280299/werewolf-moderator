/**
 * Moderator accounts: sign-in session, recovery email and password reset (v1.0.0), Google
 * sign-in and account linking (v1.2.0, Firebase only).
 *
 * Password reset works differently per backend:
 * - device-local accounts get a 6-digit verification code. There is no mail service on a
 *   device, so the code is shown on screen instead of being emailed;
 * - Firebase accounts get Firebase's own password-reset link, sent to the recovery email.
 *   Opening it brings the moderator back to the app's New Password form (or Firebase's
 *   page, if the console's action URL isn't pointed at the app).
 */

/** A way a Firebase account can sign in (v1.2.0). */
export type SignInProvider = 'password' | 'google';

export interface SessionUser {
  uid: string;
  /** Empty for an account made with Google until a username is added. */
  username: string;
  /** Firebase: the sign-in methods linked to the account. */
  providers?: SignInProvider[];
  /** Firebase: the account's email (the recovery email, or the Google address). */
  email?: string | null;
  emailVerified?: boolean;
  /** Firebase: the address of the linked Google account, if one is linked. */
  googleEmail?: string | null;
}

/**
 * How a Google sign-in (or connecting Google to a signed-in account) ended (v1.2.0).
 * - `done`: signed in or linked; `isNewUser` when Google created a brand-new account.
 * - `redirecting`: the page is leaving for Google; the result is picked up on return.
 * - `cancelled`: the moderator closed the Google window.
 * - `needsPassword`: a username account already owns this email. Its password links Google
 *   to it, so both sign-in methods open the same profile.
 */
export type GoogleOutcome =
  | { status: 'done'; mode: 'signIn' | 'link'; isNewUser: boolean }
  | { status: 'redirecting' }
  | { status: 'cancelled' }
  | { status: 'needsPassword'; email: string };

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
  | 'mismatch'
  // v1.2.0 — Google sign-in & account linking
  /** Linking Google: the password typed for the existing account is wrong. */
  | 'wrongPassword'
  /** This Google account already belongs to another moderator profile. */
  | 'googleInUse'
  /** Google sign-in isn't enabled in the Firebase console. */
  | 'googleUnavailable'
  /** This site isn't in the Firebase console's Authorized domains. */
  | 'unauthorizedDomain'
  /** Re-authentication picked a different Google account than the signed-in one. */
  | 'wrongGoogleAccount'
  /** Disconnecting would leave the account with no way to sign in. */
  | 'lastSignInMethod'
  /** The account already has this sign-in method. */
  | 'alreadyLinked'
  /** Firebase wants a fresh sign-in before this change. */
  | 'recentLogin'
  /** The recovery email is also the linked Google address: disconnect Google to change it. */
  | 'emailLockedByGoogle'
  /** A recovery-email change waits for confirmation: finish or cancel it before linking Google. */
  | 'emailChangePending';
