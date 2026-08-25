import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { auditLogs, cities, mosques, provinces, users } from '../../drizzle/schema';
import {
  approveMosque,
  checkForDuplicate,
  createMosque,
  listMySubmissions,
  listPendingMosques,
  rejectMosque,
  updateApprovedMosque,
} from './mosque.service';

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('createMosque', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  async function createModerationFixture(
    label: string,
    submitterRole: 'public_user' | 'mosque_admin' = 'public_user',
  ) {
    const unique = randomUUID();
    const [province] = await db
      .insert(provinces)
      .values({ name: `${label} Province ${unique}` })
      .returning();
    if (!province) throw new Error('province insert failed');

    const [city] = await db
      .insert(cities)
      .values({ name: `${label} City ${unique}`, provinceId: province.id })
      .returning();
    if (!city) throw new Error('city insert failed');

    const [submitter] = await db
      .insert(users)
      .values({
        name: `${label} Submitter`,
        email: `${label.toLowerCase().replaceAll(' ', '-')}-${unique}@example.test`,
        role: submitterRole,
        provider: 'local',
      })
      .returning();
    if (!submitter) throw new Error('submitter insert failed');

    const [actor] = await db
      .insert(users)
      .values({
        name: `${label} Actor`,
        email: `${label.toLowerCase().replaceAll(' ', '-')}-actor-${unique}@example.test`,
        role: 'super_admin',
        provider: 'local',
      })
      .returning();
    if (!actor) throw new Error('actor insert failed');

    const mosque = await createMosque(
      db,
      {
        name: `${label} Mosque`,
        address: `${label} Address`,
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
      },
      submitter.id,
    );

    return { actor, mosque, submitter };
  }

  it('inserts a pending mosque and writes one audit entry', async () => {
    const timestamp = Date.now();
    const [actor] = await db
      .insert(users)
      .values({
        name: `Test Actor ${timestamp}`,
        email: `test-actor-${timestamp}@example.test`,
        passwordHash: 'test-password-hash',
        provider: 'local',
      })
      .returning();
    if (!actor) throw new Error('actor insert failed');

    const [province] = await db
      .insert(provinces)
      .values({ name: `Prov ${timestamp}` })
      .returning();
    if (!province) throw new Error('province insert failed');

    const [city] = await db
      .insert(cities)
      .values({ name: `City ${timestamp}`, provinceId: province.id })
      .returning();
    if (!city) throw new Error('city insert failed');

    const result = await createMosque(
      db,
      {
        name: 'Masjid Test',
        address: 'Jl. Test No. 1',
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
      },
      actor.id,
    );

    expect(result.status).toBe('pending');

    const [row] = await db.select().from(mosques).where(eq(mosques.id, result.id));
    expect(row?.status).toBe('pending');
    expect((row?.history as unknown[]).length).toBe(1);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.recordId, result.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe('CREATE');
  });

  it('creates a new public_user account when actorId is null', async () => {
    const timestamp = Date.now();
    const [province] = await db.insert(provinces).values({ name: `AcctProv ${timestamp}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `AcctCity ${timestamp}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');

    const unique = randomUUID();
    const result = await createMosque(
      db,
      {
        name: 'Masjid Publik Test',
        address: 'Jl. Publik No. 1',
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
        submitterName: 'Pendaftar Publik',
        email: `pendaftar-${unique}@gmail.com`,
        password: 'password123',
      },
      null,
    );

    expect(result.status).toBe('pending');
    expect(result.newAccount).toBeDefined();
    expect(result.newAccount?.email).toBe(`pendaftar-${unique}@gmail.com`);
    expect(result.newAccount?.role).toBe('public_user');

    const [createdUser] = await db.select().from(users).where(eq(users.id, result.newAccount!.id));
    expect(createdUser?.passwordHash).toBeTruthy();
    expect(createdUser?.provider).toBe('local');

    const [mosqueRow] = await db.select().from(mosques).where(eq(mosques.id, result.id));
    expect(mosqueRow?.createdBy).toBe(result.newAccount!.id);
  });

  it('rejects registration when the email is already taken', async () => {
    const timestamp = Date.now();
    const [province] = await db.insert(provinces).values({ name: `DupeProv ${timestamp}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `DupeCity ${timestamp}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');

    const unique = randomUUID();
    const existingEmail = `taken-${unique}@gmail.com`;
    await db.insert(users).values({
      name: 'Existing User',
      email: existingEmail,
      passwordHash: 'irrelevant-hash',
      provider: 'local',
      role: 'public_user',
    });

    await expect(
      createMosque(
        db,
        {
          name: 'Masjid Duplikat Email',
          address: 'Jl. Dupe No. 1',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
          submitterName: 'Pendaftar Lain',
          email: existingEmail,
          password: 'password123',
        },
        null,
      ),
    ).rejects.toThrow();
  });

  it('creates a mosque for an already-authenticated actor without a newAccount', async () => {
    const timestamp = Date.now();
    const [province] = await db.insert(provinces).values({ name: `AuthProv ${timestamp}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `AuthCity ${timestamp}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');
    const unique = randomUUID();
    const [actor] = await db
      .insert(users)
      .values({ name: 'Actor', email: `actor-existing-${unique}@example.test`, role: 'public_user', provider: 'local' })
      .returning();
    if (!actor) throw new Error('actor insert failed');

    const result = await createMosque(
      db,
      {
        name: 'Masjid Sudah Login',
        address: 'Jl. Login No. 1',
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
      },
      actor.id,
    );

    expect(result.newAccount).toBeUndefined();
    const [mosqueRow] = await db.select().from(mosques).where(eq(mosques.id, result.id));
    expect(mosqueRow?.createdBy).toBe(actor.id);
  });

  describe('checkForDuplicate', () => {
    it('flags a nearby mosque with a similar name', async () => {
      const timestamp = Date.now();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Duplicate Prov ${timestamp}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Duplicate City ${timestamp}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');

      await db.insert(mosques).values({
        name: 'Masjid Raya Baiturrahman',
        address: 'Jl. Masjid Raya No. 1',
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
        status: 'pending',
      });

      const candidates = await checkForDuplicate(db, {
        name: 'Masjid Raya Baiturahman',
        latitude: '5.5501000',
        longitude: '95.3200000',
      });

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0]?.name).toBe('Masjid Raya Baiturrahman');
      expect(candidates[0]?.distanceMeters).toBeLessThan(100);
    });

    it('returns an empty array when nothing is close enough or similar enough', async () => {
      const candidates = await checkForDuplicate(db, {
        name: 'Masjid Yang Sama Sekali Berbeda',
        latitude: '1.0000000',
        longitude: '1.0000000',
      });

      expect(candidates).toEqual([]);
    });

    it('flags an exact-coordinate duplicate without the acos() range error', async () => {
      const timestamp = Date.now();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Exact Dup Prov ${timestamp}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Exact Dup City ${timestamp}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');

      await db.insert(mosques).values({
        name: 'Masjid Exact Duplicate',
        address: 'Jl. Exact No. 1',
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
        status: 'pending',
      });

      const candidates = await checkForDuplicate(db, {
        name: 'Masjid Exact Duplicate',
        latitude: '5.5500000',
        longitude: '95.3200000',
      });

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0]?.name).toBe('Masjid Exact Duplicate');
      expect(candidates[0]?.distanceMeters).toBeCloseTo(0, 5);
    });
  });

  describe('approveMosque', () => {
    it('approves the mosque, assigns its submitter, and upgrades the submitter role', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Approval Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');

      const [city] = await db
        .insert(cities)
        .values({ name: `Approval City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');

      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Approval Submitter',
          email: `approval-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('user insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Approval Success',
          address: 'Jl. Approval No. 1',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );

      await expect(approveMosque(db, mosque.id, submitter.id)).resolves.toEqual({
        id: mosque.id,
        status: 'approved',
      });

      const [approvedMosque] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(approvedMosque?.status).toBe('approved');
      expect(approvedMosque?.adminUserId).toBe(submitter.id);
      expect(approvedMosque?.history).toHaveLength(2);

      const [updatedSubmitter] = await db.select().from(users).where(eq(users.id, submitter.id));
      expect(updatedSubmitter?.role).toBe('mosque_admin');
    });

    it('audits the submitter role change in user history and audit logs', async () => {
      const { actor, mosque, submitter } = await createModerationFixture('Role Audit');

      await approveMosque(db, mosque.id, actor.id);

      const [updatedSubmitter] = await db.select().from(users).where(eq(users.id, submitter.id));
      expect(updatedSubmitter?.role).toBe('mosque_admin');
      expect(updatedSubmitter?.history).toHaveLength(1);
      const userHistory = Array.isArray(updatedSubmitter?.history) ? updatedSubmitter.history : [];
      expect(userHistory[0]).toMatchObject({
        action: 'UPDATE',
        actorId: actor.id,
        changes: { role: { old: 'public_user', new: 'mosque_admin' } },
      });

      const userLogs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.recordId, submitter.id));
      expect(userLogs).toHaveLength(1);
      expect(userLogs[0]).toMatchObject({
        tableName: 'users',
        action: 'UPDATE',
        actorId: actor.id,
        oldData: { role: 'public_user' },
        newData: { role: 'mosque_admin' },
      });
    });

    it('approves for an existing mosque admin without writing or auditing the user', async () => {
      const { actor, mosque, submitter } = await createModerationFixture(
        'Existing Admin',
        'mosque_admin',
      );
      const originalModifiedAt = new Date('2025-01-02T03:04:05.000Z');
      const originalHistory = [{ source: 'existing-admin-fixture' }];
      await db
        .update(users)
        .set({ modifiedAt: originalModifiedAt, history: originalHistory })
        .where(eq(users.id, submitter.id));

      await expect(approveMosque(db, mosque.id, actor.id)).resolves.toEqual({
        id: mosque.id,
        status: 'approved',
      });

      const [unchangedSubmitter] = await db.select().from(users).where(eq(users.id, submitter.id));
      expect(unchangedSubmitter).toMatchObject({
        role: 'mosque_admin',
        modifiedAt: originalModifiedAt,
        history: originalHistory,
      });
      const userLogs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.recordId, submitter.id));
      expect(userLogs).toEqual([]);
    });

    it('rejects approval before writes when the mosque has no submitter', async () => {
      const { actor, mosque } = await createModerationFixture('Missing Submitter');
      await db.update(mosques).set({ createdBy: null }).where(eq(mosques.id, mosque.id));

      await expect(approveMosque(db, mosque.id, actor.id)).rejects.toMatchObject({
        statusCode: 422,
      });

      const [unchangedMosque] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(unchangedMosque).toMatchObject({
        status: 'pending',
        adminUserId: null,
      });
      expect(unchangedMosque?.history).toHaveLength(1);
      const mosqueLogs = await db.select().from(auditLogs).where(eq(auditLogs.recordId, mosque.id));
      expect(mosqueLogs).toHaveLength(1);
      expect(mosqueLogs[0]?.action).toBe('CREATE');
    });

    it('rejects approval before writes when the submitter is soft-deleted', async () => {
      const { actor, mosque, submitter } = await createModerationFixture('Deleted Submitter');
      await db
        .update(users)
        .set({ deletedAt: new Date('2026-01-02T03:04:05.000Z') })
        .where(eq(users.id, submitter.id));

      await expect(approveMosque(db, mosque.id, actor.id)).rejects.toMatchObject({
        statusCode: 422,
      });

      const [unchangedMosque] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(unchangedMosque).toMatchObject({
        status: 'pending',
        adminUserId: null,
      });
      expect(unchangedMosque?.history).toHaveLength(1);
      const mosqueLogs = await db.select().from(auditLogs).where(eq(auditLogs.recordId, mosque.id));
      expect(mosqueLogs).toHaveLength(1);
      expect(mosqueLogs[0]?.action).toBe('CREATE');
    });

    it('serializes concurrent approve and reject decisions into one consistent outcome', async () => {
      const { actor, mosque, submitter } = await createModerationFixture('Concurrent Decision');
      const blocker = await pool.connect();
      let lockReleased = false;
      let approval: Promise<{ id: string; status: 'approved' }> | undefined;
      let rejection: Promise<{ id: string; status: 'rejected' }> | undefined;

      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM mosques WHERE id = $1 FOR UPDATE', [mosque.id]);

        approval = approveMosque(db, mosque.id, actor.id);
        rejection = rejectMosque(db, mosque.id, actor.id);

        let blockedCount = 0;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const result = await pool.query<{ count: number }>(`
            SELECT count(*)::int AS count
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND wait_event_type = 'Lock'
              AND query LIKE '%mosques%'
          `);
          blockedCount = result.rows[0]?.count ?? 0;
          if (blockedCount >= 2) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(blockedCount).toBeGreaterThanOrEqual(2);

        await blocker.query('COMMIT');
        lockReleased = true;
        const results = await Promise.allSettled([approval, rejection]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        const failedDecision = results.find((result) => result.status === 'rejected');
        expect(failedDecision).toMatchObject({ reason: { statusCode: 409 } });

        const successfulDecision = results.find((result) => result.status === 'fulfilled');
        if (!successfulDecision || successfulDecision.status !== 'fulfilled') {
          throw new Error('one moderation decision should succeed');
        }

        const [finalMosque] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
        expect(finalMosque?.status).toBe(successfulDecision.value.status);
        expect(finalMosque?.history).toHaveLength(2);
        const mosqueHistory = Array.isArray(finalMosque?.history) ? finalMosque.history : [];
        expect(mosqueHistory.at(-1)).toMatchObject({
          changes: {
            status: { old: 'pending', new: finalMosque?.status },
          },
        });

        const mosqueLogs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.recordId, mosque.id));
        expect(mosqueLogs).toHaveLength(2);
        expect(mosqueLogs.find((log) => log.action === 'UPDATE')).toMatchObject({
          oldData: { status: 'pending' },
          newData: { status: finalMosque?.status },
          actorId: actor.id,
        });

        const [finalSubmitter] = await db.select().from(users).where(eq(users.id, submitter.id));
        const userLogs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.recordId, submitter.id));
        if (finalMosque?.status === 'approved') {
          expect(finalSubmitter?.role).toBe('mosque_admin');
          expect(userLogs).toHaveLength(1);
        } else {
          expect(finalSubmitter?.role).toBe('public_user');
          expect(userLogs).toEqual([]);
        }
      } finally {
        if (!lockReleased) {
          await blocker.query('ROLLBACK');
          await Promise.allSettled([approval, rejection].filter(Boolean));
        }
        blocker.release();
      }
    });

    it('rolls back mosque and submitter changes when the approval audit actor is invalid', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Rollback Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');

      const [city] = await db
        .insert(cities)
        .values({ name: `Rollback City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');

      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Rollback Submitter',
          email: `rollback-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('user insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Approval Rollback',
          address: 'Jl. Rollback No. 1',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );

      let approvalError: unknown;
      try {
        await approveMosque(db, mosque.id, randomUUID());
      } catch (error) {
        approvalError = error;
      }
      expect(approvalError).toMatchObject({
        cause: {
          code: '23503',
          constraint: 'audit_logs_actor_id_users_id_fk',
        },
      });

      const [unchangedMosque] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(unchangedMosque?.status).toBe('pending');
      expect(unchangedMosque?.adminUserId).toBeNull();
      expect(unchangedMosque?.history).toHaveLength(1);

      const [unchangedSubmitter] = await db.select().from(users).where(eq(users.id, submitter.id));
      expect(unchangedSubmitter?.role).toBe('public_user');
    });

    it('rejects approving a mosque that is not pending', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Repeat Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');

      const [city] = await db
        .insert(cities)
        .values({ name: `Repeat City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');

      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Repeat Submitter',
          email: `repeat-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('user insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Double Approval',
          address: 'Jl. Repeat No. 1',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );
      await approveMosque(db, mosque.id, submitter.id);

      await expect(approveMosque(db, mosque.id, submitter.id)).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('listPendingMosques', () => {
    it('returns only live pending mosques in oldest-first order', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Pending Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');

      const [city] = await db
        .insert(cities)
        .values({ name: `Pending City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');

      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Pending List Submitter',
          email: `pending-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('user insert failed');

      const input = {
        address: 'Jl. Pending No. 1',
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
      };
      const older = await createMosque(
        db,
        { ...input, name: `Masjid Pending Older ${unique}` },
        submitter.id,
      );
      const newer = await createMosque(
        db,
        { ...input, name: `Masjid Pending Newer ${unique}` },
        submitter.id,
      );
      const approved = await createMosque(
        db,
        { ...input, name: `Masjid Approved ${unique}` },
        submitter.id,
      );
      const deleted = await createMosque(
        db,
        { ...input, name: `Masjid Deleted ${unique}` },
        submitter.id,
      );

      const olderCreatedAt = new Date('2026-01-01T00:00:00.000Z');
      const newerCreatedAt = new Date('2026-01-02T00:00:00.000Z');
      await db.update(mosques).set({ createdAt: olderCreatedAt }).where(eq(mosques.id, older.id));
      await db.update(mosques).set({ createdAt: newerCreatedAt }).where(eq(mosques.id, newer.id));
      await db.update(mosques).set({ status: 'approved' }).where(eq(mosques.id, approved.id));
      await db.update(mosques).set({ deletedAt: new Date() }).where(eq(mosques.id, deleted.id));

      const fixtureIds = new Set([older.id, newer.id, approved.id, deleted.id]);
      const fixtureRows = (await listPendingMosques(db)).filter((row) => fixtureIds.has(row.id));

      expect(fixtureRows).toEqual([
        {
          id: older.id,
          name: `Masjid Pending Older ${unique}`,
          address: input.address,
          createdAt: olderCreatedAt,
          submittedBy: submitter.id,
        },
        {
          id: newer.id,
          name: `Masjid Pending Newer ${unique}`,
          address: input.address,
          createdAt: newerCreatedAt,
          submittedBy: submitter.id,
        },
      ]);
    });
  });

  describe('rejectMosque', () => {
    it('sets status to rejected without changing the submitter role and writes an audit entry', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Reject Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Reject City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');
      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Reject Submitter',
          email: `reject-submitter-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('submitter insert failed');
      const [actor] = await db
        .insert(users)
        .values({
          name: 'Reject Actor',
          email: `reject-actor-${unique}@example.test`,
          role: 'super_admin',
          provider: 'local',
        })
        .returning();
      if (!actor) throw new Error('actor insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Reject Test',
          address: 'Jl. Reject No. 1',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );

      await expect(rejectMosque(db, mosque.id, actor.id)).resolves.toEqual({
        id: mosque.id,
        status: 'rejected',
      });

      const [updatedMosque] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(updatedMosque?.status).toBe('rejected');
      expect(updatedMosque?.history).toHaveLength(2);
      const [updatedSubmitter] = await db.select().from(users).where(eq(users.id, submitter.id));
      expect(updatedSubmitter?.role).toBe('public_user');
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.recordId, mosque.id));
      expect(logs.at(-1)?.action).toBe('UPDATE');
      expect(logs.at(-1)?.actorId).toBe(actor.id);
    });

    it('rejects rejecting a mosque that is not pending', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Double Reject Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Double Reject City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');
      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Double Reject Submitter',
          email: `double-reject-submitter-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('submitter insert failed');
      const [actor] = await db
        .insert(users)
        .values({
          name: 'Double Reject Actor',
          email: `double-reject-actor-${unique}@example.test`,
          role: 'super_admin',
          provider: 'local',
        })
        .returning();
      if (!actor) throw new Error('actor insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Double Reject',
          address: 'Jl. Double Reject No. 1',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );
      await rejectMosque(db, mosque.id, actor.id);

      await expect(rejectMosque(db, mosque.id, actor.id)).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('updateApprovedMosque', () => {
    it('updates approved fields and audits only the changed fields', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Edit Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Edit City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');
      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Edit Submitter',
          email: `edit-submitter-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('submitter insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Edit Test',
          address: 'Jl. Lama',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );
      await approveMosque(db, mosque.id, submitter.id);

      await expect(
        updateApprovedMosque(
          db,
          mosque.id,
          { name: 'Masjid Edit Baru', address: 'Jl. Baru No. 2' },
          submitter.id,
        ),
      ).resolves.toEqual({ id: mosque.id });

      const [row] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(row?.name).toBe('Masjid Edit Baru');
      expect(row?.address).toBe('Jl. Baru No. 2');
      expect(row?.history).toHaveLength(3);
      expect((row?.history as Array<{ changes: Record<string, unknown> }>).at(-1)?.changes).toEqual(
        {
          name: { old: 'Masjid Edit Test', new: 'Masjid Edit Baru' },
          address: { old: 'Jl. Lama', new: 'Jl. Baru No. 2' },
        },
      );

      const logs = await db.select().from(auditLogs).where(eq(auditLogs.recordId, mosque.id));
      expect(logs.at(-1)).toMatchObject({
        action: 'UPDATE',
        actorId: submitter.id,
        oldData: { name: 'Masjid Edit Test', address: 'Jl. Lama' },
        newData: { name: 'Masjid Edit Baru', address: 'Jl. Baru No. 2' },
      });
    });

    it('updates fridayPrayerTime on an approved mosque', async () => {
      const timestamp = Date.now();
      const [province] = await db.insert(provinces).values({ name: `PrayerProv ${timestamp}` }).returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db.insert(cities).values({ name: `PrayerCity ${timestamp}`, provinceId: province.id }).returning();
      if (!city) throw new Error('city insert failed');
      const unique = randomUUID();
      const [actor] = await db
        .insert(users)
        .values({ name: 'Actor', email: `prayer-actor-${unique}@example.test`, role: 'super_admin', provider: 'local' })
        .returning();
      if (!actor) throw new Error('actor insert failed');
      const [mosque] = await db
        .insert(mosques)
        .values({
          name: 'Masjid Prayer Time',
          address: 'Jl. Prayer No. 1',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
          status: 'approved',
        })
        .returning();
      if (!mosque) throw new Error('mosque insert failed');

      await updateApprovedMosque(db, mosque.id, { fridayPrayerTime: '12:30' }, actor.id);

      const [updated] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(updated?.fridayPrayerTime).toBe('12:30');
    });

    it('omits unchanged fields from the audit log even when submitted', async () => {
      const { actor, mosque } = await createModerationFixture('Unchanged Field');
      await approveMosque(db, mosque.id, actor.id);

      await expect(
        updateApprovedMosque(
          db,
          mosque.id,
          { name: 'Unchanged Field Mosque', address: 'Changed Address' },
          actor.id,
        ),
      ).resolves.toEqual({ id: mosque.id });

      const [row] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect((row?.history as Array<{ changes: Record<string, unknown> }>).at(-1)?.changes).toEqual(
        {
          address: { old: 'Unchanged Field Address', new: 'Changed Address' },
        },
      );

      const logs = await db.select().from(auditLogs).where(eq(auditLogs.recordId, mosque.id));
      expect(logs.at(-1)).toMatchObject({
        action: 'UPDATE',
        actorId: actor.id,
        oldData: { address: 'Unchanged Field Address' },
        newData: { address: 'Changed Address' },
      });
    });

    it('rejects editing a mosque that is not approved yet with conflict', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Pending Edit Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Pending Edit City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');
      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Pending Edit Submitter',
          email: `pending-edit-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('submitter insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Still Pending',
          address: 'Jl. Pending Edit',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );

      await expect(
        updateApprovedMosque(db, mosque.id, { address: 'New Address' }, submitter.id),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('treats a soft-deleted mosque as not found', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Deleted Edit Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Deleted Edit City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');
      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Deleted Edit Submitter',
          email: `deleted-edit-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('submitter insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Deleted Edit',
          address: 'Jl. Deleted Edit',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );
      await approveMosque(db, mosque.id, submitter.id);
      await db.update(mosques).set({ deletedAt: new Date() }).where(eq(mosques.id, mosque.id));

      await expect(
        updateApprovedMosque(db, mosque.id, { address: 'Should Not Change' }, submitter.id),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('rolls back the field update when writing the audit entry fails', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Edit Rollback Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Edit Rollback City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');
      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Edit Rollback Submitter',
          email: `edit-rollback-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('submitter insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Edit Rollback',
          address: 'Jl. Original',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );
      await approveMosque(db, mosque.id, submitter.id);

      await expect(
        updateApprovedMosque(db, mosque.id, { address: 'Jl. Rolled Back' }, randomUUID()),
      ).rejects.toMatchObject({
        cause: { code: '23503', constraint: 'audit_logs_actor_id_users_id_fk' },
      });

      const [row] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(row?.address).toBe('Jl. Original');
      expect(row?.history).toHaveLength(2);
    });

    it('serializes concurrent edits so both field changes and history entries are preserved', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Concurrent Edit Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Concurrent Edit City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');
      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Concurrent Edit Submitter',
          email: `concurrent-edit-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('submitter insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Concurrent Edit',
          address: 'Jl. Concurrent Original',
          latitude: '5.5500000',
          longitude: '95.3200000',
          cityId: city.id,
          provinceId: province.id,
        },
        submitter.id,
      );
      await approveMosque(db, mosque.id, submitter.id);

      const blocker = await pool.connect();
      let lockReleased = false;
      let firstUpdate: Promise<{ id: string }> | undefined;
      let secondUpdate: Promise<{ id: string }> | undefined;

      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM mosques WHERE id = $1 FOR UPDATE', [mosque.id]);

        firstUpdate = updateApprovedMosque(
          db,
          mosque.id,
          { address: 'Jl. Concurrent Baru' },
          submitter.id,
        );
        secondUpdate = updateApprovedMosque(
          db,
          mosque.id,
          { name: 'Masjid Concurrent Baru' },
          submitter.id,
        );

        let blockedCount = 0;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const result = await pool.query<{ count: number }>(`
            SELECT count(*)::int AS count
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND wait_event_type = 'Lock'
              AND query LIKE '%mosques%'
          `);
          blockedCount = result.rows[0]?.count ?? 0;
          if (blockedCount >= 2) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(blockedCount).toBeGreaterThanOrEqual(2);

        await blocker.query('COMMIT');
        lockReleased = true;
        await Promise.all([firstUpdate, secondUpdate]);
      } finally {
        if (!lockReleased) {
          await blocker.query('ROLLBACK');
          await Promise.allSettled([firstUpdate, secondUpdate].filter(Boolean));
        }
        blocker.release();
      }

      const [row] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(row?.name).toBe('Masjid Concurrent Baru');
      expect(row?.address).toBe('Jl. Concurrent Baru');
      expect(row?.history).toHaveLength(4);

      const updateChanges = (
        row?.history as Array<{ action: string; changes: Record<string, unknown> }>
      )
        .filter((entry) => entry.action === 'UPDATE')
        .slice(-2)
        .map((entry) => entry.changes);
      expect(updateChanges).toEqual(
        expect.arrayContaining([
          { address: { old: 'Jl. Concurrent Original', new: 'Jl. Concurrent Baru' } },
          { name: { old: 'Masjid Concurrent Edit', new: 'Masjid Concurrent Baru' } },
        ]),
      );
    });
  });

  describe('listMySubmissions', () => {
    it('returns every live submission for the user, newest first, across all statuses', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `My Submissions Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `My Submissions City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');
      const [submitter] = await db
        .insert(users)
        .values({
          name: 'My Submissions User',
          email: `my-submissions-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('submitter insert failed');

      const input = {
        address: 'Jl. My Submissions',
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
      };
      const pending = await createMosque(
        db,
        { ...input, name: `Masjid Pending ${unique}` },
        submitter.id,
      );
      const approved = await createMosque(
        db,
        { ...input, name: `Masjid Approved ${unique}` },
        submitter.id,
      );
      const rejected = await createMosque(
        db,
        { ...input, name: `Masjid Rejected ${unique}` },
        submitter.id,
      );
      const deleted = await createMosque(
        db,
        { ...input, name: `Masjid Deleted ${unique}` },
        submitter.id,
      );
      await approveMosque(db, approved.id, submitter.id);
      await rejectMosque(db, rejected.id, submitter.id);

      const pendingCreatedAt = new Date('2026-02-01T00:00:00.000Z');
      const approvedCreatedAt = new Date('2026-02-02T00:00:00.000Z');
      const rejectedCreatedAt = new Date('2026-02-03T00:00:00.000Z');
      await db
        .update(mosques)
        .set({ createdAt: pendingCreatedAt })
        .where(eq(mosques.id, pending.id));
      await db
        .update(mosques)
        .set({ createdAt: approvedCreatedAt })
        .where(eq(mosques.id, approved.id));
      await db
        .update(mosques)
        .set({ createdAt: rejectedCreatedAt })
        .where(eq(mosques.id, rejected.id));
      await db.update(mosques).set({ deletedAt: new Date() }).where(eq(mosques.id, deleted.id));

      await expect(listMySubmissions(db, submitter.id)).resolves.toEqual([
        {
          id: rejected.id,
          name: `Masjid Rejected ${unique}`,
          status: 'rejected',
          createdAt: rejectedCreatedAt,
        },
        {
          id: approved.id,
          name: `Masjid Approved ${unique}`,
          status: 'approved',
          createdAt: approvedCreatedAt,
        },
        {
          id: pending.id,
          name: `Masjid Pending ${unique}`,
          status: 'pending',
          createdAt: pendingCreatedAt,
        },
      ]);
    });
  });
});
