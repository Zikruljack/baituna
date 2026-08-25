import { and, asc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../../drizzle/schema';
import { people } from '../../drizzle/schema';

export type Database = NodePgDatabase<typeof schema>;

export interface PersonSummary {
  id: string;
  name: string;
  phone: string | null;
}

export async function listActivePeople(db: Database, mosqueId: string): Promise<PersonSummary[]> {
  return await db
    .select({ id: people.id, name: people.name, phone: people.phone })
    .from(people)
    .where(and(eq(people.mosqueId, mosqueId), isNull(people.deletedAt)))
    .orderBy(asc(people.name));
}
