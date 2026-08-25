import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  decimal,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('UserRole', ['super_admin', 'mosque_admin', 'public_user']);
export const mosqueStatus = pgEnum('MosqueStatus', ['pending', 'approved', 'rejected']);
export const auditAction = pgEnum('AuditAction', ['CREATE', 'UPDATE', 'DELETE']);
export const authProvider = pgEnum('AuthProvider', ['local', 'google']);

const createAuditColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  modifiedAt: timestamp('modified_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
  modifiedBy: uuid('modified_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
  active: boolean('active').generatedAlwaysAs(sql`("deleted_at" IS NULL)`),
  history: jsonb('history')
    .notNull()
    .default(sql`'[]'::jsonb`),
});

export const provinces = pgTable('provinces', {
  ...createAuditColumns(),
  name: text('name').notNull().unique(),
});

export const cities = pgTable(
  'cities',
  {
    ...createAuditColumns(),
    provinceId: uuid('province_id')
      .notNull()
      .references(() => provinces.id),
    name: text('name').notNull(),
  },
  (table) => [unique('cities_province_name_key').on(table.provinceId, table.name)],
);

export const mukims = pgTable('mukims', {
  ...createAuditColumns(),
  cityId: uuid('city_id')
    .notNull()
    .references(() => cities.id),
  name: text('name').notNull(),
});

export const users = pgTable(
  'users',
  {
    ...createAuditColumns(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    // Users who sign in with Google do not have a local password.
    passwordHash: text('password_hash'),
    provider: authProvider('provider').notNull().default('local'),
    // OAuth subject identifier; null for local accounts.
    providerId: text('provider_id'),
    role: userRole('role').notNull().default('public_user'),
  },
  (table) => [unique('users_provider_key').on(table.provider, table.providerId)],
);

export const mosques = pgTable(
  'mosques',
  {
    ...createAuditColumns(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id),
    provinceId: uuid('province_id')
      .notNull()
      .references(() => provinces.id),
    mukimId: uuid('mukim_id').references(() => mukims.id),
    status: mosqueStatus('status').notNull().default('pending'),
    adminUserId: uuid('admin_user_id').references(() => users.id),
    photoUrl: text('photo_url'),
    fridayPrayerTime: text('friday_prayer_time'),
  },
  (table) => [
    index('mosques_name_trgm_idx')
      .using('gin', sql`${table.name} gin_trgm_ops`)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const people = pgTable('people', {
  ...createAuditColumns(),
  mosqueId: uuid('mosque_id')
    .notNull()
    .references(() => mosques.id),
  name: text('name').notNull(),
  phone: text('phone'),
});

export const fridayAssignments = pgTable(
  'friday_assignments',
  {
    ...createAuditColumns(),
    mosqueId: uuid('mosque_id')
      .notNull()
      .references(() => mosques.id),
    assignmentDate: date('assignment_date').notNull(),
    khatibPersonId: uuid('khatib_person_id').references(() => people.id),
    imamPersonId: uuid('imam_person_id').references(() => people.id),
    muazzinPersonId: uuid('muazzin_person_id').references(() => people.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    unique('friday_assignments_mosque_date_key').on(table.mosqueId, table.assignmentDate),
  ],
);

export const auditLogs = pgTable('audit_logs', {
  ...createAuditColumns(),
  tableName: text('table_name').notNull(),
  recordId: uuid('record_id').notNull(),
  action: auditAction('action').notNull(),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  actorId: uuid('actor_id').references(() => users.id),
});
