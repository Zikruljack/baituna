// apps/web/lib/auth-types.ts

/** Mirrors apps/web/server/services/token.ts UserRole. Keep in sync manually — no shared package boundary exists yet. */
export type UserRole = 'super_admin' | 'mosque_admin' | 'public_user';

/** Shape returned as `user` by both apps/web/server/api/auth/login.post.ts and .../google/callback.get.ts. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Full JSON body returned by both auth endpoints on success. */
export interface AuthResponse {
  token: string;
  user: AuthUser;
}
