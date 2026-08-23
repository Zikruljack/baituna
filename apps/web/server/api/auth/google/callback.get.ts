import { z } from 'zod';

import { exchangeGoogleCode } from '../../../services/google-oauth';
import { signAuthToken } from '../../../services/token';
import { findOrCreateGoogleUser } from '../../../services/user.service';

const querySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Missing code or state' });
  }

  const expectedState = getCookie(event, 'oauth_state');
  deleteCookie(event, 'oauth_state', { path: '/' });
  if (!expectedState || expectedState !== parsed.data.state) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state' });
  }

  if (!config.jwtSecret) {
    throw createError({ statusCode: 500, statusMessage: 'JWT_SECRET is not configured' });
  }
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    throw createError({ statusCode: 500, statusMessage: 'Google OAuth is not configured' });
  }

  const profile = await exchangeGoogleCode(
    {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      redirectUri: config.googleRedirectUri,
    },
    parsed.data.code,
  );
  const user = await findOrCreateGoogleUser(useDatabase(), profile);

  return {
    token: await signAuthToken({ sub: user.id, role: user.role }, config.jwtSecret),
    user,
  };
});
