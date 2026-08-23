import { randomBytes } from 'node:crypto';

import { buildGoogleAuthUrl } from '../../../services/google-oauth';

export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  if (!config.googleClientId || !config.googleRedirectUri) {
    throw createError({ statusCode: 500, statusMessage: 'Google OAuth is not configured' });
  }

  const state = randomBytes(16).toString('hex');
  setCookie(event, 'oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return sendRedirect(
    event,
    buildGoogleAuthUrl(
      {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        redirectUri: config.googleRedirectUri,
      },
      state,
    ),
  );
});
