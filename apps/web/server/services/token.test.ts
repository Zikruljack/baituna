import { describe, expect, it } from 'vitest';

import { signAuthToken, verifyAuthToken } from './token';

const SECRET = 'test-secret-that-is-long-enough-for-hs256';

describe('auth tokens', () => {
  it('round-trips a payload', async () => {
    const token = await signAuthToken({ sub: 'user-1', role: 'super_admin' }, SECRET);
    const payload = await verifyAuthToken(token, SECRET);
    expect(payload).toEqual({ sub: 'user-1', role: 'super_admin' });
  });

  it('returns null when the secret does not match', async () => {
    const token = await signAuthToken({ sub: 'user-1', role: 'public_user' }, SECRET);
    expect(await verifyAuthToken(token, 'a-completely-different-secret-value')).toBeNull();
  });

  it('returns null for a malformed token instead of throwing', async () => {
    expect(await verifyAuthToken('not.a.jwt', SECRET)).toBeNull();
  });

  it('returns null when the role claim is not a known role', async () => {
    const { SignJWT } = await import('jose');
    const forged = await new SignJWT({ role: 'root' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));

    expect(await verifyAuthToken(forged, SECRET)).toBeNull();
  });
});
