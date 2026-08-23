import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies a password against its own hash', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('Tr0ub4dor&3', stored)).toBe(false);
  });

  it('produces a different hash each time for the same password', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');
    expect(first).not.toBe(second);
  });

  it('returns false for a malformed stored value instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });
});
