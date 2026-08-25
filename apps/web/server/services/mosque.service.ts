import { and, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../../drizzle/schema';
import { mosques, users } from '../../drizzle/schema';
import { withAudit } from './audit.service';
import type { Transaction } from './audit.service';
import { hashPassword } from './password';
import { findUserByEmail, upgradeToMosqueAdmin } from './user.service';

export type Database = NodePgDatabase<typeof schema>;

export interface CreateMosqueInput {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  cityId: string;
  provinceId: string;
  submitterName?: string;
  email?: string;
  password?: string;
}

export interface CreatedMosque {
  id: string;
  name: string;
  status: 'pending';
  newAccount?: { id: string; name: string; email: string; role: 'public_user' };
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  address: string;
  distanceMeters: number;
  nameSimilarity: number;
}

export interface PendingMosqueSummary {
  id: string;
  name: string;
  address: string;
  createdAt: Date;
  submittedBy: string | null;
}

export interface ApprovedMosque {
  id: string;
  status: 'approved';
}

export interface RejectedMosque {
  id: string;
  status: 'rejected';
}

export interface UpdateApprovedMosqueInput {
  name?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
}

export interface MySubmission {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

const DUPLICATE_DISTANCE_METERS = 100;
const DUPLICATE_NAME_SIMILARITY_THRESHOLD = 0.4;
const METERS_PER_DEGREE_LATITUDE = 111_320;

/**
 * Registers a mosque in `pending` status. Approval, rejection, and
 * ownership assignment are handled elsewhere (Module 3) — this only
 * covers the initial submission and its audit trail.
 */
export async function createMosque(
  db: Database,
  input: CreateMosqueInput,
  actorId: string | null,
): Promise<CreatedMosque> {
  return await db.transaction(async (tx) => {
    let createdBy = actorId;
    let newAccount: CreatedMosque['newAccount'];

    if (createdBy === null) {
      if (!input.submitterName || !input.email || !input.password) {
        throw createError({
          statusCode: 422,
          statusMessage: 'submitterName, email, and password are required to register without an account',
        });
      }

      const existing = await findUserByEmail(tx, input.email);
      if (existing) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Email sudah terdaftar. Masuk ke akun Anda lalu ajukan pendaftaran masjid dari sana.',
        });
      }

      const passwordHash = await hashPassword(input.password);
      const [insertedUser] = await tx
        .insert(users)
        .values({
          name: input.submitterName,
          email: input.email,
          passwordHash,
          provider: 'local',
          role: 'public_user',
        })
        .returning();
      if (!insertedUser) throw new Error('Failed to create submitter account');

      createdBy = insertedUser.id;
      newAccount = {
        id: insertedUser.id,
        name: insertedUser.name,
        email: insertedUser.email,
        role: 'public_user',
      };
    }

    const [inserted] = await tx
      .insert(mosques)
      .values({
        name: input.name,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        cityId: input.cityId,
        provinceId: input.provinceId,
        status: 'pending',
        createdBy,
      })
      .returning();

    if (!inserted) throw new Error('Failed to create mosque');

    await withAudit(tx, {
      table: mosques,
      tableName: 'mosques',
      recordId: inserted.id,
      action: 'CREATE',
      actorId: createdBy,
      oldData: null,
      newData: { name: inserted.name, address: inserted.address, status: inserted.status },
      currentHistory: inserted.history as unknown[],
    });

    return { id: inserted.id, name: inserted.name, status: 'pending', newAccount };
  });
}

/**
 * Flags mosques within 100m whose name is a fuzzy match (trigram
 * similarity via pg_trgm). Includes any status, not just approved — a
 * second pending submission for the same physical mosque is exactly the
 * case this exists to catch. Returns a warning list; never blocks submit.
 */
export async function checkForDuplicate(
  db: Database,
  input: { name: string; latitude: string; longitude: string },
): Promise<DuplicateCandidate[]> {
  const latitude = Number.parseFloat(input.latitude);
  const longitude = Number.parseFloat(input.longitude);
  const latitudeDelta = DUPLICATE_DISTANCE_METERS / METERS_PER_DEGREE_LATITUDE;
  const longitudeDelta = Math.min(
    180,
    DUPLICATE_DISTANCE_METERS /
      (METERS_PER_DEGREE_LATITUDE *
        Math.max(Math.abs(Math.cos((latitude * Math.PI) / 180)), 1e-12)),
  );
  const latitudeBounds = and(
    gte(mosques.latitude, String(Math.max(-90, latitude - latitudeDelta))),
    lte(mosques.latitude, String(Math.min(90, latitude + latitudeDelta))),
  );
  const longitudeMin = longitude - longitudeDelta;
  const longitudeMax = longitude + longitudeDelta;
  const longitudeBounds =
    longitudeDelta === 180
      ? undefined
      : longitudeMin < -180
        ? or(
            lte(mosques.longitude, String(longitudeMax)),
            gte(mosques.longitude, String(longitudeMin + 360)),
          )
        : longitudeMax > 180
          ? or(
              gte(mosques.longitude, String(longitudeMin)),
              lte(mosques.longitude, String(longitudeMax - 360)),
            )
          : and(
              gte(mosques.longitude, String(longitudeMin)),
              lte(mosques.longitude, String(longitudeMax)),
            );
  const distanceExpr = sql<number>`
    6371000 * acos(
      GREATEST(-1, LEAST(1,
        cos(radians(${input.latitude}::double precision)) * cos(radians(${mosques.latitude}::double precision)) *
        cos(radians(${mosques.longitude}::double precision) - radians(${input.longitude}::double precision)) +
        sin(radians(${input.latitude}::double precision)) * sin(radians(${mosques.latitude}::double precision))
      ))
    )
  `;
  const similarityExpr = sql<number>`similarity(${mosques.name}, ${input.name})`;

  const rows = await db
    .select({
      id: mosques.id,
      name: mosques.name,
      address: mosques.address,
      distanceMeters: distanceExpr,
      nameSimilarity: similarityExpr,
    })
    .from(mosques)
    .where(
      and(
        isNull(mosques.deletedAt),
        latitudeBounds,
        longitudeBounds,
        sql`${distanceExpr} < ${DUPLICATE_DISTANCE_METERS}`,
        sql`${mosques.name} % ${input.name}`,
        sql`${similarityExpr} > ${DUPLICATE_NAME_SIMILARITY_THRESHOLD}`,
      ),
    )
    .orderBy(sql`${similarityExpr} DESC`);

  return rows;
}

/** Returns live pending registrations, oldest submission first. */
export async function listPendingMosques(db: Database): Promise<PendingMosqueSummary[]> {
  return await db
    .select({
      id: mosques.id,
      name: mosques.name,
      address: mosques.address,
      createdAt: mosques.createdAt,
      submittedBy: mosques.createdBy,
    })
    .from(mosques)
    .where(and(eq(mosques.status, 'pending'), isNull(mosques.deletedAt)))
    .orderBy(mosques.createdAt);
}

async function lockRequiredStatusMosque(
  tx: Transaction,
  mosqueId: string,
  requiredStatus: 'pending' | 'approved',
  wrongStatusMessage: string,
) {
  const [mosque] = await tx
    .select()
    .from(mosques)
    .where(and(eq(mosques.id, mosqueId), isNull(mosques.deletedAt)))
    .limit(1)
    .for('update');

  if (!mosque) {
    throw createError({ statusCode: 404, statusMessage: 'Mosque not found' });
  }
  if (mosque.status !== requiredStatus) {
    throw createError({ statusCode: 409, statusMessage: wrongStatusMessage });
  }

  return mosque;
}

/**
 * Approves one pending mosque and promotes only its submitter. The mosque,
 * user role, row history, and audit log are committed or rolled back together.
 */
export async function approveMosque(
  db: Database,
  mosqueId: string,
  actorId: string,
): Promise<ApprovedMosque> {
  return await db.transaction(async (tx) => {
    const mosque = await lockRequiredStatusMosque(
      tx,
      mosqueId,
      'pending',
      'Mosque is not pending approval',
    );
    if (!mosque.createdBy) {
      throw createError({ statusCode: 422, statusMessage: 'Mosque has no submitter to promote' });
    }

    const submitterId = mosque.createdBy;

    await upgradeToMosqueAdmin(tx, submitterId, actorId);

    await tx
      .update(mosques)
      .set({ status: 'approved', adminUserId: submitterId })
      .where(eq(mosques.id, mosqueId));

    await withAudit(tx, {
      table: mosques,
      tableName: 'mosques',
      recordId: mosqueId,
      action: 'UPDATE',
      actorId,
      oldData: { status: mosque.status, adminUserId: mosque.adminUserId },
      newData: { status: 'approved', adminUserId: submitterId },
      currentHistory: mosque.history as unknown[],
    });

    return { id: mosqueId, status: 'approved' };
  });
}

/** Rejects one pending mosque while leaving its submitter unchanged. */
export async function rejectMosque(
  db: Database,
  mosqueId: string,
  actorId: string,
): Promise<RejectedMosque> {
  return await db.transaction(async (tx) => {
    const mosque = await lockRequiredStatusMosque(
      tx,
      mosqueId,
      'pending',
      'Mosque is not pending approval',
    );

    await tx.update(mosques).set({ status: 'rejected' }).where(eq(mosques.id, mosqueId));

    await withAudit(tx, {
      table: mosques,
      tableName: 'mosques',
      recordId: mosqueId,
      action: 'UPDATE',
      actorId,
      oldData: { status: mosque.status },
      newData: { status: 'rejected' },
      currentHistory: mosque.history as unknown[],
    });

    return { id: mosqueId, status: 'rejected' };
  });
}

/** Updates editable fields on a live approved mosque and audits the exact changed field set. */
export async function updateApprovedMosque(
  db: Database,
  mosqueId: string,
  updates: UpdateApprovedMosqueInput,
  actorId: string,
): Promise<{ id: string }> {
  return await db.transaction(async (tx) => {
    const mosque = await lockRequiredStatusMosque(
      tx,
      mosqueId,
      'approved',
      'Mosque must be approved before editing',
    );

    await tx
      .update(mosques)
      .set(updates)
      .where(and(eq(mosques.id, mosqueId), isNull(mosques.deletedAt)));

    const changedKeys = (Object.keys(updates) as Array<keyof UpdateApprovedMosqueInput>).filter(
      (key) => JSON.stringify(mosque[key]) !== JSON.stringify(updates[key]),
    );
    const oldData = Object.fromEntries(changedKeys.map((key) => [key, mosque[key]]));
    const newData = Object.fromEntries(changedKeys.map((key) => [key, updates[key]]));

    await withAudit(tx, {
      table: mosques,
      tableName: 'mosques',
      recordId: mosqueId,
      action: 'UPDATE',
      actorId,
      oldData,
      newData,
      currentHistory: mosque.history as unknown[],
    });

    return { id: mosqueId };
  });
}

/** Returns all live registrations submitted by one user, newest first. */
export async function listMySubmissions(db: Database, userId: string): Promise<MySubmission[]> {
  return await db
    .select({
      id: mosques.id,
      name: mosques.name,
      status: mosques.status,
      createdAt: mosques.createdAt,
    })
    .from(mosques)
    .where(and(eq(mosques.createdBy, userId), isNull(mosques.deletedAt)))
    .orderBy(sql`${mosques.createdAt} DESC`);
}
