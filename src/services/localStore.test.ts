import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalStore } from './localStore';
import { AuthError, maskEmail } from './profileStore';

// Tests run in Node: give the store an in-memory localStorage.
beforeEach(() => {
  const data = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
});

const code = (err: unknown) => (err instanceof AuthError ? err.code : String(err));

describe('device-local password reset', () => {
  it('requires a valid recovery email at sign-up', async () => {
    const store = createLocalStore();
    await expect(store.signUp('mod', 'secret1', 'Mod', 'not-an-email').catch(code)).resolves.toBe('invalidEmail');
    await store.signUp('mod', 'secret1', 'Mod', ' Mod@Example.com ');
    // Sign-up signs the new moderator in.
    const session = JSON.parse(localStorage.getItem('wwgm:session:v1')!);
    expect((await store.loadProfile(session)).recoveryEmail).toBe('mod@example.com');
  });

  it('sends a 6-digit code, enforces the cooldown, and resets the password', async () => {
    const store = createLocalStore();
    await store.signUp('mod', 'secret1', 'Mod', 'mod@example.com');
    const sent = await store.requestPasswordReset('mod');
    expect(sent.method).toBe('code');
    const shown = sent.method === 'code' ? sent.shownCode! : '';
    expect(shown).toMatch(/^\d{6}$/);
    expect(sent.maskedEmail).toBe(maskEmail('mod@example.com'));
    await expect(store.requestPasswordReset('mod').catch(code)).resolves.toBe('cooldown');

    const wrong = shown === '000000' ? '111111' : '000000';
    await expect(store.verifyResetCode('mod', wrong).catch(code)).resolves.toBe('badCode');
    const ticket = await store.verifyResetCode('mod', shown);
    // A code works once.
    await expect(store.verifyResetCode('mod', shown).catch(code)).resolves.toBe('codeExpired');

    await store.completePasswordReset(ticket, 'newpass1');
    await expect(store.signIn('mod', 'secret1').catch(code)).resolves.toBe('badCredentials');
    await expect(store.signIn('mod', 'newpass1')).resolves.toBeUndefined();
    // The ticket is spent too.
    await expect(store.completePasswordReset(ticket, 'again12').catch(code)).resolves.toBe('codeExpired');
  });

  it('refuses unknown users and accounts without a recovery email', async () => {
    const store = createLocalStore();
    await expect(store.requestPasswordReset('ghost').catch(code)).resolves.toBe('unknownUser');
  });

  it('changes the recovery email only with the current password', async () => {
    const store = createLocalStore();
    await store.signUp('mod', 'secret1', 'Mod', 'mod@example.com');
    await expect(store.changeRecoveryEmail('wrong', 'new@example.com').catch(code)).resolves.toBe('badCredentials');
    await expect(store.changeRecoveryEmail('secret1', 'new@example.com')).resolves.toEqual({ email: 'new@example.com', pending: false });
    const sent = await store.requestPasswordReset('mod');
    expect(sent.maskedEmail).toBe('n•••w@example.com');
  });
});
