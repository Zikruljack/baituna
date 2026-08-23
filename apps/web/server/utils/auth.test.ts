import { describe, expect, it } from 'vitest';

import { assertRole } from './auth';

describe('assertRole', () => {
  it('passes when the role is in the allowed list', () => {
    expect(() => assertRole({ sub: 'u1', role: 'super_admin' }, ['super_admin'])).not.toThrow();
  });

  it('passes when the role is one of several allowed', () => {
    expect(() =>
      assertRole({ sub: 'u1', role: 'mosque_admin' }, ['super_admin', 'mosque_admin']),
    ).not.toThrow();
  });

  it('throws a 403 when the role is not allowed', () => {
    expect(() => assertRole({ sub: 'u1', role: 'public_user' }, ['super_admin'])).toThrowError(
      expect.objectContaining({ statusCode: 403 }),
    );
  });
});
