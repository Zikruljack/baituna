import { and, asc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../../drizzle/schema';
import { people } from '../../drizzle/schema';
import { withAudit } from './audit.service';

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

export async function createPerson(
  db: Database,
  mosqueId: string,
  input: { name: string; phone: string | null },
  actorId: string,
): Promise<PersonSummary> {
  return await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(people)
      .values({ mosqueId, name: input.name, phone: input.phone, createdBy: actorId })
      .returning();

    if (!inserted) throw new Error('Failed to create person');

    await withAudit(tx, {
      table: people,
      tableName: 'people',
      recordId: inserted.id,
      action: 'CREATE',
      actorId,
      oldData: null,
      newData: { name: inserted.name, phone: inserted.phone },
      currentHistory: inserted.history as unknown[],
    });

    return { id: inserted.id, name: inserted.name, phone: inserted.phone };
  });
}
