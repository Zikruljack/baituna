import { jwtVerify, type JWTPayload } from 'jose';

export async function requireAuth(event: { headers: Headers }): Promise<JWTPayload> {
  const authorization = event.headers.get('authorization') ?? undefined;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  const secret = useRuntimeConfig().jwtSecret;

  if (!token || !secret) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' });
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload;
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired token' });
  }
}
