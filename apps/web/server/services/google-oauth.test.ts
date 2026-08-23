import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildGoogleAuthUrl, exchangeGoogleCode } from './google-oauth';

const config = {
  clientId: 'client-id-123',
  clientSecret: 'client-secret-456',
  redirectUri: 'http://localhost:3000/api/auth/google/callback',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildGoogleAuthUrl', () => {
  it('includes the client id, redirect uri, and state', () => {
    const url = new URL(buildGoogleAuthUrl(config, 'state-token'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id-123');
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toContain('email');
  });
});

describe('exchangeGoogleCode', () => {
  it('returns the profile from the userinfo response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at-1' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'google-sub-1', email: 'x@example.com', name: 'Xavier' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const profile = await exchangeGoogleCode(config, 'auth-code');

    expect(profile).toEqual({
      providerId: 'google-sub-1',
      email: 'x@example.com',
      name: 'Xavier',
    });
  });

  it('throws when the token exchange fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(exchangeGoogleCode(config, 'bad-code')).rejects.toThrow(
      'Google token exchange failed',
    );
  });

  it('throws when the profile has no email', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'google-sub-1' }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeGoogleCode(config, 'auth-code')).rejects.toThrow(
      'Google profile is missing required fields',
    );
  });
});
