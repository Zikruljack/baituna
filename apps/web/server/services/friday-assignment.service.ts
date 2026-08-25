import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../../drizzle/schema';
import { fridayAssignments, people } from '../../drizzle/schema';
import { withAudit } from './audit.service';
import { isFriday, isPastWib } from '../utils/wib-date';

export type Database = NodePgDatabase<typeof schema>;

export interface AssignmentInput {
  assignmentDate: string;
  khatibPersonId: string | null;
  imamPersonId: string | null;
  muazzinPersonId: string | null;
}

export interface AssignmentRecord extends AssignmentInput {
  id: string;
  mosqueId: string;
}

async function assertPersonIdsBelongToMosque(
  db: Database,
  mosqueId: string,
  personIds: string[],
): Promise<void> {
  if (personIds.length === 0) return;

  const rows = await db
    .select({ id: people.id })
    .from(people)
    .where(and(inArray(people.id, personIds), eq(people.mosqueId, mosqueId), isNull(people.deletedAt)));

  const foundIds = new Set(rows.map((r) => r.id));
  const missing = personIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw createError({
      statusCode: 422,
      statusMessage: `Person id(s) do not belong to this mosque: ${missing.join(', ')}`,
    });
  }
}

export async function createAssignment(
  db: Database,
  mosqueId: string,
  input: AssignmentInput,
  actorId: string,
): Promise<AssignmentRecord> {
  if (!isFriday(input.assignmentDate)) {
    throw createError({ statusCode: 422, statusMessage: 'assignmentDate must be a Friday' });
  }
  if (isPastWib(input.assignmentDate, new Date())) {
    throw createError({ statusCode: 422, statusMessage: 'assignmentDate is in the past' });
  }

  const personIds = [input.khatibPersonId, input.imamPersonId, input.muazzinPersonId].filter(
    (id): id is string => id !== null,
  );
  await assertPersonIdsBelongToMosque(db, mosqueId, personIds);

  return await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: fridayAssignments.id })
      .from(fridayAssignments)
      .where(
        and(
          eq(fridayAssignments.mosqueId, mosqueId),
          eq(fridayAssignments.assignmentDate, input.assignmentDate),
          isNull(fridayAssignments.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'An assignment already exists for this date' });
    }

    const [inserted] = await tx
      .insert(fridayAssignments)
      .values({
        mosqueId,
        assignmentDate: input.assignmentDate,
        khatibPersonId: input.khatibPersonId,
        imamPersonId: input.imamPersonId,
        muazzinPersonId: input.muazzinPersonId,
        createdBy: actorId,
      })
      .returning();

    if (!inserted) throw new Error('Failed to create assignment');

    await withAudit(tx, {
      table: fridayAssignments,
      tableName: 'friday_assignments',
      recordId: inserted.id,
      action: 'CREATE',
      actorId,
      oldData: null,
      newData: {
        assignmentDate: inserted.assignmentDate,
        khatibPersonId: inserted.khatibPersonId,
        imamPersonId: inserted.imamPersonId,
        muazzinPersonId: inserted.muazzinPersonId,
      },
      currentHistory: inserted.history as unknown[],
    });

    return {
      id: inserted.id,
      mosqueId: inserted.mosqueId,
      assignmentDate: inserted.assignmentDate,
      khatibPersonId: inserted.khatibPersonId,
      imamPersonId: inserted.imamPersonId,
      muazzinPersonId: inserted.muazzinPersonId,
    };
  });
}

export async function updateAssignment(
  db: Database,
  mosqueId: string,
  assignmentId: string,
  updates: Partial<{ khatibPersonId: string | null; imamPersonId: string | null; muazzinPersonId: string | null }>,
  actorId: string,
): Promise<AssignmentRecord> {
  return await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(fridayAssignments)
      .where(
        and(
          eq(fridayAssignments.id, assignmentId),
          eq(fridayAssignments.mosqueId, mosqueId),
          isNull(fridayAssignments.deletedAt),
        ),
      )
      .limit(1);

    const assignment = rows[0];
    if (!assignment) {
      throw createError({ statusCode: 404, statusMessage: 'Assignment not found' });
    }
    if (isPastWib(assignment.assignmentDate, new Date())) {
      throw createError({ statusCode: 403, statusMessage: 'This assignment date has already passed' });
    }

    const personIds = Object.values(updates).filter((id): id is string => id !== null && id !== undefined);
    await assertPersonIdsBelongToMosque(tx, mosqueId, personIds);

    const [updated] = await tx
      .update(fridayAssignments)
      .set(updates)
      .where(eq(fridayAssignments.id, assignmentId))
      .returning();
    if (!updated) throw new Error('Failed to update assignment');

    await withAudit(tx, {
      table: fridayAssignments,
      tableName: 'friday_assignments',
      recordId: assignmentId,
      action: 'UPDATE',
      actorId,
      oldData: Object.fromEntries(Object.keys(updates).map((key) => [key, (assignment as Record<string, unknown>)[key]])),
      newData: updates,
      currentHistory: assignment.history as unknown[],
    });

    return {
      id: updated.id,
      mosqueId: updated.mosqueId,
      assignmentDate: updated.assignmentDate,
      khatibPersonId: updated.khatibPersonId,
      imamPersonId: updated.imamPersonId,
      muazzinPersonId: updated.muazzinPersonId,
    };
  });
}
