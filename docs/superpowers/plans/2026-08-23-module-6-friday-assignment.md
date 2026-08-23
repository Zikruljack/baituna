# Module 6: Friday Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Mosque Admin assign Khatib/Imam/Muazzin for a specific upcoming Friday, let anyone read the current/next assignment and the full history, and enforce that a past Friday's entry is permanently read-only.

**Architecture:** Nitro routes under `apps/web/server/api/mosques/[id]/friday-schedule/` handle HTTP only; all logic lives in `server/services/friday-assignment.service.ts`, which already exists as an empty reserved stub. A pure date-math module (`server/utils/wib-date.ts`) computes "this or next Friday" and "is this date in the past" against Asia/Jakarta (WIB, UTC+7, no DST — a fixed offset, so no timezone library is needed) with zero database access, so it's exhaustively unit-testable. Every write (`POST`, `PATCH`) validates that `person_id` values belong to the same mosque (Module 5) and goes through `withAudit` (Module 7) in the same transaction. Ownership checks reuse `requireMosqueOwner` (Module 1).

**Tech Stack:** Nuxt 4 / Nitro, TypeScript (strict), Drizzle ORM + PostgreSQL, Zod 4, Vitest 4. No new dependencies — WIB's fixed UTC+7 offset (Indonesia abolished DST decades ago) makes a timezone library unnecessary; plain `Date` arithmetic is exact and simpler to audit.

**Spec:** `docs/superpowers/specs/2026-08-23-baituna-modules-design.md` (this plan implements §3.6). Background: `docs/baituna-prd.md` §4.2; `docs/baituna-erd.md` §6.1 (`friday_assignments` entity, unique `(mosque_id, assignment_date)`).

**Depends on:** Module 1 (Auth & RBAC — `requireMosqueOwner`), Module 5 (Person — Person rows to validate `person_id` against), and Module 7 (Audit Log — `withAudit`). All three already implemented in this repo as of 2026-08-23 (Module 5's plan is written but its code may not be merged yet — Task 3 below reads Person rows directly via Drizzle rather than importing Module 5's service functions, so it does not hard-depend on Module 5's service file existing, only on the `people` table, which is already in `schema.ts`).

## Global Constraints

These apply to every task. Copied from the spec, the PRD, and the repo's existing conventions.

- **One entry = one mosque + one specific Friday date.** Never an "overwrite current" model. The DB's `unique(mosque_id, assignment_date)` constraint (already in `schema.ts`) is the backstop; the service layer must also pre-check and return a clean 409, not let a raw constraint violation leak to the client. (PRD §4.2, Spec §3.6)
- **`assignment_date` must be a Friday.** Reject any other weekday with 422. (Spec §3.6)
- **A past `assignment_date` is permanently read-only.** No create, update, or delete may target a date before "today" in WIB. `PATCH` on a past-dated entry returns 403, not 404 or 422 — the entry exists and is visible, it's specifically forbidden to change. (Spec §3.6, PRD §4.2)
- **All "current/next Friday" and "is this past" logic uses Asia/Jakarta (WIB, UTC+7) consistently, computed on the server.** The transition to the next Friday happens at 00:00 WIB the day after the current Friday, not at the client's local midnight. (Spec §3.6, PRD §4.2)
- **`current` never 404s on empty state.** With no assignment for the upcoming Friday, it returns `{ has_assignment: false, assignment_date: <next Friday's date> }` — HTTP 200, not 404 and not an empty body. (PRD §4.2)
- **Every `person_id` submitted must belong to the same mosque as the assignment.** Cross-mosque Person ids are rejected with 422, checked before any write. (Spec §3.6)
- **Ownership is per-mosque, not per-role.** The write endpoints use `requireMosqueOwner`, comparing `mosques.admin_user_id` to the caller — never a bare role check. (Spec §3.3, ERD §6.3, reused unchanged from Modules 3 and 5)
- **Every write goes through `withAudit`, in the same transaction as the business write.**
- **Never write business logic in route handlers.**
- **TypeScript is strict.** No `any`. No non-null assertions (`!`) on values that can genuinely be null.
- **Commit messages follow Conventional Commits** (`feat:`, `test:`, `chore:`, `docs:`) — commitlint + husky enforce this on commit.
- **Every command in this plan runs from `apps/web/`** unless stated otherwise.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/server/utils/wib-date.ts` | Pure WIB date math — current/next Friday, past-check, weekday-check | 1 |
| `apps/web/server/utils/wib-date.test.ts` | Tests for the above | 1 |
| `apps/web/server/services/friday-assignment.service.ts` | Create/update/current/history, replaces the empty stub | 2, 3, 4, 5 |
| `apps/web/server/services/friday-assignment.service.test.ts` | Tests for the above | 2, 3, 4, 5 |
| `apps/web/server/utils/validation.ts` | Add `createAssignmentSchema`, `updateAssignmentSchema` | 2, 3 |
| `apps/web/server/api/mosques/[id]/friday-schedule/index.post.ts` | `POST /api/mosques/:id/friday-schedule` | 2 |
| `apps/web/server/api/mosques/[id]/friday-schedule/[assignmentId].patch.ts` | `PATCH /api/mosques/:id/friday-schedule/:assignmentId` | 3 |
| `apps/web/server/api/mosques/[id]/friday-schedule/current.get.ts` | `GET /api/mosques/:id/friday-schedule/current` | 4 |
| `apps/web/server/api/mosques/[id]/friday-schedule/history.get.ts` | `GET /api/mosques/:id/friday-schedule/history` | 5 |
| `apps/web/server/utils/openapi.ts` | Fill in real request/response detail for these four routes | 6 |

**Why WIB date math is its own file:** it's the one part of this module with real logic bugs waiting to happen (off-by-one on the WIB/UTC boundary, "next Friday" edge cases at exactly midnight). Isolating it as pure functions with no DB access means it can be tested exhaustively and fast, matching how `password.ts`/`token.ts` were isolated in Module 1 for the same reason.

---

### Task 1: WIB date math

**Files:**
- Create: `apps/web/server/utils/wib-date.ts`
- Test: `apps/web/server/utils/wib-date.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `WIB_OFFSET_MS` — exported constant, `7 * 60 * 60 * 1000`
  - `toWibDate(date: Date): Date` — returns a `Date` object whose UTC fields represent the wall-clock time in WIB (a common trick: shift by the offset, then read UTC getters as if they were WIB getters)
  - `isFriday(isoDate: string): boolean` — `isoDate` is a `YYYY-MM-DD` string (the shape Postgres `date` columns round-trip as through `pg`/Drizzle); true if that calendar date is a Friday
  - `getCurrentOrNextFridayWib(now: Date): string` — returns the `YYYY-MM-DD` of today (WIB) if today is a Friday, else the next upcoming Friday, computed against `now`'s WIB wall-clock date
  - `isPastWib(isoDate: string, now: Date): boolean` — true if `isoDate` (a calendar date, no time component) is strictly before "today" in WIB, where "today" flips at 00:00 WIB

- [ ] **Step 1: Write the failing tests**

Create `apps/web/server/utils/wib-date.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { getCurrentOrNextFridayWib, isFriday, isPastWib } from './wib-date';

describe('isFriday', () => {
  it('identifies a known Friday', () => {
    // 2026-08-21 is a Friday.
    expect(isFriday('2026-08-21')).toBe(true);
  });

  it('rejects a known non-Friday', () => {
    // 2026-08-22 is a Saturday.
    expect(isFriday('2026-08-22')).toBe(false);
  });
});

describe('getCurrentOrNextFridayWib', () => {
  it('returns today when today is already Friday in WIB', () => {
    // 2026-08-21 10:00 WIB = 2026-08-21 03:00Z, still Friday in WIB.
    const now = new Date('2026-08-21T03:00:00Z');
    expect(getCurrentOrNextFridayWib(now)).toBe('2026-08-21');
  });

  it('rolls over to next Friday right after Friday ends in WIB (00:00 WIB boundary)', () => {
    // 2026-08-22 00:00 WIB = 2026-08-21 17:00Z — Friday has just ended in WIB.
    const now = new Date('2026-08-21T17:00:00Z');
    expect(getCurrentOrNextFridayWib(now)).toBe('2026-08-28');
  });

  it('handles a UTC date that has already rolled to Friday, but WIB has not yet', () => {
    // 2026-08-21 00:30Z = 2026-08-21 07:30 WIB — Friday in both, no ambiguity case;
    // this test instead covers the inverse: UTC still Thursday, WIB already Friday.
    // 2026-08-20 18:00Z = 2026-08-21 01:00 WIB — Friday in WIB, Thursday in UTC.
    const now = new Date('2026-08-20T18:00:00Z');
    expect(getCurrentOrNextFridayWib(now)).toBe('2026-08-21');
  });

  it('finds the next Friday from a mid-week date', () => {
    // 2026-08-19 is a Wednesday.
    const now = new Date('2026-08-19T03:00:00Z');
    expect(getCurrentOrNextFridayWib(now)).toBe('2026-08-21');
  });
});

describe('isPastWib', () => {
  it('treats a date before WIB-today as past', () => {
    const now = new Date('2026-08-21T03:00:00Z'); // 2026-08-21 10:00 WIB
    expect(isPastWib('2026-08-20', now)).toBe(true);
  });

  it('treats WIB-today itself as not past', () => {
    const now = new Date('2026-08-21T03:00:00Z'); // 2026-08-21 10:00 WIB
    expect(isPastWib('2026-08-21', now)).toBe(false);
  });

  it('treats a future date as not past', () => {
    const now = new Date('2026-08-21T03:00:00Z');
    expect(isPastWib('2026-08-28', now)).toBe(false);
  });

  it('flips at exactly 00:00 WIB, not 00:00 UTC', () => {
    // 2026-08-22 00:00 WIB = 2026-08-21 17:00Z. At this instant, 2026-08-21 is now past.
    const now = new Date('2026-08-21T17:00:00Z');
    expect(isPastWib('2026-08-21', now)).toBe(true);
    // One second earlier it was still WIB-today, not past.
    const justBefore = new Date('2026-08-21T16:59:59Z');
    expect(isPastWib('2026-08-21', justBefore)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- wib-date` (from `apps/web/`)
Expected: FAIL — `wib-date.ts` does not exist yet.

- [ ] **Step 3: Implement the date math**

Create `apps/web/server/utils/wib-date.ts`:

```typescript
export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Shifts a Date by the WIB offset so its UTC getters read as WIB wall-clock
 * fields. Indonesia's western zone (WIB) has been a fixed UTC+7 with no DST
 * since 1988, so a constant offset is exact — no timezone library needed.
 */
export function toWibDate(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses a `YYYY-MM-DD` string as a UTC midnight Date (no time component). */
function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isFriday(isoDate: string): boolean {
  return parseIsoDate(isoDate).getUTCDay() === 5;
}

/**
 * Returns today's date (WIB) if today is Friday, otherwise the next
 * upcoming Friday — both as `YYYY-MM-DD`. The WIB "today" is derived by
 * shifting `now` into WIB wall-clock time before reading its date fields,
 * so the rollover happens at 00:00 WIB, not 00:00 UTC or the caller's zone.
 */
export function getCurrentOrNextFridayWib(now: Date): string {
  const wibNow = toWibDate(now);
  const wibToday = new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()));
  const currentDay = wibToday.getUTCDay();
  const daysUntilFriday = (5 - currentDay + 7) % 7;

  const target = new Date(wibToday);
  target.setUTCDate(target.getUTCDate() + daysUntilFriday);

  return toIsoDate(target);
}

/**
 * True when `isoDate` is strictly before WIB-today, where WIB-today is
 * derived from `now` the same way `getCurrentOrNextFridayWib` does — so
 * the two functions agree on exactly when "today" changes.
 */
export function isPastWib(isoDate: string, now: Date): boolean {
  const wibNow = toWibDate(now);
  const wibToday = new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()));
  const target = parseIsoDate(isoDate);

  return target.getTime() < wibToday.getTime();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- wib-date` (from `apps/web/`)
Expected: PASS, all 11 tests. Pay particular attention to the "flips at exactly 00:00 WIB" test — this is the case most likely to reveal an off-by-one if the offset arithmetic is wrong.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/utils/wib-date.ts apps/web/server/utils/wib-date.test.ts
git commit -m "feat: add WIB-timezone Friday date math"
```

---

### Task 2: Create assignment

**Files:**
- Modify: `apps/web/server/services/friday-assignment.service.ts` (replace the `export const fridayAssignmentService = {};` stub)
- Test: `apps/web/server/services/friday-assignment.service.test.ts`
- Modify: `apps/web/server/utils/validation.ts`
- Create: `apps/web/server/api/mosques/[id]/friday-schedule/index.post.ts`

**Interfaces:**
- Consumes: `isFriday`, `isPastWib` (Task 1), `withAudit` (Module 7), `requireMosqueOwner` (Module 1), `people` table (`drizzle/schema.ts`).
- Produces:
  - `Database` — `NodePgDatabase<typeof schema>` type alias, exported for later tasks
  - `AssignmentInput` — `{ assignmentDate: string; khatibPersonId: string | null; imamPersonId: string | null; muazzinPersonId: string | null }`
  - `AssignmentRecord` — `AssignmentInput & { id: string; mosqueId: string }`
  - `createAssignmentSchema` (Zod) — `assignmentDate` as `YYYY-MM-DD` regex-validated string, the three person-id fields as `uuidSchema.nullable()`, at least one of the three non-null
  - `createAssignment(db: Database, mosqueId: string, input: AssignmentInput, actorId: string): Promise<AssignmentRecord>` — validates: date is a Friday (422), date is not in the past (422 — a *past* Friday can never be created fresh either, since it could never have been assigned in advance), no existing row for `(mosqueId, assignmentDate)` (409, pre-checked to give a clean error instead of surfacing the DB unique-constraint violation), every non-null person id belongs to `mosqueId` (422)

- [ ] **Step 1: Write the failing tests**

Create `apps/web/server/services/friday-assignment.service.test.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { cities, fridayAssignments, mosques, people, provinces } from '../../drizzle/schema';
import { createAssignment } from './friday-assignment.service';

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('friday-assignment.service', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  async function seedMosqueWithPerson() {
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
    const [person] = await db.insert(people).values({ mosqueId: mosque.id, name: 'Khatib Test', phone: null }).returning();
    if (!person) throw new Error('person insert failed');
    return { mosque, person };
  }

  describe('createAssignment', () => {
    it('creates an assignment for a valid future Friday', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      // A far-future Friday so this test never becomes a "past date" failure.
      const result = await createAssignment(
        db,
        mosque.id,
        { assignmentDate: '2099-01-02', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null },
        'actor-1',
      );

      expect(result.assignmentDate).toBe('2099-01-02');
      const [row] = await db.select().from(fridayAssignments).where(eq(fridayAssignments.id, result.id));
      expect((row?.history as unknown[]).length).toBe(1);
    });

    it('rejects a non-Friday date', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      // 2099-01-03 is a Saturday.
      await expect(
        createAssignment(db, mosque.id, { assignmentDate: '2099-01-03', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, 'actor-1'),
      ).rejects.toThrow();
    });

    it('rejects a Person id that belongs to a different mosque', async () => {
      const { mosque } = await seedMosqueWithPerson();
      const { person: foreignPerson } = await seedMosqueWithPerson();

      await expect(
        createAssignment(db, mosque.id, { assignmentDate: '2099-01-09', khatibPersonId: foreignPerson.id, imamPersonId: null, muazzinPersonId: null }, 'actor-1'),
      ).rejects.toThrow();
    });

    it('rejects a duplicate (mosque, date) pair with a clean error', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      await createAssignment(db, mosque.id, { assignmentDate: '2099-01-16', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, 'actor-1');

      await expect(
        createAssignment(db, mosque.id, { assignmentDate: '2099-01-16', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, 'actor-1'),
      ).rejects.toThrow();
    });

    it('rejects a past Friday', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      await expect(
        createAssignment(db, mosque.id, { assignmentDate: '2020-01-03', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, 'actor-1'),
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DATABASE_URL=<your dev db url> npm test -- friday-assignment.service` (from `apps/web/`)
Expected: FAIL — `createAssignment` is not exported yet.

- [ ] **Step 3: Add the validation schema**

Add to `apps/web/server/utils/validation.ts`:

```typescript
export const createAssignmentSchema = z
  .object({
    assignmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    khatibPersonId: uuidSchema.nullable().default(null),
    imamPersonId: uuidSchema.nullable().default(null),
    muazzinPersonId: uuidSchema.nullable().default(null),
  })
  .refine((data) => data.khatibPersonId || data.imamPersonId || data.muazzinPersonId, {
    message: 'At least one of khatibPersonId, imamPersonId, muazzinPersonId is required',
  });
```

- [ ] **Step 4: Implement `createAssignment`**

Replace the contents of `apps/web/server/services/friday-assignment.service.ts`:

```typescript
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `DATABASE_URL=<your dev db url> npm test -- friday-assignment.service` (from `apps/web/`)
Expected: PASS, all 5 tests.

- [ ] **Step 6: Create the route handler**

Create `apps/web/server/api/mosques/[id]/friday-schedule/index.post.ts`:

```typescript
import { createAssignment } from '../../../../services/friday-assignment.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { createAssignmentSchema, parseBody, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const auth = await requireMosqueOwner(event, mosqueId);
  const input = await parseBody(event, createAssignmentSchema);
  return await createAssignment(useDatabase(), mosqueId, input, auth.sub);
});
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/services/friday-assignment.service.ts apps/web/server/services/friday-assignment.service.test.ts apps/web/server/utils/validation.ts "apps/web/server/api/mosques/[id]/friday-schedule/index.post.ts"
git commit -m "feat: add Friday assignment create endpoint"
```

---

### Task 3: Update assignment — rejects past dates

**Files:**
- Modify: `apps/web/server/services/friday-assignment.service.ts`
- Modify: `apps/web/server/services/friday-assignment.service.test.ts`
- Modify: `apps/web/server/utils/validation.ts`
- Create: `apps/web/server/api/mosques/[id]/friday-schedule/[assignmentId].patch.ts`

**Interfaces:**
- Consumes: `isPastWib` (Task 1), `withAudit` (Module 7), `assertPersonIdsBelongToMosque` (Task 2, internal helper — not exported, reused within the same file).
- Produces:
  - `updateAssignmentSchema` (Zod) — `{ khatibPersonId?: string | null; imamPersonId?: string | null; muazzinPersonId?: string | null }`, at least one field present (does not allow changing `assignmentDate` — correcting the date means creating a new entry, not moving an existing one)
  - `updateAssignment(db: Database, mosqueId: string, assignmentId: string, updates: Partial<{ khatibPersonId: string | null; imamPersonId: string | null; muazzinPersonId: string | null }>, actorId: string): Promise<AssignmentRecord>` — 404 if not found or wrong mosque, 403 if `assignment_date` is in the past (per the Global Constraints: this is a permission-shaped rejection, not a validation error), 422 if any person id doesn't belong to the mosque

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/server/services/friday-assignment.service.test.ts`, inside the existing `describe.runIf(RUN_DB_TESTS)` block:

```typescript
describe('updateAssignment', () => {
  it('updates person assignments for a future Friday', async () => {
    const { mosque, person } = await seedMosqueWithPerson();
    const created = await createAssignment(
      db, mosque.id,
      { assignmentDate: '2099-01-23', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null },
      'actor-1',
    );
    const [secondPerson] = await db.insert(people).values({ mosqueId: mosque.id, name: 'Imam Baru', phone: null }).returning();
    if (!secondPerson) throw new Error('person insert failed');

    const result = await updateAssignment(db, mosque.id, created.id, { imamPersonId: secondPerson.id }, 'actor-2');
    expect(result.imamPersonId).toBe(secondPerson.id);

    const [row] = await db.select().from(fridayAssignments).where(eq(fridayAssignments.id, created.id));
    expect((row?.history as unknown[]).length).toBe(2);
  });

  it('403s when the assignment date has already passed', async () => {
    const { mosque, person } = await seedMosqueWithPerson();
    // Insert a past-dated row directly — createAssignment itself refuses to
    // create past dates, so a past row can only exist from data created
    // before "today" moved past it. Direct insert simulates that state.
    const [pastRow] = await db
      .insert(fridayAssignments)
      .values({ mosqueId: mosque.id, assignmentDate: '2020-01-03', khatibPersonId: person.id, createdBy: 'actor-1' })
      .returning();
    if (!pastRow) throw new Error('assignment insert failed');

    await expect(updateAssignment(db, mosque.id, pastRow.id, { khatibPersonId: null }, 'actor-1')).rejects.toThrow();
  });

  it('404s when the assignment belongs to a different mosque', async () => {
    const { mosque: mosqueA, person } = await seedMosqueWithPerson();
    const { mosque: mosqueB } = await seedMosqueWithPerson();
    const created = await createAssignment(
      db, mosqueA.id,
      { assignmentDate: '2099-01-30', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null },
      'actor-1',
    );

    await expect(updateAssignment(db, mosqueB.id, created.id, { khatibPersonId: null }, 'actor-1')).rejects.toThrow();
  });
});
```

Add `updateAssignment` to the existing import from `./friday-assignment.service`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DATABASE_URL=<your dev db url> npm test -- friday-assignment.service` (from `apps/web/`)
Expected: FAIL — `updateAssignment` is not exported yet.

- [ ] **Step 3: Add the validation schema**

Add to `apps/web/server/utils/validation.ts`:

```typescript
export const updateAssignmentSchema = z
  .object({
    khatibPersonId: uuidSchema.nullable().optional(),
    imamPersonId: uuidSchema.nullable().optional(),
    muazzinPersonId: uuidSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
```

- [ ] **Step 4: Implement `updateAssignment`**

Add to `apps/web/server/services/friday-assignment.service.ts`:

```typescript
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
```

`assertPersonIdsBelongToMosque` (defined in Task 2, same file) must accept a transaction handle, not just a plain `Database`, since Task 3 calls it with `tx`. Confirm its parameter type (`db: Database`) is structurally compatible with the `tx` passed into `db.transaction(async (tx) => ...)` — Drizzle's transaction type is a subtype of `NodePgDatabase`, so this is expected to type-check without changes. If it does not, widen `assertPersonIdsBelongToMosque`'s parameter type to accept both, matching how Module 3's plan handled the same question for `upgradeToMosqueAdmin`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `DATABASE_URL=<your dev db url> npm test -- friday-assignment.service` (from `apps/web/`)
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 6: Create the route handler**

Create `apps/web/server/api/mosques/[id]/friday-schedule/[assignmentId].patch.ts`:

```typescript
import { updateAssignment } from '../../../../services/friday-assignment.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { parseBody, updateAssignmentSchema, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const assignmentId = uuidSchema.parse(getRouterParam(event, 'assignmentId'));
  const auth = await requireMosqueOwner(event, mosqueId);
  const updates = await parseBody(event, updateAssignmentSchema);
  return await updateAssignment(useDatabase(), mosqueId, assignmentId, updates, auth.sub);
});
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/services/friday-assignment.service.ts apps/web/server/services/friday-assignment.service.test.ts apps/web/server/utils/validation.ts "apps/web/server/api/mosques/[id]/friday-schedule/[assignmentId].patch.ts"
git commit -m "feat: add Friday assignment update endpoint with past-date lock"
```

---

### Task 4: Current (or next) assignment — public, empty-state aware

**Files:**
- Modify: `apps/web/server/services/friday-assignment.service.ts`
- Modify: `apps/web/server/services/friday-assignment.service.test.ts`
- Create: `apps/web/server/api/mosques/[id]/friday-schedule/current.get.ts`

**Interfaces:**
- Consumes: `getCurrentOrNextFridayWib` (Task 1).
- Produces:
  - `CurrentAssignment` — either `{ has_assignment: true; id: string; assignmentDate: string; khatibPersonId: string | null; imamPersonId: string | null; muazzinPersonId: string | null }` or `{ has_assignment: false; assignment_date: string }`
  - `getCurrentAssignment(db: Database, mosqueId: string, now: Date): Promise<CurrentAssignment>` — looks up the row for `getCurrentOrNextFridayWib(now)`; returns the empty-state shape if none exists, never throws for "no assignment yet"

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/server/services/friday-assignment.service.test.ts`:

```typescript
describe('getCurrentAssignment', () => {
  it('returns has_assignment: false with the next Friday date when nothing is scheduled', async () => {
    const { mosque } = await seedMosqueWithPerson();
    // Fixed "now" so the expected next-Friday date is deterministic in this test.
    const now = new Date('2026-08-19T03:00:00Z'); // Wednesday in WIB

    const result = await getCurrentAssignment(db, mosque.id, now);
    expect(result).toEqual({ has_assignment: false, assignment_date: '2026-08-21' });
  });

  it('returns the assignment when one exists for the current/next Friday', async () => {
    const { mosque, person } = await seedMosqueWithPerson();
    await createAssignment(
      db, mosque.id,
      { assignmentDate: '2099-02-06', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null },
      'actor-1',
    );
    const now = new Date('2099-02-03T03:00:00Z'); // Tuesday before that Friday

    const result = await getCurrentAssignment(db, mosque.id, now);
    expect(result.has_assignment).toBe(true);
    if (result.has_assignment) {
      expect(result.assignmentDate).toBe('2099-02-06');
      expect(result.khatibPersonId).toBe(person.id);
    }
  });
});
```

Add `getCurrentAssignment` to the existing import from `./friday-assignment.service`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL=<your dev db url> npm test -- friday-assignment.service` (from `apps/web/`)
Expected: FAIL — `getCurrentAssignment` is not exported yet.

- [ ] **Step 3: Implement `getCurrentAssignment`**

Add to `apps/web/server/services/friday-assignment.service.ts`:

```typescript
import { getCurrentOrNextFridayWib } from '../utils/wib-date';
```

```typescript
export type CurrentAssignment =
  | {
      has_assignment: true;
      id: string;
      assignmentDate: string;
      khatibPersonId: string | null;
      imamPersonId: string | null;
      muazzinPersonId: string | null;
    }
  | { has_assignment: false; assignment_date: string };

export async function getCurrentAssignment(
  db: Database,
  mosqueId: string,
  now: Date,
): Promise<CurrentAssignment> {
  const targetDate = getCurrentOrNextFridayWib(now);

  const rows = await db
    .select()
    .from(fridayAssignments)
    .where(
      and(
        eq(fridayAssignments.mosqueId, mosqueId),
        eq(fridayAssignments.assignmentDate, targetDate),
        isNull(fridayAssignments.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { has_assignment: false, assignment_date: targetDate };
  }

  return {
    has_assignment: true,
    id: row.id,
    assignmentDate: row.assignmentDate,
    khatibPersonId: row.khatibPersonId,
    imamPersonId: row.imamPersonId,
    muazzinPersonId: row.muazzinPersonId,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `DATABASE_URL=<your dev db url> npm test -- friday-assignment.service` (from `apps/web/`)
Expected: PASS, all tests including the 2 new ones.

- [ ] **Step 5: Create the route handler**

Create `apps/web/server/api/mosques/[id]/friday-schedule/current.get.ts`:

```typescript
import { getCurrentAssignment } from '../../../../services/friday-assignment.service';
import { uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  return await getCurrentAssignment(useDatabase(), mosqueId, new Date());
});
```

This route is public per the PRD §6 endpoint table (`GET /mosques/:id/friday-schedule/current` — access `Public`) — no auth guard.

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/services/friday-assignment.service.ts apps/web/server/services/friday-assignment.service.test.ts "apps/web/server/api/mosques/[id]/friday-schedule/current.get.ts"
git commit -m "feat: add current/next Friday assignment endpoint"
```

---

### Task 5: History — public, paginated

**Files:**
- Modify: `apps/web/server/services/friday-assignment.service.ts`
- Modify: `apps/web/server/services/friday-assignment.service.test.ts`
- Modify: `apps/web/server/utils/validation.ts`
- Create: `apps/web/server/api/mosques/[id]/friday-schedule/history.get.ts`

**Interfaces:**
- Consumes: nothing new from earlier tasks beyond `Database`/`AssignmentRecord`/`fridayAssignments` already imported into the service file.
- Produces:
  - `historyQuerySchema` (Zod) — `{ page: number (default 1, min 1); pageSize: number (default 20, min 1, max 100) }`, both coerced from query-string values
  - `PaginatedAssignments` — `{ items: AssignmentRecord[]; page: number; pageSize: number; total: number }`
  - `listAssignmentHistory(db: Database, mosqueId: string, params: { page: number; pageSize: number }): Promise<PaginatedAssignments>` — all non-deleted assignments for the mosque, newest `assignmentDate` first, paginated

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/server/services/friday-assignment.service.test.ts`:

```typescript
describe('listAssignmentHistory', () => {
  it('returns assignments newest-first with pagination metadata', async () => {
    const { mosque, person } = await seedMosqueWithPerson();
    await createAssignment(db, mosque.id, { assignmentDate: '2099-03-06', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, 'actor-1');
    await createAssignment(db, mosque.id, { assignmentDate: '2099-03-13', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, 'actor-1');

    const result = await listAssignmentHistory(db, mosque.id, { page: 1, pageSize: 20 });

    expect(result.total).toBeGreaterThanOrEqual(2);
    const dates = result.items.map((a) => a.assignmentDate);
    expect(dates.indexOf('2099-03-13')).toBeLessThan(dates.indexOf('2099-03-06'));
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('respects page size and page number', async () => {
    const { mosque, person } = await seedMosqueWithPerson();
    for (const date of ['2099-04-03', '2099-04-10', '2099-04-17']) {
      await createAssignment(db, mosque.id, { assignmentDate: date, khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, 'actor-1');
    }

    const firstPage = await listAssignmentHistory(db, mosque.id, { page: 1, pageSize: 2 });
    expect(firstPage.items).toHaveLength(2);

    const secondPage = await listAssignmentHistory(db, mosque.id, { page: 2, pageSize: 2 });
    expect(secondPage.items.length).toBeGreaterThanOrEqual(1);
  });
});
```

Add `listAssignmentHistory` to the existing import from `./friday-assignment.service`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DATABASE_URL=<your dev db url> npm test -- friday-assignment.service` (from `apps/web/`)
Expected: FAIL — `listAssignmentHistory` is not exported yet.

- [ ] **Step 3: Add the validation schema**

Add to `apps/web/server/utils/validation.ts`:

```typescript
export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

- [ ] **Step 4: Implement `listAssignmentHistory`**

Add to `apps/web/server/services/friday-assignment.service.ts`:

```typescript
import { count, desc } from 'drizzle-orm';
```

(merge with the existing `drizzle-orm` import in this file rather than duplicating the line)

```typescript
export interface PaginatedAssignments {
  items: AssignmentRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listAssignmentHistory(
  db: Database,
  mosqueId: string,
  params: { page: number; pageSize: number },
): Promise<PaginatedAssignments> {
  const whereClause = and(eq(fridayAssignments.mosqueId, mosqueId), isNull(fridayAssignments.deletedAt));

  const [totalRow] = await db.select({ value: count() }).from(fridayAssignments).where(whereClause);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select()
    .from(fridayAssignments)
    .where(whereClause)
    .orderBy(desc(fridayAssignments.assignmentDate))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    items: rows.map((row) => ({
      id: row.id,
      mosqueId: row.mosqueId,
      assignmentDate: row.assignmentDate,
      khatibPersonId: row.khatibPersonId,
      imamPersonId: row.imamPersonId,
      muazzinPersonId: row.muazzinPersonId,
    })),
    page: params.page,
    pageSize: params.pageSize,
    total,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `DATABASE_URL=<your dev db url> npm test -- friday-assignment.service` (from `apps/web/`)
Expected: PASS, all tests including the 2 new ones.

- [ ] **Step 6: Create the route handler**

Create `apps/web/server/api/mosques/[id]/friday-schedule/history.get.ts`:

```typescript
import { listAssignmentHistory } from '../../../../services/friday-assignment.service';
import { historyQuerySchema, parseQuery, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const query = await parseQuery(event, historyQuerySchema);
  return await listAssignmentHistory(useDatabase(), mosqueId, query);
});
```

`parseQuery` is added to `server/utils/validation.ts` by Module 4's Task 1. If Module 4 has not been implemented yet when this task runs, add it here instead (it's a small, self-contained addition — check `server/utils/validation.ts` first; do not add it twice):

```typescript
export async function parseQuery<T>(event: Parameters<typeof getQuery>[0], schema: ZodType<T>) {
  return await getValidatedQuery(event, (query) => schema.parse(query));
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/services/friday-assignment.service.ts apps/web/server/services/friday-assignment.service.test.ts apps/web/server/utils/validation.ts "apps/web/server/api/mosques/[id]/friday-schedule/history.get.ts"
git commit -m "feat: add paginated Friday assignment history endpoint"
```

---

### Task 6: OpenAPI contract entries

**Files:**
- Modify: `apps/web/server/utils/openapi.ts`

**Interfaces:**
- Consumes: nothing new — fills in real detail for four paths, three already present as bare stubs (`/mosques/{id}/friday-schedule/current`, `/mosques/{id}/friday-schedule/history`, `/mosques/{id}/friday-schedule`) plus one `✚`-marked addition (`PATCH /mosques/{id}/friday-schedule/{assignmentId}`).
- Produces: nothing for other tasks; leaf documentation task.

- [ ] **Step 1: Update the OpenAPI document**

Modify `apps/web/server/utils/openapi.ts`:

```typescript
'/mosques/{id}/friday-schedule/current': {
  get: {
    summary: 'Get this or next Friday assignment',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: {
      '200': { description: 'Either an assignment or { has_assignment: false, assignment_date }' },
    },
  },
},
'/mosques/{id}/friday-schedule/history': {
  get: {
    summary: 'Get paginated Friday assignment history',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
      { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', default: 20 } },
    ],
    responses: { '200': { description: 'Paginated assignments, newest first' } },
  },
},
'/mosques/{id}/friday-schedule': {
  post: {
    summary: 'Create a Friday assignment',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: {
      '201': { description: 'Assignment created' },
      '409': { description: 'An assignment already exists for this date' },
      '422': { description: 'Not a Friday, in the past, or an unknown person id' },
    },
  },
},
'/mosques/{id}/friday-schedule/{assignmentId}': {
  patch: {
    summary: 'Update a Friday assignment (future dates only)',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      { name: 'assignmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      '200': { description: 'Assignment updated' },
      '403': { description: 'This assignment date has already passed' },
      '404': { description: 'Assignment not found for this mosque' },
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
git commit -m "docs: fill in OpenAPI contract for Friday assignment endpoints"
```

---

## Self-Review Notes

- **Spec coverage:** §3.6's rules map one-to-one to tasks: unique `(mosque_id, assignment_date)` pre-check → Task 2; Friday-only → Task 2; past-date lock on updates → Task 3; `current` empty-state shape → Task 4; WIB-consistent date math → Task 1, consumed everywhere; `person_id` same-mosque check → Task 2's `assertPersonIdsBelongToMosque`, reused by Task 3. PRD §4.2's "past entries read-only, can only add new entries for next week" is enforced at exactly one layer (service, not route) so it can't be bypassed by a different route calling the service incorrectly.
- **Placeholder scan:** no TBD/TODO; every step has real, runnable code.
- **Type consistency:** `Database`, `AssignmentInput`, `AssignmentRecord` are defined once in Task 2 and reused unchanged through Tasks 3–5. `CurrentAssignment`'s discriminated union (`has_assignment: true | false`) is deliberately snake_case on the `false` branch's `assignment_date` field and camelCase everywhere else — this matches PRD §4.2's literal example payload (`{ has_assignment: false, assignment_date: <tanggal Jumat berikutnya> }`) verbatim, so it is not a typo; flagged here so a reviewer doesn't "fix" it into `assignmentDate` and break the documented contract.
- **WIB correctness is the highest-risk part of this plan** — Task 1 isolates it as pure functions specifically so it gets the most exhaustive test coverage in the plan (11 tests for ~50 lines of logic), including the exact-midnight boundary case, before any service code depends on it. `createAssignment` and `updateAssignment` both call `isPastWib`/`isFriday` from Task 1 rather than reimplementing date logic — single source of truth.
- **Cross-module soft dependency called out explicitly:** the header notes Module 6 does not import Module 5's `person.service.ts` functions (querying `people` directly via Drizzle instead), so this plan's tasks do not block on Module 5's code being merged — only on the `people` table existing in `schema.ts`, which it already does.
