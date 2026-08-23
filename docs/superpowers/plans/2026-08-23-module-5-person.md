# Module 5: Person Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full CRUD for the Person entity — the reusable Khatib/Imam/Muazzin master data scoped per mosque that Module 6 (Friday Assignment) will reference by id.

**Architecture:** Nitro routes under `apps/web/server/api/mosques/[id]/people/` handle HTTP only; all logic lives in `server/services/person.service.ts`. Every write endpoint is gated by `requireMosqueOwner` (Module 1) — a Mosque Admin can only manage Person rows for a mosque they own, checked via `mosques.admin_user_id`, never by role alone. Delete is soft delete only (`deleted_at`), so a Person referenced by a past Friday assignment keeps rendering in that assignment's history even after being "removed" from the active roster. Every write goes through `withAudit` (Module 7) in the same transaction.

**Tech Stack:** Nuxt 4 / Nitro, TypeScript (strict), Drizzle ORM + PostgreSQL, Zod 4, Vitest 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-23-module-5-person.md` (module-specific contract). Also implements §2.2 and §3.5 of the shared `docs/superpowers/specs/2026-08-23-baituna-modules-design.md`. Background: `docs/baituna-erd.md` §6.1 (`people` entity); PRD §6 endpoint table (four `✚`-marked Person endpoints).

**Depends on:** Module 1 (Auth & RBAC — `requireMosqueOwner`) and Module 7 (Audit Log — `withAudit`), both already implemented in this repo as of 2026-08-23.

## Global Constraints

These apply to every task. Copied from the spec and the repo's existing conventions.

- **Full CRUD, no inline auto-create.** Person is managed exclusively through `/mosques/:id/people`. Friday Assignment (Module 6) accepts only a `person_id`, never a free-text name — this prevents duplicate Person rows that would break "history of assignments per person." (Spec §2.2)
- **Ownership is per-mosque, not per-role.** Every write endpoint uses `requireMosqueOwner`, comparing `mosques.admin_user_id` to the caller — never a bare `role === 'mosque_admin'` check. (Spec §3.3, ERD §6.3, reused unchanged from Module 3's constraint)
- **Delete is soft delete.** `DELETE /mosques/:id/people/:personId` sets `deleted_at`; it never removes the row. A soft-deleted Person must still resolve correctly when referenced by an old Friday assignment's `khatib_person_id`/`imam_person_id`/`muazzin_person_id` — those FK columns don't filter on `deletedAt`, so this is automatic, but the *list* endpoint (`GET /mosques/:id/people`) must exclude soft-deleted rows. (Spec §3.5, PRD endpoint table)
- **A Person belongs to exactly one mosque for its lifetime.** `people.mosque_id` is set on create and never changed by update — `updatePerson` does not accept a `mosqueId` field.
- **Every write goes through `withAudit`, in the same transaction as the business write.** See `server/services/README.md`'s "Module 7 — Audit Log" section for the pattern.
- **Never write business logic in route handlers.** Route files parse input, call a service, and shape the response.
- **Soft delete everywhere on reads.** Every read filters `isNull(people.deletedAt)` unless explicitly documented otherwise (see the delete-then-reference case above). The `active` column is a generated column — never write to it.
- **TypeScript is strict.** No `any`. No non-null assertions (`!`) on values that can genuinely be null.
- **Commit messages follow Conventional Commits** (`feat:`, `test:`, `chore:`, `docs:`) — commitlint + husky enforce this on commit.
- **Every command in this plan runs from `apps/web/`** unless stated otherwise.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/server/services/person.service.ts` | List/create/update/soft-delete Person, scoped per mosque | 1, 2, 3, 4 |
| `apps/web/server/services/person.service.test.ts` | Tests for the above | 1, 2, 3, 4 |
| `apps/web/server/utils/validation.ts` | Add `createPersonSchema`, `updatePersonSchema` | 2, 3 |
| `apps/web/server/api/mosques/[id]/people/index.get.ts` | `GET /api/mosques/:id/people` | 1 |
| `apps/web/server/api/mosques/[id]/people/index.post.ts` | `POST /api/mosques/:id/people` | 2 |
| `apps/web/server/api/mosques/[id]/people/[personId].patch.ts` | `PATCH /api/mosques/:id/people/:personId` | 3 |
| `apps/web/server/api/mosques/[id]/people/[personId].delete.ts` | `DELETE /api/mosques/:id/people/:personId` | 4 |
| `apps/web/server/utils/openapi.ts` | Fill in real request/response detail for these four routes | 5 |

**Route path note:** these routes nest under Module 3's `apps/web/server/api/mosques/[id]/` directory. Module 3 only creates files directly in that directory (`approve.patch.ts`, `reject.patch.ts`, `index.patch.ts`) plus a `people/` subdirectory does not yet exist there — this module creates that subdirectory. No file this plan creates collides with any file Module 3 or Module 4 creates.

---

### Task 1: List Person for a mosque

**Files:**
- Create: `apps/web/server/services/person.service.ts`
- Test: `apps/web/server/services/person.service.test.ts`
- Create: `apps/web/server/api/mosques/[id]/people/index.get.ts`

**Interfaces:**
- Consumes: `people` table (`drizzle/schema.ts`), `useDatabase` (`server/utils/database.ts`).
- Produces:
  - `Database` — `NodePgDatabase<typeof schema>` type alias, exported for later tasks to reuse
  - `PersonSummary` — `{ id: string; name: string; phone: string | null }`
  - `listActivePeople(db: Database, mosqueId: string): Promise<PersonSummary[]>` — active (not soft-deleted) Person rows for the given mosque, ordered by `name` ascending

- [ ] **Step 1: Write the failing test**

Create `apps/web/server/services/person.service.test.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { cities, mosques, people, provinces } from '../../drizzle/schema';
import { listActivePeople } from './person.service';

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('person.service', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  async function seedMosque() {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}-${Math.random()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}-${Math.random()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');
    const [mosque] = await db
      .insert(mosques)
      .values({
        name: `Masjid ${Date.now()}`,
        address: 'Jl. Test',
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
        status: 'approved',
      })
      .returning();
    if (!mosque) throw new Error('mosque insert failed');
    return mosque;
  }

  describe('listActivePeople', () => {
    it('lists active Person rows for a mosque, alphabetically', async () => {
      const mosque = await seedMosque();
      await db.insert(people).values([
        { mosqueId: mosque.id, name: 'Zainal', phone: null },
        { mosqueId: mosque.id, name: 'Ahmad', phone: '0812' },
      ]);

      const result = await listActivePeople(db, mosque.id);
      expect(result.map((p) => p.name)).toEqual(['Ahmad', 'Zainal']);
    });

    it('excludes soft-deleted Person rows', async () => {
      const mosque = await seedMosque();
      const [inserted] = await db.insert(people).values({ mosqueId: mosque.id, name: 'Deleted Guy', phone: null }).returning();
      if (!inserted) throw new Error('person insert failed');
      await db.update(people).set({ deletedAt: new Date() }).where(eq(people.id, inserted.id));

      const result = await listActivePeople(db, mosque.id);
      expect(result.find((p) => p.id === inserted.id)).toBeUndefined();
    });

    it('does not return Person rows belonging to a different mosque', async () => {
      const mosqueA = await seedMosque();
      const mosqueB = await seedMosque();
      await db.insert(people).values({ mosqueId: mosqueA.id, name: 'Only In A', phone: null });

      const result = await listActivePeople(db, mosqueB.id);
      expect(result.find((p) => p.name === 'Only In A')).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL=<your dev db url> npm test -- person.service` (from `apps/web/`)
Expected: FAIL — `person.service.ts` does not exist yet.

- [ ] **Step 3: Implement `listActivePeople`**

Create `apps/web/server/services/person.service.ts`:

```typescript
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../../drizzle/schema';
import { people } from '../../drizzle/schema';

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `DATABASE_URL=<your dev db url> npm test -- person.service` (from `apps/web/`)
Expected: PASS, all 3 tests.

- [ ] **Step 5: Create the route handler**

Create `apps/web/server/api/mosques/[id]/people/index.get.ts`:

```typescript
import { listActivePeople } from '../../../../services/person.service';
import { uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  return await listActivePeople(useDatabase(), mosqueId);
});
```

This route is public (PRD §6: `✚ GET /mosques/:id/people` — access `Public`) — no auth guard, matching how mosque detail (Module 4) is public.

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/services/person.service.ts apps/web/server/services/person.service.test.ts "apps/web/server/api/mosques/[id]/people/index.get.ts"
git commit -m "feat: add Person list endpoint"
```

---

### Task 2: Create Person

**Files:**
- Modify: `apps/web/server/services/person.service.ts`
- Modify: `apps/web/server/services/person.service.test.ts`
- Modify: `apps/web/server/utils/validation.ts`
- Create: `apps/web/server/api/mosques/[id]/people/index.post.ts`

**Interfaces:**
- Consumes: `withAudit`, `Transaction` (Module 7), `requireMosqueOwner` (Module 1).
- Produces:
  - `createPersonSchema` (Zod) — `{ name: string (1-200 chars); phone: string | null (optional, max 30 chars) }`
  - `createPerson(db: Database, mosqueId: string, input: { name: string; phone: string | null }, actorId: string): Promise<PersonSummary>`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/server/services/person.service.test.ts`, inside the existing `describe.runIf(RUN_DB_TESTS)` block:

```typescript
describe('createPerson', () => {
  it('inserts a Person scoped to the mosque and writes one audit entry', async () => {
    const mosque = await seedMosque();

    const result = await createPerson(db, mosque.id, { name: 'Ustadz Fulan', phone: '0812345' }, 'actor-1');

    expect(result.name).toBe('Ustadz Fulan');

    const [row] = await db.select().from(people).where(eq(people.id, result.id));
    expect(row?.mosqueId).toBe(mosque.id);
    expect((row?.history as unknown[]).length).toBe(1);
  });
});
```

Add `createPerson` to the existing import from `./person.service`, and `auditLogs` is not needed here (already covered by Module 7's own tests) — no further import changes required beyond `createPerson`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL=<your dev db url> npm test -- person.service` (from `apps/web/`)
Expected: FAIL — `createPerson` is not exported yet.

- [ ] **Step 3: Add the validation schema**

Add to `apps/web/server/utils/validation.ts`:

```typescript
export const createPersonSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(30).nullable().default(null),
});
```

- [ ] **Step 4: Implement `createPerson`**

Add to `apps/web/server/services/person.service.ts`:

```typescript
import { withAudit } from './audit.service';
```

```typescript
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `DATABASE_URL=<your dev db url> npm test -- person.service` (from `apps/web/`)
Expected: PASS, all tests including the new one.

- [ ] **Step 6: Create the route handler**

Create `apps/web/server/api/mosques/[id]/people/index.post.ts`:

```typescript
import { createPerson } from '../../../../services/person.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { createPersonSchema, parseBody, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const auth = await requireMosqueOwner(event, mosqueId);
  const input = await parseBody(event, createPersonSchema);
  return await createPerson(useDatabase(), mosqueId, input, auth.sub);
});
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/services/person.service.ts apps/web/server/services/person.service.test.ts apps/web/server/utils/validation.ts "apps/web/server/api/mosques/[id]/people/index.post.ts"
git commit -m "feat: add Person create endpoint"
```

---

### Task 3: Update Person

**Files:**
- Modify: `apps/web/server/services/person.service.ts`
- Modify: `apps/web/server/services/person.service.test.ts`
- Modify: `apps/web/server/utils/validation.ts`
- Create: `apps/web/server/api/mosques/[id]/people/[personId].patch.ts`

**Interfaces:**
- Consumes: `withAudit` (Module 7), `requireMosqueOwner` (Module 1).
- Produces:
  - `updatePersonSchema` (Zod) — `{ name?: string; phone?: string | null }`, at least one field required
  - `updatePerson(db: Database, mosqueId: string, personId: string, updates: Partial<{ name: string; phone: string | null }>, actorId: string): Promise<PersonSummary>` — throws 404 if the Person doesn't exist, is soft-deleted, or does not belong to `mosqueId` (this last case must also 404, not 403 — it must not reveal that a Person with that id exists under a different mosque)

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/server/services/person.service.test.ts`:

```typescript
describe('updatePerson', () => {
  it('updates fields and writes an audit entry', async () => {
    const mosque = await seedMosque();
    const created = await createPerson(db, mosque.id, { name: 'Before Name', phone: null }, 'actor-1');

    const result = await updatePerson(db, mosque.id, created.id, { name: 'After Name' }, 'actor-2');
    expect(result.name).toBe('After Name');

    const [row] = await db.select().from(people).where(eq(people.id, created.id));
    expect((row?.history as unknown[]).length).toBe(2);
  });

  it('404s when the Person belongs to a different mosque', async () => {
    const mosqueA = await seedMosque();
    const mosqueB = await seedMosque();
    const created = await createPerson(db, mosqueA.id, { name: 'Cross Mosque', phone: null }, 'actor-1');

    await expect(updatePerson(db, mosqueB.id, created.id, { name: 'Hacked' }, 'actor-1')).rejects.toThrow();
  });

  it('404s when the Person is soft-deleted', async () => {
    const mosque = await seedMosque();
    const created = await createPerson(db, mosque.id, { name: 'Will Delete', phone: null }, 'actor-1');
    await db.update(people).set({ deletedAt: new Date() }).where(eq(people.id, created.id));

    await expect(updatePerson(db, mosque.id, created.id, { name: 'Too Late' }, 'actor-1')).rejects.toThrow();
  });
});
```

Add `updatePerson` to the existing import from `./person.service`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DATABASE_URL=<your dev db url> npm test -- person.service` (from `apps/web/`)
Expected: FAIL — `updatePerson` is not exported yet.

- [ ] **Step 3: Add the validation schema**

Add to `apps/web/server/utils/validation.ts`:

```typescript
export const updatePersonSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
```

- [ ] **Step 4: Implement `updatePerson`**

Add to `apps/web/server/services/person.service.ts`:

```typescript
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `DATABASE_URL=<your dev db url> npm test -- person.service` (from `apps/web/`)
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 6: Create the route handler**

Create `apps/web/server/api/mosques/[id]/people/[personId].patch.ts`:

```typescript
import { updatePerson } from '../../../../services/person.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { parseBody, updatePersonSchema, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const personId = uuidSchema.parse(getRouterParam(event, 'personId'));
  const auth = await requireMosqueOwner(event, mosqueId);
  const updates = await parseBody(event, updatePersonSchema);
  return await updatePerson(useDatabase(), mosqueId, personId, updates, auth.sub);
});
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/services/person.service.ts apps/web/server/services/person.service.test.ts apps/web/server/utils/validation.ts "apps/web/server/api/mosques/[id]/people/[personId].patch.ts"
git commit -m "feat: add Person update endpoint"
```

---

### Task 4: Soft-delete Person

**Files:**
- Modify: `apps/web/server/services/person.service.ts`
- Modify: `apps/web/server/services/person.service.test.ts`
- Create: `apps/web/server/api/mosques/[id]/people/[personId].delete.ts`

**Interfaces:**
- Consumes: `withAudit` (Module 7), `requireMosqueOwner` (Module 1).
- Produces:
  - `deletePerson(db: Database, mosqueId: string, personId: string, actorId: string): Promise<{ id: string }>` — sets `deletedAt`/`deletedBy`, throws 404 under the same conditions as `updatePerson` (wrong mosque, already deleted, or not found)

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/server/services/person.service.test.ts`:

```typescript
describe('deletePerson', () => {
  it('soft-deletes: sets deletedAt/deletedBy and excludes the row from listActivePeople', async () => {
    const mosque = await seedMosque();
    const created = await createPerson(db, mosque.id, { name: 'To Delete', phone: null }, 'actor-1');

    await deletePerson(db, mosque.id, created.id, 'actor-2');

    const [row] = await db.select().from(people).where(eq(people.id, created.id));
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.deletedBy).toBe('actor-2');
    expect((row?.history as unknown[]).length).toBe(2);

    const list = await listActivePeople(db, mosque.id);
    expect(list.find((p) => p.id === created.id)).toBeUndefined();
  });

  it('does not hard-delete the row — it remains queryable directly', async () => {
    const mosque = await seedMosque();
    const created = await createPerson(db, mosque.id, { name: 'Still There', phone: null }, 'actor-1');
    await deletePerson(db, mosque.id, created.id, 'actor-1');

    const [row] = await db.select().from(people).where(eq(people.id, created.id));
    expect(row).toBeDefined();
    expect(row?.name).toBe('Still There');
  });

  it('404s when already deleted', async () => {
    const mosque = await seedMosque();
    const created = await createPerson(db, mosque.id, { name: 'Double Delete', phone: null }, 'actor-1');
    await deletePerson(db, mosque.id, created.id, 'actor-1');

    await expect(deletePerson(db, mosque.id, created.id, 'actor-1')).rejects.toThrow();
  });
});
```

Add `deletePerson` to the existing import from `./person.service`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DATABASE_URL=<your dev db url> npm test -- person.service` (from `apps/web/`)
Expected: FAIL — `deletePerson` is not exported yet.

- [ ] **Step 3: Implement `deletePerson`**

Add to `apps/web/server/services/person.service.ts`:

```typescript
export async function deletePerson(
  db: Database,
  mosqueId: string,
  personId: string,
  actorId: string,
): Promise<{ id: string }> {
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

    const deletedAt = new Date();
    await tx.update(people).set({ deletedAt, deletedBy: actorId }).where(eq(people.id, personId));

    await withAudit(tx, {
      table: people,
      tableName: 'people',
      recordId: personId,
      action: 'DELETE',
      actorId,
      oldData: { name: person.name, phone: person.phone },
      newData: null,
      currentHistory: person.history as unknown[],
    });

    return { id: personId };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `DATABASE_URL=<your dev db url> npm test -- person.service` (from `apps/web/`)
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Create the route handler**

Create `apps/web/server/api/mosques/[id]/people/[personId].delete.ts`:

```typescript
import { deletePerson } from '../../../../services/person.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const personId = uuidSchema.parse(getRouterParam(event, 'personId'));
  const auth = await requireMosqueOwner(event, mosqueId);
  return await deletePerson(useDatabase(), mosqueId, personId, auth.sub);
});
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/services/person.service.ts apps/web/server/services/person.service.test.ts "apps/web/server/api/mosques/[id]/people/[personId].delete.ts"
git commit -m "feat: add Person soft-delete endpoint"
```

---

### Task 5: OpenAPI contract entries

**Files:**
- Modify: `apps/web/server/utils/openapi.ts`

**Interfaces:**
- Consumes: nothing new — fills in real request/response detail for the four `✚`-marked Person paths.
- Produces: nothing for other tasks; leaf documentation task.

- [ ] **Step 1: Update the OpenAPI document**

Add to `apps/web/server/utils/openapi.ts`'s `paths` object:

```typescript
'/mosques/{id}/people': {
  get: {
    summary: 'List active Person entries for a mosque',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: { '200': { description: 'Active Person rows, alphabetical' } },
  },
  post: {
    summary: 'Add a Person to a mosque',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: {
      '201': { description: 'Person created' },
      '403': { description: 'Caller does not own this mosque' },
    },
  },
},
'/mosques/{id}/people/{personId}': {
  patch: {
    summary: 'Update a Person',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      { name: 'personId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      '200': { description: 'Person updated' },
      '404': { description: 'Person not found for this mosque' },
    },
  },
  delete: {
    summary: 'Soft-delete a Person',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      { name: 'personId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      '200': { description: 'Person soft-deleted' },
      '404': { description: 'Person not found for this mosque' },
    },
  },
},
```

Leave every other entry in the file untouched.

- [ ] **Step 2: Verify the docs route still serves the file**

Run: `npm run dev` (from `apps/web/`), then: `curl -s http://localhost:3000/api/openapi.json | head -c 500`
Expected: valid JSON. Stop the dev server after checking.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/utils/openapi.ts
git commit -m "docs: fill in OpenAPI contract for Person endpoints"
```

---

## Self-Review Notes

- **Spec coverage:** §3.5's four endpoints map directly to Tasks 1–4. §2.2's "full CRUD, no inline auto-create" is satisfied by this plan existing at all as a standalone module — Module 6 (Friday Assignment, not yet planned) will consume `person_id` only, never accept a free-text name, which is a constraint on Module 6's plan to carry forward, not something this plan can enforce itself.
- **Placeholder scan:** no TBD/TODO; every step has real, runnable code.
- **Type consistency:** `Database` and `PersonSummary` are defined once in Task 1 and reused by every later task. The mosque-mismatch 404 (not 403) behavior in `updatePerson`/`deletePerson` is applied consistently in both functions' `WHERE` clauses (`eq(people.mosqueId, mosqueId)` is part of the existence check itself, not a separate check after fetching by id alone) — this was deliberate: filtering mosque ownership into the same query that determines "not found" means a Person under a different mosque is indistinguishable from a Person that doesn't exist at all, which is the correct behavior for not leaking cross-mosque existence.
- **DB-backed tests only:** like Module 7's plan and unlike Module 4's, every test here needs a real Postgres (`describe.runIf(Boolean(process.env.DATABASE_URL))`) because Person CRUD is inseparable from its transactional audit-writing behavior — the same justification used in Module 7's Task 3 worked example, which this module's Task 2 follows exactly.
- **Public vs. protected split:** `GET /mosques/:id/people` is public per the PRD §6 endpoint table (marked `Public`, not `Mosque Admin`) — double-checked against the table before writing Task 1's route handler, since every other Person endpoint requires `requireMosqueOwner`. This asymmetry (list open, writes locked) mirrors Module 4's mosque detail being public while Module 3's mosque edit is owner-only.
