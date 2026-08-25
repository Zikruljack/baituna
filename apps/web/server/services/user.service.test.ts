import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { users } from '../../drizzle/schema';
import { findUserById } from './user.service';

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('findUserById', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  it('returns the user shape for a live user', async () => {
    const unique = randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        name: 'Find By Id User',
        email: `find-by-id-${unique}@example.test`,
        role: 'public_user',
        provider: 'local',
      })
      .returning();
    if (!user) throw new Error('user insert failed');

    await expect(findUserById(db, user.id)).resolves.toEqual({
      id: user.id,
      name: 'Find By Id User',
      email: `find-by-id-${unique}@example.test`,
      role: 'public_user',
    });
  });

  it('returns null for a soft-deleted user', async () => {
    const unique = randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        name: 'Deleted User',
        email: `deleted-${unique}@example.test`,
        role: 'public_user',
        provider: 'local',
      })
      .returning();
    if (!user) throw new Error('user insert failed');
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));

    await expect(findUserById(db, user.id)).resolves.toBeNull();
  });

  it('returns null for a nonexistent id', async () => {
    await expect(findUserById(db, randomUUID())).resolves.toBeNull();
  });
});
