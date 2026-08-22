import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../drizzle/schema';

let pool: Pool | undefined;

/** Returns the shared Drizzle client. Services, not route handlers, should use it. */
export function useDatabase() {
  if (!pool) {
    const databaseUrl = useRuntimeConfig().databaseUrl;
    if (!databaseUrl) {
      throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL is not configured' });
    }
    pool = new Pool({ connectionString: databaseUrl });
  }

  return drizzle(pool, { schema });
}
