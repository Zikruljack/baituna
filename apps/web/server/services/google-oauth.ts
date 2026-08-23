import type { GoogleProfile } from './user.service';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/** Builds the URL the browser follows to begin the Google OAuth flow. */
export function buildGoogleAuthUrl(config: GoogleOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Trades an authorization code for the user's Google profile. */
export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  code: string,
): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) throw new Error('Google token exchange failed');

  const { access_token: accessToken } = (await tokenResponse.json()) as {
    access_token?: string;
  };
  if (!accessToken) throw new Error('Google token exchange failed');

  const profileResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!profileResponse.ok) throw new Error('Failed to fetch Google profile');

  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
  };
  if (!profile.sub || !profile.email) {
    throw new Error('Google profile is missing required fields');
  }

  return {
    providerId: profile.sub,
    email: profile.email,
    name: profile.name ?? profile.email.split('@')[0] ?? profile.email,
  };
}
