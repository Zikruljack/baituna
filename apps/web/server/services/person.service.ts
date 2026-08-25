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

export async function updatePerson(
  db: Database,
  mosqueId: string,
  personId: string,
  updates: Partial<{ name: string; phone: string | null }>,
  actorId: string,
): Promise<PersonSummary> {
  return await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.mosqueId, mosqueId), isNull(people.deletedAt)))
      .limit(1);

    const person = rows[0];
    if (!person) {
      throw createError({ statusCode: 404, statusMessage: 'Person not found' });
    }

    const [updated] = await tx.update(people).set(updates).where(eq(people.id, personId)).returning();
    if (!updated) throw new Error('Failed to update person');

    await withAudit(tx, {
      table: people,
      tableName: 'people',
      recordId: personId,
      action: 'UPDATE',
      actorId,
      oldData: Object.fromEntries(Object.keys(updates).map((key) => [key, (person as Record<string, unknown>)[key]])),
      newData: updates,
      currentHistory: person.history as unknown[],
    });

    return { id: updated.id, name: updated.name, phone: updated.phone };
  });
}
