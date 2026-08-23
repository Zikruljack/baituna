import { and, eq, isNull } from 'drizzle-orm';

import { mosques } from '../../drizzle/schema';
import { type AuthTokenPayload, type UserRole, verifyAuthToken } from '../services/token';

type NitroEvent = Parameters<typeof getHeader>[0];

/** Pure role check, extracted so it can be unit-tested without an H3 event. */
export function assertRole(payload: AuthTokenPayload, allowed: UserRole[]): void {
  if (!allowed.includes(payload.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' });
  }
}

/** Requires a valid bearer token. Throws 401 otherwise. */
export async function requireAuth(event: NitroEvent): Promise<AuthTokenPayload> {
  const authorization = getHeader(event, 'authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  const { jwtSecret } = useRuntimeConfig();

  if (!token || !jwtSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' });
  }

  const payload = await verifyAuthToken(token, jwtSecret);
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired token' });
  }

  return payload;
}

/** Requires a valid token whose role is one of `allowed`. */
export async function requireRole(
  event: NitroEvent,
  ...allowed: UserRole[]
): Promise<AuthTokenPayload> {
  const payload = await requireAuth(event);
  assertRole(payload, allowed);
  return payload;
}

/**
 * Requires a caller to own `mosqueId`. Ownership is `mosques.admin_user_id`,
 * not role alone: a mosque admin must not access another mosque.
 */
export async function requireMosqueOwner(
  event: NitroEvent,
  mosqueId: string,
): Promise<AuthTokenPayload> {
  const payload = await requireAuth(event);
  if (payload.role === 'super_admin') return payload;

  const rows = await useDatabase()
    .select({ adminUserId: mosques.adminUserId })
    .from(mosques)
    .where(and(eq(mosques.id, mosqueId), isNull(mosques.deletedAt)))
    .limit(1);

  const mosque = rows[0];
  if (!mosque) {
    throw createError({ statusCode: 404, statusMessage: 'Mosque not found' });
  }
  if (mosque.adminUserId !== payload.sub) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' });
  }

  return payload;
}
