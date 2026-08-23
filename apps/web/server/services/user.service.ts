import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../../drizzle/schema';
import { users } from '../../drizzle/schema';
import type { UserRole } from './token';

export type Database = NodePgDatabase<typeof schema>;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface GoogleProfile {
  providerId: string;
  email: string;
  name: string;
}

/** Looks up a live local-provider user by email. Used only by password login. */
export async function findUserByEmail(db: Database, email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.provider, 'local'), isNull(users.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

/** Resolves a Google profile, creating a public user on its first sign-in. */
export async function findOrCreateGoogleUser(
  db: Database,
  profile: GoogleProfile,
): Promise<AuthUser> {
  const existing = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.provider, 'google'),
        eq(users.providerId, profile.providerId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const found = existing[0];
  if (found) {
    return { id: found.id, name: found.name, email: found.email, role: found.role };
  }

  const inserted = await db
    .insert(users)
    .values({
      name: profile.name,
      email: profile.email,
      passwordHash: null,
      provider: 'google',
      providerId: profile.providerId,
      role: 'public_user',
    })
    .returning();

  const created = inserted[0];
  if (!created) throw new Error('Failed to create user');

  return { id: created.id, name: created.name, email: created.email, role: created.role };
}

/** Promotes a public user after a mosque approval without ever demoting an admin. */
export async function upgradeToMosqueAdmin(db: Database, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ role: 'mosque_admin', modifiedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.role, 'public_user'), isNull(users.deletedAt)));
}
