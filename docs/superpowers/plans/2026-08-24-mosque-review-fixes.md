# Mosque Registration & Auth Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 7 issues found by the code review of commits `6110945` (`docs: add auth frontend implementation plan`) through `413c0d4` (`feat: implement mosque registration approval workflow`): two crash risks in mosque duplicate-checking, one audit-log integrity bug, one broken session-persistence UX bug, one missing DB index, and two simplification/robustness cleanups.

**Architecture:** Each fix is isolated to the file(s) the review flagged. No new subsystems. The two `acos()` crash risks share one root cause (unclamped haversine input) and are fixed together with one clamped SQL expression reused in both the app-level range validation and the duplicate-check query. The audit-log fix reuses the existing `buildHistoryEntry`-style diffing already present in `audit.service.ts`. The session-persistence fix adds one new endpoint (`GET /api/auth/me`) and rehydrates `useAuth`'s state from it on app start.

**Tech Stack:** Nuxt 4, Nitro server routes, Drizzle ORM (`node-postgres`), Zod, Vitest, PostgreSQL (`pg_trgm` extension).

**Spec:** `docs/superpowers/plans/2026-08-23-module-3-mosque-registration.md` (mosque registration/approval), `docs/superpowers/plans/2026-08-24-auth-frontend.md` (auth frontend). This plan is a bugfix pass on top of both, found via code review — no spec changes.

## Global Constraints

- Do not modify files under `server/**` for reasons unrelated to these 7 fixes — every `server/**` touch below is required by one of the fixes themselves.
- Store the auth token only in a `useCookie` (`TOKEN_COOKIE = 'auth_token'`), never `localStorage` — unchanged by this plan, but the new `/api/auth/me` call must keep using the existing `useAuthToken()` cookie/`Authorization: Bearer` pattern from `useApi`.
- Match existing code style: no comments except where the WHY is non-obvious (this codebase already follows that norm — see the JSDoc-style one-liners above each exported function in `mosque.service.ts` and `audit.service.ts`).
- Every DB-touching test in `mosque.service.test.ts` is gated by `describe.runIf(RUN_DB_TESTS)` where `RUN_DB_TESTS = Boolean(process.env.DATABASE_URL)` — new tests must follow this pattern and go in the same file/style (fresh `province`/`city`/`user` fixture rows per test, `randomUUID()` for uniqueness).
- Migrations live in `apps/web/drizzle/*.sql` following drizzle-kit's generated naming (`NNNN_<slug>.sql`); the next migration is `0004_<slug>.sql`.

---

### Task 1: Clamp the haversine distance expression so `acos()` never errors

**Files:**
- Modify: `apps/web/server/services/mosque.service.ts:121-127` (the `distanceExpr` inside `checkForDuplicate`)
- Test: `apps/web/server/services/mosque.service.test.ts` (add cases inside the existing `describe('checkForDuplicate', ...)` block, after the test at line 163)

**Interfaces:**
- Consumes: nothing new — `checkForDuplicate(db: Database, input: { name: string; latitude: string; longitude: string })` keeps its exact existing signature and return type `Promise<DuplicateCandidate[]>`.
- Produces: same `distanceExpr` name and shape (`sql<number>`), just numerically safe. No other task depends on this directly, but Task 2 (range validation) and this task together close the same crash class — Task 2 prevents garbage input from ever reaching this query, this task makes the query itself safe even for legitimate floating-point edge cases (e.g., an exact-duplicate coordinate match).

The bug: `cos(x)*cos(x)*cos(0) + sin(x)*sin(x)` should always be exactly `1.0` for `x == input`, but floating-point rounding can push it to `1.0000000000000002`. Postgres's `acos()` throws `ERROR: input is out of range` for any argument outside `[-1, 1]`. Fix by clamping the argument to `[-1, 1]` with `GREATEST`/`LEAST` before calling `acos()`.

- [ ] **Step 1: Write the failing test — exact-coordinate duplicate must not crash**

Add inside `describe('checkForDuplicate', ...)` in `apps/web/server/services/mosque.service.test.ts`, right after the existing `it('returns an empty array when nothing is close enough or similar enough', ...)` block (after line 173):

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails (or already errors) before the fix**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run server/services/mosque.service.test.ts -t "acos"`

Expected: FAIL — either the query throws `input is out of range` (if the rounding happens to land outside `[-1,1]` on this Postgres build), or it's not perfectly reproducible without the fix (floating-point edge cases can be environment-dependent). If it happens to pass without the fix, that's fine — proceed to the fix anyway since the bug is real and the test is the regression guard for it; move to Step 3.

- [ ] **Step 3: Apply the clamped expression**

In `apps/web/server/services/mosque.service.ts`, replace lines 121-127:

```typescript
  const distanceExpr = sql<number>`
    6371000 * acos(
      cos(radians(${input.latitude}::double precision)) * cos(radians(${mosques.latitude}::double precision)) *
      cos(radians(${mosques.longitude}::double precision) - radians(${input.longitude}::double precision)) +
      sin(radians(${input.latitude}::double precision)) * sin(radians(${mosques.latitude}::double precision))
    )
  `;
```

with:

```typescript
  const distanceExpr = sql<number>`
    6371000 * acos(
      GREATEST(-1, LEAST(1,
        cos(radians(${input.latitude}::double precision)) * cos(radians(${mosques.latitude}::double precision)) *
        cos(radians(${mosques.longitude}::double precision) - radians(${input.longitude}::double precision)) +
        sin(radians(${input.latitude}::double precision)) * sin(radians(${mosques.latitude}::double precision))
      ))
    )
  `;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run server/services/mosque.service.test.ts -t "checkForDuplicate"`

Expected: PASS — all `checkForDuplicate` tests, including the new exact-coordinate one, pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/services/mosque.service.ts apps/web/server/services/mosque.service.test.ts
git commit -m "fix: clamp haversine acos() argument to avoid out-of-range error on near-exact duplicates"
```

---

### Task 2: Reject out-of-range latitude/longitude at the validation layer

**Files:**
- Modify: `apps/web/server/utils/validation.ts:8-9,18-19` (`createMosqueSchema`, `updateMosqueSchema`)
- Test: `apps/web/server/utils/validation.test.ts` (new file — no existing test file for `validation.ts`; check first)

**Interfaces:**
- Consumes: nothing — pure Zod schema change.
- Produces: `createMosqueSchema` and `updateMosqueSchema` still validate to the same TypeScript shape (`z.infer` unchanged: `latitude`/`longitude` remain `string`), but now reject numerically out-of-range values at the API boundary before they ever reach `mosque.service.ts`. This is what makes Task 1's clamp a pure safety net rather than the only defense — legitimate garbage like `"999.0000000"` is now rejected with a 400 at the Zod layer, before `createMosque`/`checkForDuplicate` ever run.

The bug: `/^-?\d{1,3}\.\d{1,7}$/` validates format only. `"999.0000000"` matches the regex (3 integer digits) but is not a valid latitude (must be `-90..90`) or longitude (must be `-180..180`).

- [ ] **Step 1: Check for an existing validation test file**

Run: `ls apps/web/server/utils/validation.test.ts 2>/dev/null || echo "no existing file"`

If it exists, read it first and add to it instead of creating a new file with duplicate setup. Assume for the remaining steps it does not exist (per the current repo state).

- [ ] **Step 2: Write the failing test**

Create `apps/web/server/utils/validation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { createMosqueSchema, updateMosqueSchema } from './validation';

const validBase = {
  name: 'Masjid Test',
  address: 'Jl. Test No. 1',
  cityId: '11111111-1111-1111-1111-111111111111',
  provinceId: '22222222-2222-2222-2222-222222222222',
};

describe('createMosqueSchema', () => {
  it('accepts valid latitude and longitude', () => {
    const result = createMosqueSchema.safeParse({
      ...validBase,
      latitude: '5.5500000',
      longitude: '95.3200000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts boundary latitude and longitude values', () => {
    const result = createMosqueSchema.safeParse({
      ...validBase,
      latitude: '-90.0000000',
      longitude: '180.0000000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a latitude outside -90..90', () => {
    const result = createMosqueSchema.safeParse({
      ...validBase,
      latitude: '999.0000000',
      longitude: '95.3200000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a longitude outside -180..180', () => {
    const result = createMosqueSchema.safeParse({
      ...validBase,
      latitude: '5.5500000',
      longitude: '999.0000000',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateMosqueSchema', () => {
  it('rejects an out-of-range latitude when provided', () => {
    const result = updateMosqueSchema.safeParse({ latitude: '-999.0000000' });
    expect(result.success).toBe(false);
  });

  it('accepts a partial update with only a valid longitude', () => {
    const result = updateMosqueSchema.safeParse({ longitude: '95.3200000' });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run server/utils/validation.test.ts`

Expected: FAIL on the two "rejects" tests (`999.0000000` currently passes the regex).

- [ ] **Step 4: Add range-checked schemas**

In `apps/web/server/utils/validation.ts`, add two new schema pieces above `createMosqueSchema` and reuse them in both schemas. Replace the full file content:

```typescript
import { type ZodType, z } from 'zod';

export const uuidSchema = z.string().uuid();

const latitudeSchema = z
  .string()
  .regex(/^-?\d{1,3}\.\d{1,7}$/)
  .refine((value) => {
    const parsed = Number.parseFloat(value);
    return parsed >= -90 && parsed <= 90;
  }, 'latitude must be between -90 and 90');

const longitudeSchema = z
  .string()
  .regex(/^-?\d{1,3}\.\d{1,7}$/)
  .refine((value) => {
    const parsed = Number.parseFloat(value);
    return parsed >= -180 && parsed <= 180;
  }, 'longitude must be between -180 and 180');

export const createMosqueSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  cityId: uuidSchema,
  provinceId: uuidSchema,
});

export const updateMosqueSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().min(1).max(500).optional(),
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export async function parseBody<T>(event: Parameters<typeof readBody>[0], schema: ZodType<T>) {
  return await readValidatedBody(event, (body) => schema.parse(body));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run server/utils/validation.test.ts`

Expected: PASS — all 6 tests pass.

- [ ] **Step 6: Run the full test suite to check nothing else broke**

Run: `cd apps/web && pnpm vitest run server/utils`

Expected: PASS — including any pre-existing `auth.test.ts` in the same directory, unaffected by this change.

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/utils/validation.ts apps/web/server/utils/validation.test.ts
git commit -m "fix: reject geographically out-of-range latitude/longitude in mosque schemas"
```

---

### Task 3: Diff `updateApprovedMosque`'s audit_logs entry instead of writing the raw payload

**Files:**
- Modify: `apps/web/server/services/mosque.service.ts:280-302` (`updateApprovedMosque`)
- Modify: `apps/web/server/services/mosque.service.test.ts:775-781` (existing assertion currently expects the raw-payload behavior — must be updated to expect the diffed behavior)

**Interfaces:**
- Consumes: `withAudit` from `./audit.service` — unchanged signature, already imported.
- Produces: `updateApprovedMosque(db, mosqueId, updates, actorId): Promise<{ id: string }>` — signature and return type unchanged. Only the `oldData`/`newData` passed internally to `withAudit` changes, so `audit_logs` and `mosques.history` agree on what actually changed.

The bug: `oldData`/`newData` are built from every key in `updates`, even when the submitted value equals the current value. `mosque.history` (via `buildHistoryEntry` in `audit.service.ts`, called inside `withAudit`) already does the real diff and correctly omits unchanged fields — but the separate `audit_logs` row this function assembles bypasses that and just mirrors the raw payload. Fix: only include a key in `oldData`/`newData` if the submitted value actually differs from the current row's value (mirroring the same `JSON.stringify` comparison `buildHistoryEntry` uses for its `UPDATE` branch, so both records agree byte-for-byte).

- [ ] **Step 1: Update the existing test to assert the new (correct) behavior**

The existing test `it('updates approved fields and audits only the changed fields', ...)` (lines 718-782) already submits two fields that both genuinely change (`name` and `address`), so its current assertions at lines 775-781 remain valid as-is — no change needed there. Instead, add a new test case immediately after it (after line 782, before the next `it(...)` at line 784) that covers a field submitted with its *unchanged* value:

```typescript
    it('omits unchanged fields from the audit_logs entry even when submitted', async () => {
      const unique = randomUUID();
      const [province] = await db
        .insert(provinces)
        .values({ name: `Unchanged Field Province ${unique}` })
        .returning();
      if (!province) throw new Error('province insert failed');
      const [city] = await db
        .insert(cities)
        .values({ name: `Unchanged Field City ${unique}`, provinceId: province.id })
        .returning();
      if (!city) throw new Error('city insert failed');
      const [submitter] = await db
        .insert(users)
        .values({
          name: 'Unchanged Field Submitter',
          email: `unchanged-field-${unique}@example.test`,
          role: 'public_user',
          provider: 'local',
        })
        .returning();
      if (!submitter) throw new Error('submitter insert failed');

      const mosque = await createMosque(
        db,
        {
          name: 'Masjid Unchanged Field',
          address: 'Jl. Sama',
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
          { name: 'Masjid Unchanged Field', address: 'Jl. Beda' },
          submitter.id,
        ),
      ).resolves.toEqual({ id: mosque.id });

      const [row] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
      expect(
        (row?.history as Array<{ changes: Record<string, unknown> }>).at(-1)?.changes,
      ).toEqual({
        address: { old: 'Jl. Sama', new: 'Jl. Beda' },
      });

      const logs = await db.select().from(auditLogs).where(eq(auditLogs.recordId, mosque.id));
      expect(logs.at(-1)).toMatchObject({
        action: 'UPDATE',
        actorId: submitter.id,
        oldData: { address: 'Jl. Sama' },
        newData: { address: 'Jl. Beda' },
      });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run server/services/mosque.service.test.ts -t "omits unchanged fields"`

Expected: FAIL — `logs.at(-1)` currently has `oldData: { name: 'Masjid Unchanged Field', address: 'Jl. Sama' }` and `newData: { name: 'Masjid Unchanged Field', address: 'Jl. Beda' }`, including the unchanged `name` key.

- [ ] **Step 3: Fix `updateApprovedMosque` to diff before building `oldData`/`newData`**

In `apps/web/server/services/mosque.service.ts`, replace lines 285-291:

```typescript
    const oldData = Object.fromEntries(
      (Object.keys(updates) as Array<keyof UpdateApprovedMosqueInput>).map((key) => [
        key,
        mosque[key],
      ]),
    );
    const newData: Record<string, unknown> = { ...updates };
```

with:

```typescript
    const changedKeys = (Object.keys(updates) as Array<keyof UpdateApprovedMosqueInput>).filter(
      (key) => JSON.stringify(mosque[key]) !== JSON.stringify(updates[key]),
    );
    const oldData = Object.fromEntries(changedKeys.map((key) => [key, mosque[key]]));
    const newData = Object.fromEntries(changedKeys.map((key) => [key, updates[key]]));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run server/services/mosque.service.test.ts -t "updateApprovedMosque"`

Expected: PASS — all `updateApprovedMosque` tests, including the pre-existing ones (lines 718-1020), pass unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/services/mosque.service.ts apps/web/server/services/mosque.service.test.ts
git commit -m "fix: diff updateApprovedMosque's audit_logs entry to match mosque.history"
```

---

### Task 4: Add a GIN trigram index and a geo index to back `checkForDuplicate`

**Files:**
- Create: `apps/web/drizzle/0004_mosque_duplicate_indexes.sql`
- Modify: `apps/web/drizzle/schema.ts` (add matching index declarations so drizzle-kit's schema stays in sync with the DB — check the file first for the exact `mosques` table export shape before editing)

**Interfaces:**
- Consumes: nothing — pure DDL, no TypeScript interface changes to any exported function.
- Produces: two indexes that Postgres's query planner can use for `checkForDuplicate`'s `WHERE` clause (`similarity(...) > threshold` and the distance filter). No task depends on this directly.

The bug: `checkForDuplicate` runs `similarity(mosques.name, input.name) > 0.4` and a haversine distance filter on every `POST /mosques`, with no index — every call is a full sequential scan over all non-deleted mosques.

- [ ] **Step 1: Inspect the current schema file for the `mosques` table definition**

Run: `grep -n "pgTable\|mosques\s*=" apps/web/drizzle/schema.ts | head -20`

Read the surrounding `mosques` table definition (likely via `Read apps/web/drizzle/schema.ts`) to find its exact column names (`latitude`, `longitude`, `name`) and how indexes are declared elsewhere in the file (drizzle-orm `pgTable(..., (table) => ({ ... }))` third-argument callback, or a separate `index()`/`uniqueIndex()` call) — match that existing pattern exactly rather than inventing a new style.

- [ ] **Step 2: Write the migration SQL**

Create `apps/web/drizzle/0004_mosque_duplicate_indexes.sql`:

```sql
CREATE INDEX IF NOT EXISTS mosques_name_trgm_idx ON mosques USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS mosques_lat_lng_idx ON mosques (latitude, longitude) WHERE deleted_at IS NULL;
```

Notes:
- `gin_trgm_ops` requires the `pg_trgm` extension, already enabled by `0003_fuzzy_mosque_duplicates.sql` — no new `CREATE EXTENSION` needed.
- The lat/lng btree index is a coarse pre-filter (Postgres can use it to prune rows before evaluating the haversine expression in the `WHERE` clause) — it is not a true geospatial index (that would require PostGIS, out of scope here), but it meaningfully narrows the sequential scan for reasonably-sized datasets. The partial `WHERE deleted_at IS NULL` clause matches `checkForDuplicate`'s own `isNull(mosques.deletedAt)` filter so the index stays small and directly usable.

- [ ] **Step 3: Add matching index declarations to `drizzle/schema.ts`**

Follow whatever pattern Step 1 found. If the codebase uses the third-argument callback style, it will look like:

```typescript
export const mosques = pgTable(
  'mosques',
  {
    // ...existing columns, unchanged...
  },
  (table) => ({
    // ...any existing indexes/constraints, unchanged...
    nameTrgmIdx: index('mosques_name_trgm_idx').using('gin', sql`${table.name} gin_trgm_ops`),
    latLngIdx: index('mosques_lat_lng_idx')
      .on(table.latitude, table.longitude)
      .where(sql`${table.deletedAt} IS NULL`),
  }),
);
```

Adjust import statements (`index`, `sql`) at the top of `schema.ts` if not already imported. If the file instead declares indexes as separate top-level exports, mirror that style instead — the goal is drizzle-kit's `schema.ts` accurately describing what the SQL migration creates, not a specific syntax.

- [ ] **Step 4: Verify the migration applies cleanly against a local database**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm db:migrate`

Expected: the two new indexes are created with no errors. Then run `pnpm db:generate` and confirm it produces no new migration file (schema.ts and the SQL migration agree — no drift).

- [ ] **Step 5: Confirm existing `checkForDuplicate` tests still pass**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run server/services/mosque.service.test.ts -t "checkForDuplicate"`

Expected: PASS — behavior is unchanged, only the query plan improves.

- [ ] **Step 6: Commit**

```bash
git add apps/web/drizzle/0004_mosque_duplicate_indexes.sql apps/web/drizzle/schema.ts
git commit -m "perf: add trigram and lat/lng indexes to back mosque duplicate checks"
```

---

### Task 5: Extract the shared pending-mosque lock/guard used by approve, reject, and update

**Files:**
- Modify: `apps/web/server/services/mosque.service.ts:170-306` (`approveMosque`, `rejectMosque`, `updateApprovedMosque`)
- Test: `apps/web/server/services/mosque.service.test.ts` — no new tests needed; existing tests for all three functions (lines 176-517, 602-715, 717-1020) already cover the guard behavior and must continue passing unchanged, since this is a pure refactor with no behavior change.

**Interfaces:**
- Consumes: nothing new.
- Produces: a new private helper `lockPendingOrApprovedMosque` (not exported — internal to this file only, since nothing outside `mosque.service.ts` calls the individual guard blocks). `approveMosque`, `rejectMosque`, `updateApprovedMosque` keep their exact existing exported signatures and return types — this task changes only their internals.

The issue: `approveMosque` (lines 176-181), `rejectMosque` (lines 224-229), and `updateApprovedMosque` (lines 263-268) each run the identical `select ... for('update')` + not-found + status-check pattern, differing only in which status they require (`'pending'` for the first two, `'approved'` for the third) and the error message. Extract one shared helper.

- [ ] **Step 1: Add the shared helper above `approveMosque`**

In `apps/web/server/services/mosque.service.ts`, insert this function directly above `approveMosque` (before line 170, after the `listPendingMosques` function ends at line 164):

```typescript
/**
 * Locks one live mosque row for update and asserts its status. Shared by
 * approveMosque, rejectMosque, and updateApprovedMosque so the three
 * status-transition guards can't drift out of sync with each other.
 */
async function lockRequiredStatusMosque(
  tx: Parameters<Database['transaction']>[0] extends (tx: infer T) => unknown ? T : never,
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
```

- [ ] **Step 2: Use the helper in `approveMosque`**

Replace lines 176-191 (the `select`/`for('update')` block through the `createdBy` check) with:

```typescript
    const mosque = await lockRequiredStatusMosque(
      tx,
      mosqueId,
      'pending',
      'Mosque is not pending approval',
    );
    if (!mosque.createdBy) {
      throw createError({ statusCode: 422, statusMessage: 'Mosque has no submitter to promote' });
    }
```

- [ ] **Step 3: Use the helper in `rejectMosque`**

Replace lines 224-236 (the `select`/`for('update')` block through the status check) with:

```typescript
    const mosque = await lockRequiredStatusMosque(
      tx,
      mosqueId,
      'pending',
      'Mosque is not pending approval',
    );
```

- [ ] **Step 4: Use the helper in `updateApprovedMosque`**

Replace lines 263-278 (the `select`/`for('update')` block through the status check) with:

```typescript
    const mosque = await lockRequiredStatusMosque(
      tx,
      mosqueId,
      'approved',
      'Mosque must be approved before editing',
    );
```

- [ ] **Step 5: Run the full mosque service test suite**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run server/services/mosque.service.test.ts`

Expected: PASS — every existing test for `approveMosque`, `rejectMosque`, and `updateApprovedMosque` (including the concurrency tests at lines 329-412 and 916-1019, which depend on the `for('update')` row lock still being taken at the same point in each transaction) passes unchanged, since behavior is identical.

- [ ] **Step 6: Run TypeScript type-checking**

Run: `cd apps/web && pnpm typecheck` (or `pnpm tsc --noEmit` — check `package.json` for the exact script name)

Expected: no new type errors. If the `tx` parameter type on `lockRequiredStatusMosque` doesn't infer cleanly from `Parameters<Database['transaction']>[0] extends (tx: infer T) => unknown ? T : never`, fall back to importing `Transaction` from `./audit.service` (already used elsewhere in this file's imports) and typing the parameter as `Transaction` directly — verify which one compiles and use that.

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/services/mosque.service.ts
git commit -m "refactor: extract shared row-lock/status-guard helper for mosque moderation actions"
```

---

### Task 6: Add `GET /api/auth/me` and rehydrate `useAuth`'s user state on load

**Files:**
- Create: `apps/web/server/api/auth/me.get.ts`
- Modify: `apps/web/server/services/user.service.ts` (add `findUserById`)
- Modify: `apps/web/composables/useAuth.ts`
- Test: `apps/web/server/services/user.service.test.ts` (new file — check first if one exists)
- Test: `apps/web/server/api/auth/me.get.test.ts` — skip; this codebase has no existing tests for `.get.ts`/`.post.ts` route handlers (only services and utils are unit-tested per the `vitest.config.ts` include pattern and the existing `server/api/auth/*` files having no sibling `.test.ts`). Cover the route indirectly through manual verification in Step 6 instead.

**Interfaces:**
- Consumes: `verifyAuthToken` from `../services/token` (already used in `server/utils/auth.ts`), `requireAuth` from `../utils/auth.ts`.
- Produces: `findUserById(db: Database, id: string): Promise<AuthUser | null>` in `user.service.ts`, reusing the existing `AuthUser` interface already exported there (line 12-17). `GET /api/auth/me` returns `AuthUser` (the same shape login/callback already return as `user`) or throws 401. `useAuth()` gains an `init()` function that callers can invoke once on app start to rehydrate `user.value` from the token cookie when a token exists but `user` is `null` — the return signature grows from `{ user, isAuthenticated, setSession, login, loginWithGoogle, logout }` to `{ user, isAuthenticated, setSession, login, loginWithGoogle, logout, init }`.

The bug: `isAuthenticated = computed(() => Boolean(token.value && user.value))`. `token` persists across reloads (cookie), but `user` is a `useState` that resets to `null` on every fresh page load / new tab. Nothing currently repopulates `user` from `token`, so a logged-in user with a valid token cookie shows as logged out until they log in again.

- [ ] **Step 1: Add `findUserById` to `user.service.ts`**

In `apps/web/server/services/user.service.ts`, add this function after `findUserByEmail` (after line 34):

```typescript
/** Looks up a live user by id, regardless of auth provider. Used by GET /api/auth/me. */
export async function findUserById(db: Database, id: string): Promise<AuthUser | null> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  return { id: found.id, name: found.name, email: found.email, role: found.role };
}
```

- [ ] **Step 2: Write the failing test for `findUserById`**

Check first: `ls apps/web/server/services/user.service.test.ts 2>/dev/null || echo "no existing file"`. Assuming it does not exist, create `apps/web/server/services/user.service.test.ts`:

```typescript
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { users } from '../../drizzle/schema';
import { findUserById } from './user.service';

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('findUserById', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  it('returns the user shape for a live user', async () => {
    const unique = randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        name: 'Find By Id User',
        email: `find-by-id-${unique}@example.test`,
        role: 'public_user',
        provider: 'local',
      })
      .returning();
    if (!user) throw new Error('user insert failed');

    await expect(findUserById(db, user.id)).resolves.toEqual({
      id: user.id,
      name: 'Find By Id User',
      email: `find-by-id-${unique}@example.test`,
      role: 'public_user',
    });
  });

  it('returns null for a soft-deleted user', async () => {
    const unique = randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        name: 'Deleted User',
        email: `deleted-${unique}@example.test`,
        role: 'public_user',
        provider: 'local',
      })
      .returning();
    if (!user) throw new Error('user insert failed');
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));

    await expect(findUserById(db, user.id)).resolves.toBeNull();
  });

  it('returns null for a nonexistent id', async () => {
    await expect(findUserById(db, randomUUID())).resolves.toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run server/services/user.service.test.ts`

Expected: FAIL with `findUserById is not a function` (or a TypeScript import error) before Step 1's export exists — since Step 1 already added it above, this should instead FAIL only if Step 1 was skipped. If Step 1 was done first as written, skip straight to Step 4's verification instead of expecting a failure here.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run server/services/user.service.test.ts`

Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Add the `GET /api/auth/me` route**

Create `apps/web/server/api/auth/me.get.ts`:

```typescript
import { requireAuth } from '../../utils/auth';
import { findUserById } from '../../services/user.service';

export default defineEventHandler(async (event) => {
  const payload = await requireAuth(event);

  const user = await findUserById(useDatabase(), payload.sub);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'User no longer exists' });
  }

  return user;
});
```

- [ ] **Step 6: Manually verify the new route**

Run the dev server: `cd apps/web && pnpm dev`

In a separate terminal, log in to get a token, then call `/api/auth/me`:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<a seeded local user email>","password":"<its password>"}' | jq -r .token)

curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN" | jq
```

Expected: JSON response `{ "id": "...", "name": "...", "email": "...", "role": "..." }` matching the logged-in user. Then verify the 401 path: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/auth/me` (no header) should print `401`.

- [ ] **Step 7: Add `init()` to `useAuth` and call it once on app start**

Replace the full content of `apps/web/composables/useAuth.ts`:

```typescript
// apps/web/composables/useAuth.ts
import type { AuthResponse, AuthUser } from '~/lib/auth-types';

const TOKEN_COOKIE = 'auth_token';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, matches server/services/token.ts TOKEN_LIFETIME

/** The bearer token cookie. Exported separately so useApi can read it without pulling in user state. */
export function useAuthToken() {
  return useCookie<string | null>(TOKEN_COOKIE, {
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE,
    default: () => null,
  });
}

export function useAuth() {
  const token = useAuthToken();
  const user = useState<AuthUser | null>('auth-user', () => null);
  const isAuthenticated = computed(() => Boolean(token.value && user.value));

  function setSession(auth: AuthResponse) {
    token.value = auth.token;
    user.value = auth.user;
  }

  async function login(email: string, password: string) {
    const auth = await $fetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setSession(auth);
  }

  function loginWithGoogle() {
    window.location.href = '/api/auth/google';
  }

  function logout() {
    token.value = null;
    user.value = null;
  }

  /**
   * Rehydrates `user` from the token cookie. Needed because `user` is
   * in-memory `useState` that resets on every reload/new tab while `token`
   * persists as a cookie — without this, a valid session shows as logged out
   * until the next explicit login. Safe to call multiple times; no-ops once
   * `user` is already populated or there's no token to rehydrate from.
   */
  async function init() {
    if (user.value || !token.value) return;

    try {
      user.value = await $fetch<AuthUser>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token.value}` },
      });
    } catch {
      token.value = null;
      user.value = null;
    }
  }

  return { user, isAuthenticated, setSession, login, loginWithGoogle, logout, init };
}
```

- [ ] **Step 8: Call `init()` once on app start**

Check first for an existing app-wide plugin or root layout: `ls apps/web/plugins/ 2>/dev/null; ls apps/web/app.vue 2>/dev/null`

If `apps/web/plugins/` exists, create `apps/web/plugins/auth.client.ts`:

```typescript
// apps/web/plugins/auth.client.ts
export default defineNuxtPlugin(async () => {
  const { init } = useAuth();
  await init();
});
```

The `.client.ts` suffix is required — `useAuthToken`'s cookie is readable during SSR, but calling `$fetch('/api/auth/me', ...)` on every SSR request duplicates the round trip the client will make anyway; running this client-only keeps it to one rehydration per page load. If no `plugins/` directory exists yet, create it with this one file — Nuxt auto-registers everything under `plugins/`.

- [ ] **Step 9: Manually verify session persistence across reload**

With the dev server running (`pnpm dev`), open the app in a browser, log in via the login page, confirm `AppHeader` shows the logged-in state (not the guest "Masuk" button). Then hard-reload the page (Cmd/Ctrl+Shift+R). Expected: `AppHeader` still shows the logged-in state after reload — the bug this task fixes. Then open dev tools, delete the `auth_token` cookie, reload again — expected: `AppHeader` shows the guest state (confirms `init()`'s catch branch clears stale/invalid sessions correctly).

- [ ] **Step 10: Run the full test suite**

Run: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run`

Expected: PASS — all existing and new tests pass.

- [ ] **Step 11: Commit**

```bash
git add apps/web/server/api/auth/me.get.ts apps/web/server/services/user.service.ts apps/web/server/services/user.service.test.ts apps/web/composables/useAuth.ts apps/web/plugins/auth.client.ts
git commit -m "fix: rehydrate useAuth session from token cookie on app start via GET /api/auth/me"
```

---

### Task 7: Make `useApi`'s Authorization header reactive to token changes

**Files:**
- Modify: `apps/web/composables/useApi.ts`

**Interfaces:**
- Consumes: `useAuthToken` from `useAuth.ts` (unchanged).
- Produces: `useApi<T>(url, opts?)` keeps its exact existing exported signature and return type (`ReturnType<typeof useFetch<T>>`) — only the internal `headers` construction changes from a plain object to a reactive getter, so a later `refresh()`/refetch picks up the current token value instead of the one captured at first call.

The bug: `headers: { ...(token.value ? { Authorization: ... } : {}) } }` is evaluated once, synchronously, when `useApi()` is called — not on each request `useFetch` makes internally (e.g. via its returned `refresh()`). `useFetch`'s `headers` option accepts a function/computed for exactly this reason.

- [ ] **Step 1: Fix `useApi.ts` to derive headers reactively**

Replace the full content of `apps/web/composables/useApi.ts`:

```typescript
// apps/web/composables/useApi.ts
import type { UseFetchOptions } from '#app';

/** useFetch wrapper that attaches the bearer token cookie, if present, to every request. */
export function useApi<T>(
  url: string | (() => string),
  opts?: UseFetchOptions<T>,
) {
  const token = useAuthToken();

  return useFetch(url, {
    ...opts,
    headers: computed(() => ({
      ...(opts?.headers as Record<string, string> | undefined),
      ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
    })),
  });
}
```

- [ ] **Step 2: Manually verify with a real call site**

There are no call sites of `useApi` yet in this codebase (confirmed via the review — it's dead code as of this diff), so there's no existing page to click through. Instead, verify by temporarily wiring it into one read-only page that needs auth (check `docs/superpowers/plans/2026-08-24-auth-frontend.md` for which page was planned to use it first, e.g. a profile or dashboard page) and confirming in browser dev tools' Network tab that the `Authorization` header is present on the initial request, then log out and log back in without a full page reload (if such a flow exists) and confirm a manually-triggered `refresh()` picks up the new token. If no such page exists yet in this branch, skip the live verification and rely on the type-check in Step 3 plus the documented reasoning above — do not build a throwaway page just for this check.

- [ ] **Step 3: Run TypeScript type-checking**

Run: `cd apps/web && pnpm typecheck` (or the project's equivalent script)

Expected: no new type errors — `useFetch`'s `headers` option type accepts a `Ref`/`ComputedRef` of a headers object, matching Nuxt's documented reactive-options support.

- [ ] **Step 4: Commit**

```bash
git add apps/web/composables/useApi.ts
git commit -m "fix: derive useApi's Authorization header reactively so token changes are picked up on refetch"
```

---

## Post-plan verification

- [ ] Run the full test suite once more end to end: `cd apps/web && DATABASE_URL=<your local test db url> pnpm vitest run`
- [ ] Run `pnpm typecheck` and `pnpm lint` (or whatever the project's configured scripts are — check `package.json`) to confirm no regressions across all 7 fixes together.
- [ ] Re-read the original review findings and confirm each of the 7 is addressed: #1 (Task 2), #2 (Task 1), #3 (Task 3), #4 (Task 6), #5 (Task 4), #6 (Task 5), #7 (Task 7).
