import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { auditLogs, provinces } from '../../drizzle/schema';
import { buildHistoryEntry, withAudit } from './audit.service';

describe('buildHistoryEntry', () => {
  it('records every field as a change on CREATE, with old as null', () => {
    const entry = buildHistoryEntry('CREATE', 'user-1', null, { name: 'Masjid A', status: 'pending' });

    expect(entry.action).toBe('CREATE');
    expect(entry.actorId).toBe('user-1');
    expect(entry.changes).toEqual({
      name: { old: null, new: 'Masjid A' },
      status: { old: null, new: 'pending' },
    });
    expect(typeof entry.at).toBe('string');
    expect(new Date(entry.at).toString()).not.toBe('Invalid Date');
  });

  it('records only the fields that actually changed on UPDATE', () => {
    const oldData = { name: 'Masjid A', status: 'pending', address: 'Jl. Satu' };
    const newData = { name: 'Masjid A', status: 'approved', address: 'Jl. Satu' };

    const entry = buildHistoryEntry('UPDATE', 'admin-1', oldData, newData);

    expect(entry.changes).toEqual({
      status: { old: 'pending', new: 'approved' },
    });
  });

  it('produces an empty changes object when UPDATE data is identical', () => {
    const data = { name: 'Masjid A' };
    const entry = buildHistoryEntry('UPDATE', 'admin-1', data, { ...data });

    expect(entry.changes).toEqual({});
  });

  it('records every field as a change on DELETE, with new as null', () => {
    const entry = buildHistoryEntry('DELETE', 'admin-1', { name: 'Masjid A' }, null);

    expect(entry.changes).toEqual({
      name: { old: 'Masjid A', new: null },
    });
  });

  it('allows a null actorId for system-initiated changes', () => {
    const entry = buildHistoryEntry('CREATE', null, null, { name: 'Seed Row' });
    expect(entry.actorId).toBeNull();
  });
});

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('withAudit', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  it('appends to history and inserts an audit_logs row in one transaction', async () => {
    await db
      .transaction(async (tx) => {
        const [inserted] = await tx
          .insert(provinces)
          .values({ name: `Test Province ${Date.now()}` })
          .returning();
        if (!inserted) throw new Error('insert failed');

        const currentHistory = Array.isArray(inserted.history) ? inserted.history : [];

        await withAudit(tx, {
          table: provinces,
          tableName: 'provinces',
          recordId: inserted.id,
          action: 'CREATE',
          actorId: null,
          oldData: null,
          newData: { name: inserted.name },
          currentHistory,
        });

        const [row] = await tx.select().from(provinces).where(eq(provinces.id, inserted.id));
        expect(Array.isArray(row?.history)).toBe(true);
        expect(Array.isArray(row?.history) ? row.history.length : 0).toBe(1);

        const logs = await tx.select().from(auditLogs).where(eq(auditLogs.recordId, inserted.id));
        expect(logs).toHaveLength(1);
        expect(logs[0]?.tableName).toBe('provinces');
        expect(logs[0]?.action).toBe('CREATE');

        tx.rollback();
      })
      .catch((error) => {
        if (!(error instanceof Error && error.message === 'Rollback')) throw error;
      });
  });

  it('rolls back without an orphan audit log when the target record does not exist', async () => {
    const missingRecordId = randomUUID();

    await expect(
      db.transaction(async (tx) => {
        await withAudit(tx, {
          table: provinces,
          tableName: 'provinces',
          recordId: missingRecordId,
          action: 'UPDATE',
          actorId: null,
          oldData: { name: 'Before' },
          newData: { name: 'After' },
          currentHistory: [],
        });

        throw new Error('withAudit unexpectedly resolved for a missing record');
      })
    ).rejects.toThrow('Audit target not found');

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.recordId, missingRecordId));
    expect(logs).toHaveLength(0);
  });
});
