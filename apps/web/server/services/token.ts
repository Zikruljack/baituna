import { SignJWT, jwtVerify } from 'jose';

const ROLES = ['super_admin', 'mosque_admin', 'public_user'] as const;

export type UserRole = (typeof ROLES)[number];

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

const TOKEN_LIFETIME = '7d';

/** Signs a 7-day HS256 token carrying the user id and role. */
export async function signAuthToken(payload: AuthTokenPayload, secret: string): Promise<string> {
  return await new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(new TextEncoder().encode(secret));
}

/** Verifies a token. Returns null for a bad signature, expiry, or invalid claims. */
export async function verifyAuthToken(
  token: string,
  secret: string,
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = payload.role;
    const sub = payload.sub;

    if (typeof sub !== 'string' || typeof role !== 'string') return null;
    if (!ROLES.includes(role as UserRole)) return null;

    return { sub, role: role as UserRole };
  } catch {
    return null;
  }
}
