import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../drizzle/schema.ts';
import { users } from '../drizzle/schema.ts';
import { hashPassword } from '../server/services/password.ts';

/**
 * Creates the Super Admin account, or resets its password if it already exists.
 * Run with: npm run db:seed:admin
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must both be set');
  }
  if (password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    const passwordHash = await hashPassword(password);
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(users)
        .set({ passwordHash, role: 'super_admin', modifiedAt: new Date() })
        .where(eq(users.id, existing[0].id));
      console.log(`Updated existing Super Admin: ${email}`);
    } else {
      await db.insert(users).values({
        name,
        email,
        passwordHash,
        provider: 'local',
        role: 'super_admin',
      });
      console.log(`Created Super Admin: ${email}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
