# Module 7: Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the audit utility that Modules 3, 5, and 6 call on every CREATE/UPDATE/DELETE — it appends a diff entry to a row's own `history` JSONB column and writes a matching row to the central `audit_logs` table, in the same transaction as the business write.

**Architecture:** This is not a route module — it exposes no `server/api/` endpoints. It is a single service, `server/services/audit.service.ts`, with three pure-ish helper functions (`buildHistoryEntry`, `withAudit`) that any other service imports and calls inside its own Drizzle transaction. `withAudit` takes the transaction handle, the table, the action, the actor, and old/new row data; it appends to `history` and inserts into `audit_logs` in one round trip per call. Diffing is a plain object key-comparison — no external diff library.

**Tech Stack:** Nuxt 4 / Nitro, TypeScript (strict), Drizzle ORM + PostgreSQL, Vitest 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-23-module-7-audit-log.md` (module-specific contract). Also implements §3.7 of the shared `docs/superpowers/specs/2026-08-23-baituna-modules-design.md`. Background: `docs/baituna-erd.md` §6.0 (base audit fields, `history`, `AuditLog` entity).

## Global Constraints

These apply to every task. Copied from the spec, the ERD, and the repo's existing conventions.

- **Application layer, not a Postgres trigger.** ERD §6.0 offers both; the spec (§3.7) picks application layer because diff logic is easier to write and test in TypeScript. Accept the stated trade-off: raw queries that bypass the service layer are not audited.
- **Every audited write happens inside a transaction.** The business-table write and the audit write (both `history` append and `audit_logs` insert) must commit or roll back together. `withAudit` receives an already-open transaction handle — it never opens its own.
- **`history` is append-only.** Never replace or truncate it; always read the current array and push one new entry.
- **Soft delete everywhere.** A DELETE action in this system is `UPDATE ... SET deleted_at = now()`, never an actual `DELETE FROM`. The audit action for it is `'DELETE'`, but the underlying SQL is an update. Queries that read live data must filter `isNull(table.deletedAt)`. The `active` column is a generated column — never write to it.
- **Never write business logic in route handlers.** This module has no route handlers, but the services that consume it (Modules 3, 5, 6) must call `withAudit` from their own service files, not from `server/api/`.
- **TypeScript is strict.** No `any`. No non-null assertions (`!`) on values that can genuinely be null.
- **Commit messages follow Conventional Commits** (`feat:`, `test:`, `chore:`, `docs:`) — commitlint + husky enforce this on commit.
- **Every command in this plan runs from `apps/web/`** unless stated otherwise.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/server/services/audit.service.ts` | Diff builder + `withAudit` transactional helper | 1, 2 |
| `apps/web/server/services/audit.service.test.ts` | Tests for the above | 1, 2 |
| `apps/web/server/services/mosque.service.ts` | Worked example: `createMosque` calls `withAudit` | 3 |
| `apps/web/server/services/mosque.service.test.ts` | Tests for the above | 3 |
| `apps/web/server/services/README.md` | Document the audit contract for Modules 3/5/6 authors | 3 |

**Why the worked example lives in `mosque.service.ts`:** that file already exists as an empty reserved stub (`server/services/mosque.service.ts`, currently `export const mosqueService = {};`) and Module 3 (Mosque Registration) is the next consumer in the build order. Writing one real call site here, rather than leaving `withAudit` untested by a real caller, is the only way to prove the transactional contract actually works end to end — a unit test that mocks the transaction can't catch a real Drizzle transaction-typing mistake. Task 3 replaces the stub's placeholder export with a single real function; it does not attempt the rest of Module 3.

---

### Task 1: Diff builder

`history` entries need a consistent shape. This task builds the pure function that computes one diff entry from old/new row data, with no database access, so it's fast to test exhaustively.

**Files:**
- Create: `apps/web/server/services/audit.service.ts`
- Test: `apps/web/server/services/audit.service.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AuditAction` — re-exported type alias for `'CREATE' | 'UPDATE' | 'DELETE'` (matches the `auditAction` pgEnum in `drizzle/schema.ts`)
  - `HistoryEntry` — `{ action: AuditAction; actorId: string | null; at: string; changes: Record<string, { old: unknown; new: unknown }> }`
  - `buildHistoryEntry(action: AuditAction, actorId: string | null, oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): HistoryEntry`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/server/services/audit.service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { buildHistoryEntry } from './audit.service';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- audit.service` (from `apps/web/`)
Expected: FAIL — `audit.service.ts` does not exist yet (module not found).

- [ ] **Step 3: Implement the diff builder**

Create `apps/web/server/services/audit.service.ts`:

```typescript
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface HistoryEntry {
  action: AuditAction;
  actorId: string | null;
  at: string;
  changes: Record<string, { old: unknown; new: unknown }>;
}

/**
 * Computes one append-only history entry from a row's old and new state.
 * CREATE treats every field in `newData` as changed from null; DELETE treats
 * every field in `oldData` as changed to null; UPDATE compares key by key
 * and includes only fields whose value actually differs.
 */
export function buildHistoryEntry(
  action: AuditAction,
  actorId: string | null,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): HistoryEntry {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (action === 'CREATE' && newData) {
    for (const key of Object.keys(newData)) {
      changes[key] = { old: null, new: newData[key] };
    }
  } else if (action === 'DELETE' && oldData) {
    for (const key of Object.keys(oldData)) {
      changes[key] = { old: oldData[key], new: null };
    }
  } else if (action === 'UPDATE' && oldData && newData) {
    const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    for (const key of keys) {
      const oldValue = oldData[key];
      const newValue = newData[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { old: oldValue, new: newValue };
      }
    }
  }

  return { action, actorId, at: new Date().toISOString(), changes };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- audit.service` (from `apps/web/`)
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/services/audit.service.ts apps/web/server/services/audit.service.test.ts
git commit -m "feat: add audit history diff builder"
```

---

### Task 2: Transactional `withAudit` helper

This task adds the function that other services actually call: it writes the row's own `history` column and the central `audit_logs` table, both inside the caller's transaction.

**Files:**
- Modify: `apps/web/server/services/audit.service.ts`
- Test: `apps/web/server/services/audit.service.test.ts`

**Interfaces:**
- Consumes: `buildHistoryEntry` (Task 1), `auditLogs` table and `PgTable` types from `drizzle/schema.ts`.
- Produces:
  - `AuditableTable` — a type alias constraining which Drizzle tables `withAudit` accepts (must have `id` and `history` columns; every table built with `createAuditColumns()` qualifies)
  - `withAudit<T extends AuditableTable>(tx: Transaction, params: { table: T; recordId: string; action: AuditAction; actorId: string | null; oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null; currentHistory: unknown[] }): Promise<void>` — appends one entry to `table.history` for `recordId`, and inserts one row into `audit_logs`. Does not update any other column.
  - `Transaction` — exported type alias for the type Drizzle passes into a `db.transaction(async (tx) => ...)` callback, so calling services can type their own transaction parameter without re-deriving it.

Design note on `currentHistory`: `withAudit` does not read the row's current `history` itself — the caller already has the row in hand (it just created, updated, or is about to soft-delete it) and passes the array it read. This keeps `withAudit` from issuing an extra `SELECT` per call and keeps the "what was the row's state" decision with the caller, who already knows it.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/server/services/audit.service.test.ts` (new `describe` block, same file):

```typescript
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../drizzle/schema';
import { auditLogs, provinces } from '../../drizzle/schema';
import { withAudit } from './audit.service';

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('withAudit', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  it('appends to history and inserts an audit_logs row in one transaction', async () => {
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(provinces)
        .values({ name: `Test Province ${Date.now()}` })
        .returning();
      if (!inserted) throw new Error('insert failed');

      await withAudit(tx, {
        table: provinces,
        recordId: inserted.id,
        action: 'CREATE',
        actorId: null,
        oldData: null,
        newData: { name: inserted.name },
        currentHistory: inserted.history as unknown[],
      });

      const [row] = await tx.select().from(provinces).where(eq(provinces.id, inserted.id));
      expect(Array.isArray(row?.history)).toBe(true);
      expect((row?.history as unknown[]).length).toBe(1);

      const logs = await tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.recordId, inserted.id));
      expect(logs).toHaveLength(1);
      expect(logs[0]?.tableName).toBe('provinces');
      expect(logs[0]?.action).toBe('CREATE');

      // Roll back so the test leaves no data behind.
      tx.rollback();
    }).catch((error) => {
      if (!(error instanceof Error && error.message === 'Rollback')) throw error;
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail (or skip cleanly without a DB)**

Run: `npm test -- audit.service` (from `apps/web/`)
Expected: without `DATABASE_URL` set, the new `describe.runIf` block is skipped and the 5 Task 1 tests still pass. With `DATABASE_URL` set to a real dev Postgres, the new test FAILS — `withAudit` is not exported yet.

- [ ] **Step 3: Implement `withAudit`**

Extend `apps/web/server/services/audit.service.ts`:

```typescript
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTable, PgTransaction } from 'drizzle-orm/pg-core';

import type * as schema from '../../drizzle/schema';
import { auditLogs } from '../../drizzle/schema';

export type Transaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>['transaction']>[0]
>[0];

export type AuditableTable = PgTable & {
  id: { name: string };
  history: { name: string };
};

export interface WithAuditParams<T extends AuditableTable> {
  table: T;
  recordId: string;
  action: AuditAction;
  actorId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  currentHistory: unknown[];
}

/**
 * Appends one entry to the row's own `history` column and inserts a matching
 * row into `audit_logs`, both through the caller's open transaction. Must be
 * called from inside the same `db.transaction()` block as the business write
 * it is auditing — see `mosque.service.ts` `createMosque` for the pattern.
 */
export async function withAudit<T extends AuditableTable>(
  tx: Transaction,
  params: WithAuditParams<T>,
): Promise<void> {
  const entry = buildHistoryEntry(params.action, params.actorId, params.oldData, params.newData);
  const nextHistory = [...params.currentHistory, entry];

  await tx
    .update(params.table)
    .set({ history: nextHistory } as never)
    .where(eq(params.table.id as never, params.recordId));

  await tx.insert(auditLogs).values({
    tableName: getTableName(params.table),
    recordId: params.recordId,
    action: params.action,
    oldData: params.oldData,
    newData: params.newData,
    actorId: params.actorId,
  });
}

function getTableName(table: PgTable): string {
  return sql`${table}`.queryChunks
    .map((chunk) => (typeof chunk === 'object' && 'value' in chunk ? chunk.value : ''))
    .join('');
}
```

Note on `getTableName`: Drizzle does not expose a public, typed API to read a table's SQL name back off a `PgTable` reference in v0.45. Rather than rely on that internal detail, replace the function body with the simpler and fully typed approach below, and pass the name explicitly from the call site instead — update the interface accordingly:

```typescript
export interface WithAuditParams<T extends AuditableTable> {
  table: T;
  tableName: string;
  recordId: string;
  action: AuditAction;
  actorId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  currentHistory: unknown[];
}
```

And in `withAudit`, use `params.tableName` directly in the `auditLogs` insert, deleting the `getTableName` helper entirely. This is the version to actually ship — it avoids depending on any Drizzle internal. Update the Task 2 test's call site to pass `tableName: 'provinces'`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- audit.service` (from `apps/web/`)
Expected: PASS. If `DATABASE_URL` is unset, the DB-backed test is skipped and the 5 pure tests pass — that's a valid pass for this step in an environment with no local Postgres. If `DATABASE_URL` is set, all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/services/audit.service.ts apps/web/server/services/audit.service.test.ts
git commit -m "feat: add withAudit transactional helper"
```

---

### Task 3: Worked example — `createMosque` calls `withAudit`

Proves the contract works from a real caller, and gives Module 3's implementer a concrete pattern to copy instead of inferring one from the audit service alone.

**Files:**
- Modify: `apps/web/server/services/mosque.service.ts` (replace the `export const mosqueService = {};` stub)
- Test: `apps/web/server/services/mosque.service.test.ts`
- Modify: `apps/web/server/services/README.md`

**Interfaces:**
- Consumes: `withAudit`, `Transaction`, `AuditAction` (Task 2), `useDatabase` (`server/utils/database.ts`), `mosques` table (`drizzle/schema.ts`).
- Produces:
  - `CreateMosqueInput` — `{ name: string; address: string; latitude: string; longitude: string; cityId: string; provinceId: string }`
  - `createMosque(db: Database, input: CreateMosqueInput, actorId: string): Promise<{ id: string; name: string; status: 'pending' }>` — inserts a `pending` mosque and its audit entry in one transaction. This is the only piece of Module 3 (Mosque Registration) this plan implements; the rest (approval, rejection, my-submissions, duplicate check) is Module 3's own plan.

This task intentionally does not implement duplicate detection, `PATCH /mosques/:id/approve`, or the `POST /mosques` route handler — those belong to Module 3's plan. `createMosque` exists here only as the audit-service proof.

- [ ] **Step 1: Write the failing test**

Create `apps/web/server/services/mosque.service.test.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { auditLogs, cities, mosques, provinces } from '../../drizzle/schema';
import { createMosque } from './mosque.service';

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('createMosque', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  it('inserts a pending mosque and writes one audit entry', async () => {
    const [province] = await db
      .insert(provinces)
      .values({ name: `Prov ${Date.now()}` })
      .returning();
    if (!province) throw new Error('province insert failed');

    const [city] = await db
      .insert(cities)
      .values({ name: `City ${Date.now()}`, provinceId: province.id })
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
      'actor-1',
    );

    expect(result.status).toBe('pending');

    const [row] = await db.select().from(mosques).where(eq(mosques.id, result.id));
    expect(row?.status).toBe('pending');
    expect((row?.history as unknown[]).length).toBe(1);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.recordId, result.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe('CREATE');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- mosque.service` (from `apps/web/`)
Expected: without `DATABASE_URL`, the test is skipped (no failure). With `DATABASE_URL` set, FAIL — `createMosque` is not exported yet.

- [ ] **Step 3: Implement `createMosque`**

Replace the contents of `apps/web/server/services/mosque.service.ts`:

```typescript
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../../drizzle/schema';
import { mosques } from '../../drizzle/schema';
import { withAudit } from './audit.service';

export type Database = NodePgDatabase<typeof schema>;

export interface CreateMosqueInput {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  cityId: string;
  provinceId: string;
}

export interface CreatedMosque {
  id: string;
  name: string;
  status: 'pending';
}

/**
 * Registers a mosque in `pending` status. Approval, rejection, and
 * ownership assignment are handled elsewhere (Module 3) — this only
 * covers the initial submission and its audit trail.
 */
export async function createMosque(
  db: Database,
  input: CreateMosqueInput,
  actorId: string,
): Promise<CreatedMosque> {
  return await db.transaction(async (tx) => {
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
        createdBy: actorId,
      })
      .returning();

    if (!inserted) throw new Error('Failed to create mosque');

    await withAudit(tx, {
      table: mosques,
      tableName: 'mosques',
      recordId: inserted.id,
      action: 'CREATE',
      actorId,
      oldData: null,
      newData: { name: inserted.name, address: inserted.address, status: inserted.status },
      currentHistory: inserted.history as unknown[],
    });

    return { id: inserted.id, name: inserted.name, status: 'pending' };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- mosque.service` (from `apps/web/`)
Expected: PASS (or skipped without `DATABASE_URL`, same as Task 2).

- [ ] **Step 5: Document the contract for Module 3/5/6 authors**

Add a new section to `apps/web/server/services/README.md`, after the existing "Module 1 — Auth & RBAC" section:

```markdown
## Module 7 — Audit Log

`audit.service.ts` is not a route module. It exposes `withAudit`, called
from inside another service's own `db.transaction()` block, right after
the business write it audits:

```typescript
await db.transaction(async (tx) => {
  const [inserted] = await tx.insert(someTable).values({ ... }).returning();
  if (!inserted) throw new Error('...');

  await withAudit(tx, {
    table: someTable,
    tableName: 'some_table_name', // must match the Postgres table name
    recordId: inserted.id,
    action: 'CREATE', // or 'UPDATE' / 'DELETE'
    actorId,           // the caller's user id, or null for system writes
    oldData: null,      // the row's prior field values, or null on CREATE
    newData: { ... },   // only the fields relevant to this change
    currentHistory: inserted.history as unknown[],
  });

  return inserted;
});
```

Rules:

- `DELETE` in this system is always a soft delete (`UPDATE ... SET
  deleted_at = now()`), never `DELETE FROM`. Pass `action: 'DELETE'` and
  `newData: null` for it, matching `createMosque` in `mosque.service.ts`
  for the `CREATE` shape.
- `oldData`/`newData` don't need every column — only the fields worth
  showing in a history diff (skip audit columns like `modifiedAt`).
- Raw queries that bypass a service never get audited. This is an
  accepted trade-off (ERD §6.0), not a bug to work around.

See `mosque.service.ts` `createMosque` for a complete worked example.
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/services/mosque.service.ts apps/web/server/services/mosque.service.test.ts apps/web/server/services/README.md
git commit -m "feat: wire withAudit into mosque creation as a worked example"
```

---

## Self-Review Notes

- **Spec coverage:** §3.7 requires (a) application-layer implementation — Task 2's `withAudit` runs in TS, no trigger; (b) fills `history` JSONB per row — Task 2; (c) writes to `audit_logs` — Task 2; (d) callable by Modules 3/5/6 on CREATE/UPDATE/DELETE — Task 3 proves the CREATE path end to end, and the README documents UPDATE/DELETE usage for those modules' own plans to follow.
- **Placeholder scan:** no TBD/TODO; every step has real, runnable code.
- **Type consistency:** `AuditAction` (Task 1) matches the `auditAction` pgEnum values in `drizzle/schema.ts` exactly (`'CREATE' | 'UPDATE' | 'DELETE'`). `withAudit`'s `WithAuditParams` in Task 2 is revised mid-task (the `getTableName` helper is dropped in favor of an explicit `tableName` field) — Task 3's test and implementation already use the revised shape, not the initial draft, so there is no drift between tasks.
- **DB-dependent tests:** all transactional tests use `describe.runIf(Boolean(process.env.DATABASE_URL))` so `npm test` still passes in an environment with no Postgres running, consistent with how Module 1's plan only unit-tested pure functions. When a dev database is available, set `DATABASE_URL` before running `npm test` to exercise these too.
