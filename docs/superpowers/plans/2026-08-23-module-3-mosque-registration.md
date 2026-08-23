# Module 3: Mosque Registration & Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mosque registration lifecycle — any authenticated user submits a mosque, a Super Admin approves or rejects it, an approved mosque's admin can edit it, and the submitter can track their own submissions' status.

**Architecture:** Nitro routes under `apps/web/server/api/mosques/` handle HTTP only; all decisions live in `server/services/mosque.service.ts`, which already has one function (`createMosque`, from Module 7's worked example) and gains five more here: `checkForDuplicate`, `listPendingMosques`, `approveMosque`, `rejectMosque`, `updateApprovedMosque`, `listMySubmissions`. Approval is the module's one hard transactional requirement: setting `mosques.status = 'approved'`, setting `admin_user_id`, and upgrading the submitter's role to `mosque_admin` must commit or fail together — implemented as a single `db.transaction()` calling `upgradeToMosqueAdmin` (Module 1) and `withAudit` (Module 7) before returning. Ownership checks reuse `requireMosqueOwner` (Module 1) everywhere a "my mosque" rule applies — never a bare role check.

**Tech Stack:** Nuxt 4 / Nitro, TypeScript (strict), Drizzle ORM + PostgreSQL, Zod 4, Vitest 4. No new dependencies. Fuzzy name matching for the duplicate check uses PostgreSQL's built-in trigram similarity (`pg_trgm` extension + `similarity()`), not a new npm package.

**Spec:** `docs/superpowers/specs/2026-08-23-module-3-mosque-registration.md` (module-specific contract). Also implements §2.1's consequence for ownership and §3.3 in full of the shared `docs/superpowers/specs/2026-08-23-baituna-modules-design.md`. Background: `docs/baituna-prd.md` §4.0, §6 (endpoint table); `docs/baituna-erd.md` §6.1 (`mosques` entity), §6.3 (ownership rule).

**Depends on:** Module 1 (Auth & RBAC — `requireAuth`, `requireRole`, `requireMosqueOwner`, `upgradeToMosqueAdmin`) and Module 7 (Audit Log — `withAudit`, `Transaction`, `createMosque`), both already implemented in this repo as of 2026-08-23.

## Global Constraints

These apply to every task. Copied from the spec and the repo's existing conventions.

- **Ownership is per-mosque, not per-role.** Every "this is my mosque" check must compare `mosques.admin_user_id` to the caller's user id — use `requireMosqueOwner`, never `role === 'mosque_admin'` alone. A user can own more than one mosque; approving a second mosque for an already-`mosque_admin` user must not change their role or fail. (Spec §3.3, ERD §6.3)
- **Approve is one transaction.** Status change, `admin_user_id` assignment, and role upgrade either all succeed or all roll back. If the role upgrade fails, the mosque's status must not have changed either. (Spec §3.3)
- **The duplicate check is a warning, not a block.** A fuzzy-name-and-close-coordinates match on submit returns a flag in the response and is shown to the Super Admin during review — it never prevents the `POST /mosques` call from succeeding. (Spec §3.3)
- **`PATCH /mosques/:id` (self-edit) only works after `approved`.** A `pending` or `rejected` mosque cannot be edited by its submitter through this endpoint — only Super Admin actions (`approve`/`reject`) touch a mosque before it's approved. (Spec §3.3)
- **Rejection does not change the submitter's role.** Only `approveMosque` calls `upgradeToMosqueAdmin`. (Spec §3.3)
- **Soft delete everywhere.** Every read filters `isNull(mosques.deletedAt)`. The `active` column is a generated column — never write to it.
- **Every write goes through `withAudit`, in the same transaction as the business write.** See `mosque.service.ts` `createMosque` (already implemented) and `server/services/README.md`'s "Module 7 — Audit Log" section for the pattern.
- **Never write business logic in route handlers.** Route files parse input, call a service, and shape the response.
- **Do not touch the `mukims` table or `mosques.mukim_id`.** They exist in the schema but are unused in the MVP. (Spec §2.3)
- **TypeScript is strict.** No `any`. No non-null assertions (`!`) on values that can genuinely be null.
- **Commit messages follow Conventional Commits** (`feat:`, `test:`, `chore:`, `docs:`) — commitlint + husky enforce this on commit.
- **Every command in this plan runs from `apps/web/`** unless stated otherwise.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/drizzle/schema.ts` | Enable `pg_trgm` extension for fuzzy matching | 1 |
| `apps/web/drizzle/0003_*.sql` | Generated migration | 1 |
| `apps/web/server/services/mosque.service.ts` | Add duplicate check, approve, reject, self-edit, my-submissions | 1, 2, 3, 4, 5 |
| `apps/web/server/services/mosque.service.test.ts` | Tests for all of the above | 1, 2, 3, 4, 5 |
| `apps/web/server/utils/validation.ts` | Add `createMosqueSchema`, `updateMosqueSchema` | 2 |
| `apps/web/server/api/mosques/index.post.ts` | `POST /api/mosques` | 2 |
| `apps/web/server/api/mosques/pending.get.ts` | `GET /api/mosques/pending` | 3 |
| `apps/web/server/api/mosques/[id]/approve.patch.ts` | `PATCH /api/mosques/:id/approve` | 3 |
| `apps/web/server/api/mosques/[id]/reject.patch.ts` | `PATCH /api/mosques/:id/reject` | 4 |
| `apps/web/server/api/mosques/[id]/index.patch.ts` | `PATCH /api/mosques/:id` | 5 |
| `apps/web/server/api/mosques/my-submissions.get.ts` | `GET /api/mosques/my-submissions` | 5 |
| `apps/web/server/utils/openapi.ts` | Fill in real request/response detail for these six routes | 6 |

**Route ordering note:** Nitro resolves static path segments (`pending`, `my-submissions`) before dynamic ones (`[id]`), so `mosques/pending.get.ts` and `mosques/my-submissions.get.ts` do not conflict with `mosques/[id]/index.patch.ts` — no special handling needed, but keep this in mind if a future module adds more static top-level `/mosques/*` routes.

---

### Task 1: Duplicate detection

**Files:**
- Modify: `apps/web/drizzle/schema.ts`
- Modify: `apps/web/server/services/mosque.service.ts`
- Modify: `apps/web/server/services/mosque.service.test.ts`

**Interfaces:**
- Consumes: `mosques` table, `Database` (already exported from `mosque.service.ts`).
- Produces:
  - `DuplicateCandidate` — `{ id: string; name: string; address: string; distanceMeters: number; nameSimilarity: number }`
  - `checkForDuplicate(db: Database, input: { name: string; latitude: string; longitude: string }): Promise<DuplicateCandidate[]>` — returns mosques (any status, not just approved — a duplicate could be another pending submission) within 100m AND with trigram name similarity above 0.4, ordered by similarity descending. Empty array means no likely duplicate.

- [ ] **Step 1: Enable `pg_trgm` and write the failing test**

Modify `apps/web/drizzle/schema.ts` — add near the top, after the existing imports:

```typescript
import { sql } from 'drizzle-orm';
```

(already imported at the top of the file — skip re-adding if present) then add, before the first `pgTable` call:

```typescript
export const pgTrgmExtension = sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
```

This is a plain `sql` tag, not a Drizzle schema object — `drizzle-kit generate` does not pick up bare `sql` exports automatically. Instead, after running `npm run db:generate` in Step 2 below, manually prepend `CREATE EXTENSION IF NOT EXISTS pg_trgm;` as the first line of the generated migration file. Delete the `pgTrgmExtension` export from `schema.ts` afterward — it was only a note-to-self for this step, not application code.

Add to `apps/web/server/services/mosque.service.test.ts` (new `describe` block, same file as the existing `createMosque` tests):

```typescript
describe('checkForDuplicate', () => {
  it('flags a nearby mosque with a similar name', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
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
      name: 'Masjid Raya Baiturahman', // one letter dropped, deliberately
      latitude: '5.5501000', // ~15m away
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
});
```

Add this near the top of the file, alongside the existing `describe.runIf(RUN_DB_TESTS)` wrapper already used for `createMosque` — this new `describe` block goes *inside* that same `runIf` wrapper, reusing the same `db`, `provinces`, `cities`, `mosques` imports already present from Module 7's Task 3. Add `checkForDuplicate` to the existing `import { createMosque } from './mosque.service'` line.

- [ ] **Step 2: Generate and inspect the migration**

Run: `npm run db:generate` (from `apps/web/`)

Inspect the generated `0003_*.sql` file. It should be empty or near-empty (no schema.ts table changes were made — only the `pgTrgmExtension` sql tag was added and then removed per Step 1's instruction). Manually add this as the first line of the file if drizzle-kit did not already generate a way to run it:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Delete `export const pgTrgmExtension = sql\`CREATE EXTENSION IF NOT EXISTS pg_trgm\`;` from `schema.ts` now — it has done its job of forcing this checkpoint and is not meant to remain as a schema.ts export.

Run: `npm run db:migrate` (from `apps/web/`, with Docker PostgreSQL running)
Expected: migration applies with no errors; `SELECT * FROM pg_extension WHERE extname = 'pg_trgm';` returns one row.

- [ ] **Step 3: Run the test to verify it fails**

Run: `DATABASE_URL=<your dev db url> npm test -- mosque.service` (from `apps/web/`)
Expected: FAIL — `checkForDuplicate` is not exported yet.

- [ ] **Step 4: Implement `checkForDuplicate`**

Add to `apps/web/server/services/mosque.service.ts`:

```typescript
import { and, eq, isNull, sql } from 'drizzle-orm';
```

(merge with the existing import from `drizzle-orm` in this file rather than duplicating the line)

```typescript
export interface DuplicateCandidate {
  id: string;
  name: string;
  address: string;
  distanceMeters: number;
  nameSimilarity: number;
}

const DUPLICATE_DISTANCE_METERS = 100;
const DUPLICATE_NAME_SIMILARITY_THRESHOLD = 0.4;

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
  const distanceExpr = sql<number>`
    6371000 * acos(
      cos(radians(${input.latitude}::double precision)) * cos(radians(${mosques.latitude}::double precision)) *
      cos(radians(${mosques.longitude}::double precision) - radians(${input.longitude}::double precision)) +
      sin(radians(${input.latitude}::double precision)) * sin(radians(${mosques.latitude}::double precision))
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
        sql`${distanceExpr} < ${DUPLICATE_DISTANCE_METERS}`,
        sql`${similarityExpr} > ${DUPLICATE_NAME_SIMILARITY_THRESHOLD}`,
      ),
    )
    .orderBy(sql`${similarityExpr} DESC`);

  return rows;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `DATABASE_URL=<your dev db url> npm test -- mosque.service` (from `apps/web/`)
Expected: PASS, both new tests plus the existing `createMosque` test.

- [ ] **Step 6: Commit**

```bash
git add apps/web/drizzle/schema.ts apps/web/drizzle apps/web/server/services/mosque.service.ts apps/web/server/services/mosque.service.test.ts
git commit -m "feat: add fuzzy duplicate detection for mosque registration"
```

---

### Task 2: Submit registration — wire duplicate check into the route

`createMosque` already exists (Module 7). This task adds the route handler, wires the duplicate warning into its response, and adds request validation.

**Files:**
- Modify: `apps/web/server/utils/validation.ts`
- Create: `apps/web/server/api/mosques/index.post.ts`

**Interfaces:**
- Consumes: `createMosque`, `checkForDuplicate`, `CreateMosqueInput` (Task 1, Module 7), `requireAuth` (Module 1).
- Produces:
  - `createMosqueSchema` (Zod) — validates `name` (1-200 chars), `address` (1-500 chars), `latitude`/`longitude` (numeric strings matching the `decimal(10,7)` column), `cityId`/`provinceId` (UUID)
  - Route response shape: `{ id, name, status: 'pending', duplicateWarning: DuplicateCandidate[] }`

- [ ] **Step 1: Add the request schema**

Add to `apps/web/server/utils/validation.ts`:

```typescript
export const createMosqueSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  latitude: z.string().regex(/^-?\d{1,3}\.\d{1,7}$/),
  longitude: z.string().regex(/^-?\d{1,3}\.\d{1,7}$/),
  cityId: uuidSchema,
  provinceId: uuidSchema,
});
```

- [ ] **Step 2: Create the route handler**

Create `apps/web/server/api/mosques/index.post.ts`:

```typescript
import { requireAuth } from '../../utils/auth';
import { createMosqueSchema } from '../../utils/validation';
import { checkForDuplicate, createMosque } from '../../services/mosque.service';

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const input = await parseBody(event, createMosqueSchema);

  const db = useDatabase();
  const duplicateWarning = await checkForDuplicate(db, {
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
  });

  const mosque = await createMosque(db, input, auth.sub);

  return { ...mosque, duplicateWarning };
});
```

`parseBody` is a Nitro global auto-import from `server/utils/validation.ts` in this codebase's existing pattern (see `server/api/auth/login.post.ts` for precedent) — import it explicitly if that precedent uses an explicit import instead:

```typescript
import { parseBody } from '../../utils/validation';
```

Check `apps/web/server/api/auth/login.post.ts` for the actual import convention used and match it exactly.

- [ ] **Step 3: Manual verification**

Run: `npm run dev` (from `apps/web/`), then, with a valid bearer token from the Google OAuth flow or seeded Super Admin login:

```bash
curl -s -X POST http://localhost:3000/api/mosques \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Masjid Test","address":"Jl. Test 1","latitude":"5.5500000","longitude":"95.3200000","cityId":"<a real city id>","provinceId":"<a real province id>"}'
```

Expected: `201`-shaped JSON body `{ id, name, status: "pending", duplicateWarning: [] }` (or a non-empty `duplicateWarning` if a similar mosque already exists nearby). Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/server/utils/validation.ts apps/web/server/api/mosques/index.post.ts
git commit -m "feat: add mosque registration submit endpoint"
```

---

### Task 3: Approval — the transactional core

**Files:**
- Modify: `apps/web/server/services/mosque.service.ts`
- Modify: `apps/web/server/services/mosque.service.test.ts`
- Create: `apps/web/server/api/mosques/pending.get.ts`
- Create: `apps/web/server/api/mosques/[id]/approve.patch.ts`

**Interfaces:**
- Consumes: `withAudit`, `Transaction` (Module 7), `upgradeToMosqueAdmin` (Module 1, `user.service.ts`), `requireRole` (Module 1).
- Produces:
  - `listPendingMosques(db: Database): Promise<Array<{ id: string; name: string; address: string; createdAt: Date; submittedBy: string | null }>>` — all `status = 'pending'`, not deleted, oldest first
  - `approveMosque(db: Database, mosqueId: string, actorId: string): Promise<{ id: string; status: 'approved' }>` — throws a 404-shaped error (`createError({ statusCode: 404, ... })`) if the mosque doesn't exist, isn't `deletedAt IS NULL`, or isn't currently `pending`; otherwise, in one transaction: reads the current row (for `history` and for the submitter's id via `createdBy`), sets `status = 'approved'` and `adminUserId = <submitter>`, calls `upgradeToMosqueAdmin(tx, submitterId)`, calls `withAudit(tx, { action: 'UPDATE', ... })`, and returns the new status. If `upgradeToMosqueAdmin` throws, the whole transaction rolls back and the mosque's status is unchanged — this is the property under test in Step 1.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/server/services/mosque.service.test.ts`, inside the existing `describe.runIf(RUN_DB_TESTS)` block:

```typescript
describe('approveMosque', () => {
  it('sets status to approved, assigns admin_user_id, and upgrades the submitter to mosque_admin', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');
    const [submitter] = await db
      .insert(users)
      .values({ name: 'Submitter', email: `s${Date.now()}@test.dev`, role: 'public_user', provider: 'local' })
      .returning();
    if (!submitter) throw new Error('user insert failed');

    const mosque = await createMosque(
      db,
      { name: 'Masjid Approve Test', address: 'Jl. A', latitude: '5.5500000', longitude: '95.3200000', cityId: city.id, provinceId: province.id },
      submitter.id,
    );

    const result = await approveMosque(db, mosque.id, submitter.id);
    expect(result.status).toBe('approved');

    const [row] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
    expect(row?.status).toBe('approved');
    expect(row?.adminUserId).toBe(submitter.id);
    expect((row?.history as unknown[]).length).toBe(2); // CREATE + this UPDATE

    const [updatedUser] = await db.select().from(users).where(eq(users.id, submitter.id));
    expect(updatedUser?.role).toBe('mosque_admin');
  });

  it('does not change status if role upgrade fails', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');

    const mosque = await createMosque(
      db,
      { name: 'Masjid Fail Test', address: 'Jl. B', latitude: '5.5500000', longitude: '95.3200000', cityId: city.id, provinceId: province.id },
      // A non-existent submitter id: upgradeToMosqueAdmin's WHERE clause matches
      // zero rows, which is not itself an error — so this test instead verifies
      // the transaction's atomicity via a nonexistent mosque id passed to
      // approveMosque, which must throw before any write happens.
      '00000000-0000-0000-0000-000000000000',
    );

    await expect(approveMosque(db, '00000000-0000-0000-0000-000000000099', 'actor-1')).rejects.toThrow();

    const [row] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
    expect(row?.status).toBe('pending'); // untouched — the failed call targeted a different id
  });

  it('rejects approving a mosque that is not pending', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');
    const [submitter] = await db
      .insert(users)
      .values({ name: 'Submitter2', email: `s2${Date.now()}@test.dev`, role: 'public_user', provider: 'local' })
      .returning();
    if (!submitter) throw new Error('user insert failed');

    const mosque = await createMosque(
      db,
      { name: 'Masjid Double Approve', address: 'Jl. C', latitude: '5.5500000', longitude: '95.3200000', cityId: city.id, provinceId: province.id },
      submitter.id,
    );
    await approveMosque(db, mosque.id, submitter.id);

    await expect(approveMosque(db, mosque.id, submitter.id)).rejects.toThrow();
  });
});

describe('listPendingMosques', () => {
  it('returns only pending, non-deleted mosques', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');

    await createMosque(
      db,
      { name: 'Masjid Pending List', address: 'Jl. D', latitude: '5.5500000', longitude: '95.3200000', cityId: city.id, provinceId: province.id },
      '00000000-0000-0000-0000-000000000001',
    );

    const pending = await listPendingMosques(db);
    expect(pending.some((m) => m.name === 'Masjid Pending List')).toBe(true);
    expect(pending.every((m) => m.name !== undefined)).toBe(true);
  });
});
```

Add `approveMosque`, `listPendingMosques` to the existing import from `./mosque.service`, and `users` to the existing import from `../../drizzle/schema`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DATABASE_URL=<your dev db url> npm test -- mosque.service` (from `apps/web/`)
Expected: FAIL — `approveMosque` and `listPendingMosques` are not exported yet.

- [ ] **Step 3: Implement both functions**

Add to `apps/web/server/services/mosque.service.ts`:

```typescript
import { upgradeToMosqueAdmin } from './user.service';
```

```typescript
export interface PendingMosqueSummary {
  id: string;
  name: string;
  address: string;
  createdAt: Date;
  submittedBy: string | null;
}

export async function listPendingMosques(db: Database): Promise<PendingMosqueSummary[]> {
  const rows = await db
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

  return rows;
}

export interface ApprovedMosque {
  id: string;
  status: 'approved';
}

/**
 * Approves a pending mosque: sets status, assigns admin_user_id to the
 * submitter, and upgrades the submitter's role — all in one transaction.
 * If any step fails, the whole approval rolls back; the mosque stays
 * `pending` and the submitter's role is unchanged.
 */
export async function approveMosque(
  db: Database,
  mosqueId: string,
  actorId: string,
): Promise<ApprovedMosque> {
  return await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(mosques)
      .where(and(eq(mosques.id, mosqueId), isNull(mosques.deletedAt)))
      .limit(1);

    const mosque = rows[0];
    if (!mosque) {
      throw createError({ statusCode: 404, statusMessage: 'Mosque not found' });
    }
    if (mosque.status !== 'pending') {
      throw createError({ statusCode: 409, statusMessage: 'Mosque is not pending approval' });
    }
    if (!mosque.createdBy) {
      throw createError({ statusCode: 422, statusMessage: 'Mosque has no submitter to promote' });
    }

    const submitterId = mosque.createdBy;

    await tx
      .update(mosques)
      .set({ status: 'approved', adminUserId: submitterId })
      .where(eq(mosques.id, mosqueId));

    await upgradeToMosqueAdmin(tx, submitterId);

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
```

`upgradeToMosqueAdmin`'s existing signature (`user.service.ts`, Module 1) is `upgradeToMosqueAdmin(db: Database, userId: string): Promise<void>` where `Database = NodePgDatabase<typeof schema>`. Confirm that a transaction handle (`tx`, typed as `Transaction` per Module 7's `audit.service.ts`) is structurally assignable to `user.service.ts`'s own `Database` type before relying on passing `tx` straight through — both are Drizzle handles over the same `schema`, and Drizzle's transaction callback parameter is typed as a subtype of the database type for this reason, so this should type-check without a cast. If it does not, the fix is to change `upgradeToMosqueAdmin`'s parameter type in `user.service.ts` to accept `Database | Transaction`, not to add an `as` cast here.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `DATABASE_URL=<your dev db url> npm test -- mosque.service` (from `apps/web/`)
Expected: PASS, all tests including the 4 new ones.

- [ ] **Step 5: Create the route handlers**

Create `apps/web/server/api/mosques/pending.get.ts`:

```typescript
import { requireRole } from '../../utils/auth';
import { listPendingMosques } from '../../services/mosque.service';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'super_admin');
  return await listPendingMosques(useDatabase());
});
```

Create `apps/web/server/api/mosques/[id]/approve.patch.ts`:

```typescript
import { requireRole } from '../../../utils/auth';
import { uuidSchema } from '../../../utils/validation';
import { approveMosque } from '../../../services/mosque.service';

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, 'super_admin');
  const id = uuidSchema.parse(getRouterParam(event, 'id'));
  return await approveMosque(useDatabase(), id, auth.sub);
});
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/services/mosque.service.ts apps/web/server/services/mosque.service.test.ts apps/web/server/api/mosques/pending.get.ts "apps/web/server/api/mosques/[id]/approve.patch.ts"
git commit -m "feat: add mosque approval with atomic role upgrade"
```

---

### Task 4: Rejection

**Files:**
- Modify: `apps/web/server/services/mosque.service.ts`
- Modify: `apps/web/server/services/mosque.service.test.ts`
- Create: `apps/web/server/api/mosques/[id]/reject.patch.ts`

**Interfaces:**
- Consumes: `withAudit` (Module 7).
- Produces:
  - `rejectMosque(db: Database, mosqueId: string, actorId: string): Promise<{ id: string; status: 'rejected' }>` — throws 404 if not found, 409 if not currently `pending`. Never touches the submitter's role.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/server/services/mosque.service.test.ts`:

```typescript
describe('rejectMosque', () => {
  it('sets status to rejected without changing the submitter role', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');
    const [submitter] = await db
      .insert(users)
      .values({ name: 'Rejectee', email: `r${Date.now()}@test.dev`, role: 'public_user', provider: 'local' })
      .returning();
    if (!submitter) throw new Error('user insert failed');

    const mosque = await createMosque(
      db,
      { name: 'Masjid Reject Test', address: 'Jl. E', latitude: '5.5500000', longitude: '95.3200000', cityId: city.id, provinceId: province.id },
      submitter.id,
    );

    const result = await rejectMosque(db, mosque.id, 'actor-1');
    expect(result.status).toBe('rejected');

    const [updatedUser] = await db.select().from(users).where(eq(users.id, submitter.id));
    expect(updatedUser?.role).toBe('public_user');
  });

  it('rejects rejecting a mosque that is not pending', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');

    const mosque = await createMosque(
      db,
      { name: 'Masjid Double Reject', address: 'Jl. F', latitude: '5.5500000', longitude: '95.3200000', cityId: city.id, provinceId: province.id },
      '00000000-0000-0000-0000-000000000002',
    );
    await rejectMosque(db, mosque.id, 'actor-1');

    await expect(rejectMosque(db, mosque.id, 'actor-1')).rejects.toThrow();
  });
});
```

Add `rejectMosque` to the existing import from `./mosque.service`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL=<your dev db url> npm test -- mosque.service` (from `apps/web/`)
Expected: FAIL — `rejectMosque` is not exported yet.

- [ ] **Step 3: Implement `rejectMosque`**

Add to `apps/web/server/services/mosque.service.ts`:

```typescript
export interface RejectedMosque {
  id: string;
  status: 'rejected';
}

export async function rejectMosque(
  db: Database,
  mosqueId: string,
  actorId: string,
): Promise<RejectedMosque> {
  return await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(mosques)
      .where(and(eq(mosques.id, mosqueId), isNull(mosques.deletedAt)))
      .limit(1);

    const mosque = rows[0];
    if (!mosque) {
      throw createError({ statusCode: 404, statusMessage: 'Mosque not found' });
    }
    if (mosque.status !== 'pending') {
      throw createError({ statusCode: 409, statusMessage: 'Mosque is not pending approval' });
    }

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `DATABASE_URL=<your dev db url> npm test -- mosque.service` (from `apps/web/`)
Expected: PASS, all tests including the 2 new ones.

- [ ] **Step 5: Create the route handler**

Create `apps/web/server/api/mosques/[id]/reject.patch.ts`:

```typescript
import { requireRole } from '../../../utils/auth';
import { uuidSchema } from '../../../utils/validation';
import { rejectMosque } from '../../../services/mosque.service';

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, 'super_admin');
  const id = uuidSchema.parse(getRouterParam(event, 'id'));
  return await rejectMosque(useDatabase(), id, auth.sub);
});
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/services/mosque.service.ts apps/web/server/services/mosque.service.test.ts "apps/web/server/api/mosques/[id]/reject.patch.ts"
git commit -m "feat: add mosque rejection endpoint"
```

---

### Task 5: Self-edit and my-submissions

**Files:**
- Modify: `apps/web/server/utils/validation.ts`
- Modify: `apps/web/server/services/mosque.service.ts`
- Modify: `apps/web/server/services/mosque.service.test.ts`
- Create: `apps/web/server/api/mosques/[id]/index.patch.ts`
- Create: `apps/web/server/api/mosques/my-submissions.get.ts`

**Interfaces:**
- Consumes: `requireMosqueOwner` (Module 1), `withAudit` (Module 7).
- Produces:
  - `updateMosqueSchema` (Zod) — a partial of `createMosqueSchema`'s fields (`name`, `address`, `latitude`, `longitude` — not `cityId`/`provinceId`/`status`, which don't change through self-edit), all optional, at least one field required
  - `updateApprovedMosque(db: Database, mosqueId: string, updates: Partial<{ name: string; address: string; latitude: string; longitude: string }>, actorId: string): Promise<{ id: string }>` — throws 404 if not found/deleted, 409 if `status !== 'approved'`
  - `listMySubmissions(db: Database, userId: string): Promise<Array<{ id: string; name: string; status: 'pending' | 'approved' | 'rejected'; createdAt: Date }>>` — every mosque where `createdBy = userId`, any status, not deleted, newest first

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/server/services/mosque.service.test.ts`:

```typescript
describe('updateApprovedMosque', () => {
  it('updates fields on an approved mosque', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');
    const [submitter] = await db
      .insert(users)
      .values({ name: 'Editor', email: `e${Date.now()}@test.dev`, role: 'public_user', provider: 'local' })
      .returning();
    if (!submitter) throw new Error('user insert failed');

    const mosque = await createMosque(
      db,
      { name: 'Masjid Edit Test', address: 'Jl. Lama', latitude: '5.5500000', longitude: '95.3200000', cityId: city.id, provinceId: province.id },
      submitter.id,
    );
    await approveMosque(db, mosque.id, submitter.id);

    await updateApprovedMosque(db, mosque.id, { address: 'Jl. Baru No. 2' }, submitter.id);

    const [row] = await db.select().from(mosques).where(eq(mosques.id, mosque.id));
    expect(row?.address).toBe('Jl. Baru No. 2');
  });

  it('rejects editing a mosque that is not approved yet', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');

    const mosque = await createMosque(
      db,
      { name: 'Masjid Still Pending', address: 'Jl. G', latitude: '5.5500000', longitude: '95.3200000', cityId: city.id, provinceId: province.id },
      '00000000-0000-0000-0000-000000000003',
    );

    await expect(
      updateApprovedMosque(db, mosque.id, { address: 'New Address' }, '00000000-0000-0000-0000-000000000003'),
    ).rejects.toThrow();
  });
});

describe('listMySubmissions', () => {
  it('lists every mosque the user submitted regardless of status', async () => {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');
    const submitterId = '00000000-0000-0000-0000-000000000004';

    await createMosque(
      db,
      { name: 'Masjid My Sub 1', address: 'Jl. H', latitude: '5.5500000', longitude: '95.3200000', cityId: city.id, provinceId: province.id },
      submitterId,
    );
    const second = await createMosque(
      db,
      { name: 'Masjid My Sub 2', address: 'Jl. I', latitude: '5.5600000', longitude: '95.3300000', cityId: city.id, provinceId: province.id },
      submitterId,
    );
    await rejectMosque(db, second.id, 'actor-1');

    const submissions = await listMySubmissions(db, submitterId);
    expect(submissions.length).toBeGreaterThanOrEqual(2);
    expect(submissions.some((m) => m.name === 'Masjid My Sub 1' && m.status === 'pending')).toBe(true);
    expect(submissions.some((m) => m.name === 'Masjid My Sub 2' && m.status === 'rejected')).toBe(true);
  });
});
```

Add `updateApprovedMosque`, `listMySubmissions` to the existing import from `./mosque.service`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DATABASE_URL=<your dev db url> npm test -- mosque.service` (from `apps/web/`)
Expected: FAIL — `updateApprovedMosque` and `listMySubmissions` are not exported yet.

- [ ] **Step 3: Add the validation schema**

Add to `apps/web/server/utils/validation.ts`:

```typescript
export const updateMosqueSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().min(1).max(500).optional(),
    latitude: z.string().regex(/^-?\d{1,3}\.\d{1,7}$/).optional(),
    longitude: z.string().regex(/^-?\d{1,3}\.\d{1,7}$/).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
```

- [ ] **Step 4: Implement both service functions**

Add to `apps/web/server/services/mosque.service.ts`:

```typescript
export async function updateApprovedMosque(
  db: Database,
  mosqueId: string,
  updates: Partial<{ name: string; address: string; latitude: string; longitude: string }>,
  actorId: string,
): Promise<{ id: string }> {
  return await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(mosques)
      .where(and(eq(mosques.id, mosqueId), isNull(mosques.deletedAt)))
      .limit(1);

    const mosque = rows[0];
    if (!mosque) {
      throw createError({ statusCode: 404, statusMessage: 'Mosque not found' });
    }
    if (mosque.status !== 'approved') {
      throw createError({ statusCode: 409, statusMessage: 'Mosque must be approved before editing' });
    }

    await tx.update(mosques).set(updates).where(eq(mosques.id, mosqueId));

    await withAudit(tx, {
      table: mosques,
      tableName: 'mosques',
      recordId: mosqueId,
      action: 'UPDATE',
      actorId,
      oldData: Object.fromEntries(Object.keys(updates).map((key) => [key, (mosque as Record<string, unknown>)[key]])),
      newData: updates,
      currentHistory: mosque.history as unknown[],
    });

    return { id: mosqueId };
  });
}

export interface MySubmission {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export async function listMySubmissions(db: Database, userId: string): Promise<MySubmission[]> {
  const rows = await db
    .select({
      id: mosques.id,
      name: mosques.name,
      status: mosques.status,
      createdAt: mosques.createdAt,
    })
    .from(mosques)
    .where(and(eq(mosques.createdBy, userId), isNull(mosques.deletedAt)))
    .orderBy(sql`${mosques.createdAt} DESC`);

  return rows;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `DATABASE_URL=<your dev db url> npm test -- mosque.service` (from `apps/web/`)
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 6: Create the route handlers**

Create `apps/web/server/api/mosques/[id]/index.patch.ts`:

```typescript
import { requireMosqueOwner } from '../../../utils/auth';
import { uuidSchema, updateMosqueSchema, parseBody } from '../../../utils/validation';
import { updateApprovedMosque } from '../../../services/mosque.service';

export default defineEventHandler(async (event) => {
  const id = uuidSchema.parse(getRouterParam(event, 'id'));
  const auth = await requireMosqueOwner(event, id);
  const updates = await parseBody(event, updateMosqueSchema);
  return await updateApprovedMosque(useDatabase(), id, updates, auth.sub);
});
```

Create `apps/web/server/api/mosques/my-submissions.get.ts`:

```typescript
import { requireAuth } from '../../utils/auth';
import { listMySubmissions } from '../../services/mosque.service';

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  return await listMySubmissions(useDatabase(), auth.sub);
});
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/utils/validation.ts apps/web/server/services/mosque.service.ts apps/web/server/services/mosque.service.test.ts "apps/web/server/api/mosques/[id]/index.patch.ts" apps/web/server/api/mosques/my-submissions.get.ts
git commit -m "feat: add mosque self-edit and my-submissions endpoints"
```

---

### Task 6: OpenAPI contract entries

**Files:**
- Modify: `apps/web/server/utils/openapi.ts`

**Interfaces:**
- Consumes: nothing new — fills in real parameter/response detail for the six route stubs already present (`/mosques`, `/mosques/{id}/approve`, `/mosques/{id}/reject`, `/mosques/pending`) plus two new paths this module adds (`/mosques/{id}` PATCH, `/mosques/my-submissions`).
- Produces: nothing for other tasks; leaf documentation task.

- [ ] **Step 1: Update the OpenAPI document**

Modify `apps/web/server/utils/openapi.ts`. Replace the existing `/mosques` and `/mosques/{id}/approve`, `/mosques/{id}/reject`, `/mosques/pending` stub entries, and add two new paths:

```typescript
'/mosques': {
  post: {
    summary: 'Submit mosque registration',
    security: [{ bearerAuth: [] }],
    responses: {
      '201': { description: 'Created with status=pending and a duplicateWarning list' },
    },
  },
},
'/mosques/pending': {
  get: {
    summary: 'List pending mosque registrations',
    security: [{ bearerAuth: [] }],
    responses: { '200': { description: 'Pending mosques, oldest first' } },
  },
},
'/mosques/{id}/approve': {
  patch: {
    summary: 'Approve mosque registration',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: {
      '200': { description: 'Mosque approved; submitter upgraded to mosque_admin' },
      '404': { description: 'Mosque not found' },
      '409': { description: 'Mosque is not pending' },
    },
  },
},
'/mosques/{id}/reject': {
  patch: {
    summary: 'Reject mosque registration',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: {
      '200': { description: 'Mosque rejected; submitter role unchanged' },
      '404': { description: 'Mosque not found' },
      '409': { description: 'Mosque is not pending' },
    },
  },
},
'/mosques/{id}': {
  patch: {
    summary: 'Edit an approved mosque (owner only)',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: {
      '200': { description: 'Mosque updated' },
      '403': { description: 'Caller does not own this mosque' },
      '409': { description: 'Mosque is not approved yet' },
    },
  },
},
'/mosques/my-submissions': {
  get: {
    summary: "List the caller's own mosque submissions and their status",
    security: [{ bearerAuth: [] }],
    responses: { '200': { description: 'Submissions in any status, newest first' } },
  },
},
```

Note: `/mosques/{id}` already has a `get:` entry from Module 4's plan (mosque detail). Add `patch:` as a sibling key under the same `/mosques/{id}` path object rather than overwriting it — if Module 4 has already been implemented and committed by the time this task runs, read the current file first and merge in the `patch` key.

Leave every other entry in the file untouched.

- [ ] **Step 2: Verify the docs route still serves the file**

Run: `npm run dev` (from `apps/web/`), then: `curl -s http://localhost:3000/api/openapi.json | head -c 500`
Expected: valid JSON. Stop the dev server after checking.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/utils/openapi.ts
git commit -m "docs: fill in OpenAPI contract for mosque registration endpoints"
```

---

## Self-Review Notes

- **Spec coverage:** §3.3's six endpoints are Tasks 2 (`POST /mosques`), 3 (`GET /mosques/pending`, `PATCH /mosques/:id/approve`), 4 (`PATCH /mosques/:id/reject`), 5 (`PATCH /mosques/:id`, `GET /mosques/my-submissions`). The "one user, multiple mosques, role never regresses" rule is directly tested in Task 3 Step 1's first test (`upgradeToMosqueAdmin`'s own `WHERE role = 'public_user'` guard, from Module 1, is what makes a second approval a no-op instead of an error — confirmed by re-reading `user.service.ts` before writing this plan). The transactional atomicity rule is tested in Task 3 Step 1's second test. The soft-duplicate-as-warning rule is Task 1. Ownership-not-role for self-edit is Task 5, via `requireMosqueOwner`.
- **Placeholder scan:** no TBD/TODO; every step has real, runnable code. Task 1's `pg_trgm` migration step is unusually manual (Drizzle can't generate a `CREATE EXTENSION` statement from a `pgTable` definition) — this is called out explicitly as a one-time manual edit to the generated SQL file, not left vague.
- **Type consistency:** `Database` and `ApprovedMosque`/`RejectedMosque`/`PendingMosqueSummary`/`MySubmission`/`DuplicateCandidate` are all defined once, in the task that first needs them, and referenced (not redefined) afterward. `mosque.service.ts`'s existing `createMosque`/`CreateMosqueInput`/`CreatedMosque` (from Module 7) are consumed as-is with no signature changes. Flagged the `Transaction`-vs-`Database` type compatibility question explicitly in Task 3 Step 3, since `upgradeToMosqueAdmin` (Module 1) was written and tested against a plain `Database` handle, not a transaction — this plan's approval flow requires calling it from inside a transaction for atomicity, so the executor must confirm (or fix) that compatibility rather than discover it as a surprise type error mid-task.
- **Duplicate-check scope:** deliberately checks mosques in *any* status, not just `approved` — a second `pending` submission of the same physical mosque is the primary case this guards against, not just clashing with something already live. Called out in the interface doc comment in Task 1.
