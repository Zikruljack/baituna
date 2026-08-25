# UI Module 6: Friday Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Jadwal Jumat" tab of the Mosque Admin management page (`/admin/masjid/[id]`) — view the current/next Friday assignment, create or edit it (Khatib/Imam/Muazzin picked from the mosque's Person roster), and browse paginated history — wired to the already-implemented Module 6 backend (`server/services/friday-assignment.service.ts`).

**Architecture:** `apps/web/pages/admin/masjid/[id].vue` is a **shared file** owned by the UI Module 5 (Person) plan (`docs/superpowers/plans/2026-08-25-ui-module-5-person.md`). That plan creates the page shell: `middleware: ['auth', 'require-role']` with `requiredRoles: ['mosque_admin', 'super_admin']`, the mosque-ownership check (redirect non-owners to `/masjid/[id]`), the `Tabs` wrapper with a "Person" `TabsTrigger`/`TabsContent`, and a second `TabsTrigger` labeled "Jadwal Jumat" whose `TabsContent` is left as a placeholder comment for this plan to fill in. **This plan does not touch the middleware, the ownership check, or the `Tabs` wrapper** — Task 4 below reads the file as it exists on disk and inserts the Jadwal Jumat `TabsContent` block at the marked location. If `apps/web/pages/admin/masjid/[id].vue` does not exist yet when this plan is executed, **stop and treat it as a blocker** — do not create a competing page shell; wait for the Module 5 UI plan to run first, or coordinate with whoever is executing it.

A pure-JS Friday-date-math module (`apps/web/lib/wib-date-client.ts`) is added as a client-safe copy of `apps/web/server/utils/wib-date.ts`'s three functions. It is **not** a direct import of the server file: files under `apps/web/server/utils/` are part of Nitro's server-only auto-import scope, and importing one into client-bundled code (composables, `.vue` files) is not a supported Nuxt pattern even though this particular file has zero server-only calls — the safe move is a small, exactly-mirrored copy, tested with the identical test cases already proven against the server version.

The `CurrentAssignment` shape returned by `GET .../friday-schedule/current` is a discriminated union with a **deliberately inconsistent** naming convention: the `has_assignment: true` branch uses `assignmentDate` (camelCase), the `has_assignment: false` branch uses `assignment_date` (snake_case). This is documented as intentional in the Module 6 backend plan's Self-Review Notes and in the UI spec §2.1 — it is not a bug and must not be "fixed" in the frontend types or code. Every place this plan's code reads the date field must first narrow on `has_assignment`.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript (strict), shadcn-vue (`select`, `pagination`, `alert`, `card`, `badge`, `button`, `label` — `pagination` is not yet installed in this repo and this plan installs it), Vitest (for the new pure-JS date module only — no test harness exists for composables/pages, per the auth-frontend plan's established precedent).

**Spec:** `docs/superpowers/specs/2026-08-25-baituna-web-ui-design.md` §2.1 (API type shapes, the `has_assignment` naming quirk), §2.2 (composable pattern — write actions use raw `$fetch`, reads use `useApi`/`useFetch`), §2.4 (route structure — `/admin/masjid/[id]` combines Modules 5 and 6 in one page with tabs), §3 (component additions — `pagination`; the date-picker decision — no calendar, a `select` of upcoming Fridays is **not** what backend Module 6 requires since only "the current/next Friday" is ever creatable, so this plan uses a single read-only computed date, not a multi-Friday select — see Task 5), §4.6 second half ("Tab Jadwal Jumat"). Backend contract: `docs/superpowers/specs/2026-08-23-module-6-friday-assignment.md` and the actual implementation in `apps/web/server/services/friday-assignment.service.ts`, `apps/web/server/utils/wib-date.ts`, `apps/web/server/utils/validation.ts` (`createAssignmentSchema`, `updateAssignmentSchema`), and routes under `apps/web/server/api/mosques/[id]/friday-schedule/`.

**Note on spec §3's wording:** the spec's prose describes "beberapa pilihan select ('Jumat ini', 'Jumat depan', dst.)" as if multiple future Fridays were selectable. This does not match the backend: `createAssignment` only ever targets the single date `getCurrentOrNextFridayWib(now)` returns (there is no "pick any future Friday" endpoint — `GET .../current` returns exactly one target date, and that's the only date `POST` can succeed against without failing the backend's own uniqueness/no-conflicting-shift logic in practice, since the UI only ever calls create for the date `current` reported empty). This plan implements the single-date behavior the backend actually supports: the target date is computed once (client-side, matching the server's `getCurrentOrNextFridayWib`) and shown read-only, never offered as a multi-option select. This is a correction of an inaccuracy in the spec's prose, not a deviation from its intent (§4.6 itself, which is the authoritative section for this page, already describes exactly this single-date read-only behavior).

## Global Constraints

- `assignmentDate` can never be changed after creation (no endpoint accepts it in updates) — the create/edit form always shows the target date as read-only text, never an editable input.
- Every `person_id` field (`khatibPersonId`, `imamPersonId`, `muazzinPersonId`) is independently nullable — a valid assignment can have any subset of the three filled, but at least one must be non-null (enforced server-side by `createAssignmentSchema`'s `.refine`; the frontend form must prevent submitting all three empty rather than relying on the 422 alone, per UX expectations — but the 422 is still the source of truth and must be surfaced if it somehow occurs).
- A `403` from `PATCH .../friday-schedule/:assignmentId` means the assignment's date has passed since the page loaded (a real race condition near midnight WIB, not a client bug) — this must render as a specific disabled-form alert, not a generic error toast.
- History is paginated (`page`, `pageSize`, default 20, max 100) — never fetch all pages at once.
- Person names for `khatibPersonId`/`imamPersonId`/`muazzinPersonId` are resolved client-side by cross-referencing `GET /mosques/:id/people` — the assignment endpoints themselves only return ids, never names.
- Write actions (`create`, `update`) use raw `$fetch` inside the composable, matching `useAuth.ts`'s `login()` pattern; reads that need reactive re-fetching use `useApi`.
- TypeScript strict, no `any`, no non-null assertions on values that can genuinely be null.
- Commit messages follow Conventional Commits (`feat:`, `test:`, `docs:`).
- Every command in this plan runs from `apps/web/` unless stated otherwise.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/lib/wib-date-client.ts` | Client-safe copy of `isFriday`/`getCurrentOrNextFridayWib`/`isPastWib` | 1 |
| `apps/web/lib/wib-date-client.test.ts` | Tests for the above, mirroring the server version's 10 cases | 1 |
| `apps/web/types/api.ts` | Add `FridayAssignment`, `CurrentFridayAssignment`, `PaginatedAssignments`, `CreateAssignmentInput`, `UpdateAssignmentInput` (create file if Module 4/5 haven't yet) | 2 |
| `apps/web/composables/useFridayAssignment.ts` | `getCurrent()`, `getHistory()`, `create()`, `update()` — extend if the file already exists, create fresh otherwise | 3 |
| `apps/web/pages/admin/masjid/[id].vue` | Insert the "Jadwal Jumat" `TabsContent` block at Module 5's marked placeholder | 4, 5 |

**Coordination detail on Task 4/5 (updated after cross-checking the actual Module 5 plan, `docs/superpowers/plans/2026-08-25-ui-module-5-person.md`, which now exists):** Module 5's Task 4 creates the page with a `Tabs` containing exactly two tabs: `TabsTrigger value="person"` / `TabsContent value="person"` (fully built by Module 5) and `TabsTrigger value="jadwal"` / `TabsContent value="jadwal"` (placeholder, marked with the literal HTML comment `<!-- MODULE-6-UI-PLAN: replace this TabsContent with the Jadwal Jumat panel -->` immediately above it). **This plan's tab value is `jadwal`, not `jadwal-jumat`** — Task 5's template snippet below has been corrected to match. Module 5's page also exposes `mosqueId` (a plain `const`, not a ref) and a `usePeople()` composable with methods named `listActive`, `create`, `update`, `remove` — **not** `list`. Task 5's script below has been corrected to call `usePeople().listActive(mosqueId)`. If the file on disk when this plan is executed differs from this description (e.g. Module 5's plan was modified before being run), stop and reconcile — do not guess at insertion points or method names.

---

### Task 1: Client-safe WIB Friday date math

**Files:**
- Create: `apps/web/lib/wib-date-client.ts`
- Test: `apps/web/lib/wib-date-client.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, zero dependencies).
- Produces:
  - `isFriday(isoDate: string): boolean`
  - `getCurrentOrNextFridayWib(now: Date): string` — consumed by Task 5 (the edit/create form) to compute and display the target assignment date.
  - `isPastWib(isoDate: string, now: Date): boolean` — not used directly by this plan's UI code (the backend is authoritative on the 403), but exported for completeness and future reuse, matching the server module's full surface.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/wib-date-client.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { getCurrentOrNextFridayWib, isFriday, isPastWib } from './wib-date-client';

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

Run: `npm test -- wib-date-client` (from `apps/web/`)
Expected: FAIL — `wib-date-client.ts` does not exist yet.

- [ ] **Step 3: Implement the date math**

Create `apps/web/lib/wib-date-client.ts` (exact copy of `apps/web/server/utils/wib-date.ts`'s logic — kept in a separate file, not imported, because `server/utils/` is Nitro's server-only auto-import scope and is not safe to import from client-bundled `.vue`/composable code):

```typescript
// Client-safe mirror of apps/web/server/utils/wib-date.ts. Keep the two
// files' logic identical by hand — server/utils/ is Nitro's server-only
// auto-import scope and cannot be imported from client-bundled code, even
// though this module itself has zero server-only dependencies.

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
  const parts = isoDate.split('-').map(Number);
  const [year, month, day] = parts as [number, number, number];
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

Run: `npm test -- wib-date-client` (from `apps/web/`)
Expected: PASS, all 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/wib-date-client.ts apps/web/lib/wib-date-client.test.ts
git commit -m "feat(web): add client-safe WIB Friday date math"
```

---

### Task 2: API types for Friday Assignment

**Files:**
- Modify (or create if it doesn't exist yet): `apps/web/types/api.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FridayAssignment`, `CurrentFridayAssignment`, `PaginatedAssignments`, `CreateAssignmentInput`, `UpdateAssignmentInput` — consumed by Task 3 (`useFridayAssignment.ts`) and Task 5 (the page tab).

This task has no runtime behavior — pure type declarations, mirrored exactly from `apps/web/server/services/friday-assignment.service.ts`. Skip the TDD steps; create/extend the file and verify it typechecks.

- [ ] **Step 1: Check whether the file exists and what it already contains**

Run: `cat apps/web/types/api.ts 2>/dev/null || echo "does not exist"` (from `apps/web/`)

If it exists (likely added by the Module 4 or Module 5 UI plan with `Person`, `MosqueSummary`, etc.), append the block below at the end of the file, **do not duplicate** any interface that's already present under the same name — if `FridayAssignment`/`CurrentFridayAssignment`/`PaginatedAssignments` already exist (added read-only by another module's plan), only add `CreateAssignmentInput` and `UpdateAssignmentInput`, which are write-only shapes no other module's plan has a reason to add.

If the file does not exist, create it starting with this block (a top-of-file comment plus the five interfaces).

- [ ] **Step 2: Add or append the types**

```typescript
// apps/web/types/api.ts
// Hand-written API contract types — mirrors apps/web/server/utils/openapi.ts's
// documented paths, which carry no components.schemas (descriptions only).
// Keep in sync manually with the backend service files cited per interface.

/** Mirrors AssignmentRecord in apps/web/server/services/friday-assignment.service.ts (Module 6). */
export interface FridayAssignment {
  id: string;
  mosqueId: string;
  assignmentDate: string;
  khatibPersonId: string | null;
  imamPersonId: string | null;
  muazzinPersonId: string | null;
}

/**
 * Mirrors CurrentAssignment in apps/web/server/services/friday-assignment.service.ts.
 * Deliberately inconsistent naming: the `true` branch uses `assignmentDate`
 * (camelCase), the `false` branch uses `assignment_date` (snake_case) — this
 * matches the PRD's literal example payload and is documented as intentional
 * in the Module 6 backend plan. Do not "fix" this — narrow on `has_assignment`
 * before reading either date field.
 */
export type CurrentFridayAssignment =
  | {
      has_assignment: true;
      id: string;
      assignmentDate: string;
      khatibPersonId: string | null;
      imamPersonId: string | null;
      muazzinPersonId: string | null;
    }
  | { has_assignment: false; assignment_date: string };

/** Mirrors PaginatedAssignments in apps/web/server/services/friday-assignment.service.ts. */
export interface PaginatedAssignments {
  items: FridayAssignment[];
  page: number;
  pageSize: number;
  total: number;
}

/** Request body for POST /mosques/:id/friday-schedule — mirrors createAssignmentSchema in server/utils/validation.ts. */
export interface CreateAssignmentInput {
  assignmentDate: string;
  khatibPersonId: string | null;
  imamPersonId: string | null;
  muazzinPersonId: string | null;
}

/** Request body for PATCH /mosques/:id/friday-schedule/:assignmentId — mirrors updateAssignmentSchema in server/utils/validation.ts. At least one field required. */
export interface UpdateAssignmentInput {
  khatibPersonId?: string | null;
  imamPersonId?: string | null;
  muazzinPersonId?: string | null;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` (from `apps/web/`)
Expected: no new errors attributable to this file.

- [ ] **Step 4: Commit**

```bash
git add apps/web/types/api.ts
git commit -m "feat(web): add Friday Assignment API types"
```

---

### Task 3: `useFridayAssignment` composable

**Files:**
- Modify (or create if it doesn't exist yet): `apps/web/composables/useFridayAssignment.ts`

**Interfaces:**
- Consumes: `FridayAssignment`, `CurrentFridayAssignment`, `PaginatedAssignments`, `CreateAssignmentInput`, `UpdateAssignmentInput` (Task 2); `useApi` (`apps/web/composables/useApi.ts`, already exists); `useAuthToken` (`apps/web/composables/useAuth.ts`, already exists, used for manual `$fetch` auth headers on writes).
- Produces:
  - `getCurrent(mosqueId: string)` → `useApi<CurrentFridayAssignment>` reactive fetch, consumed by Task 5.
  - `getHistory(mosqueId: string, page: () => number, pageSize?: number)` → `useApi<PaginatedAssignments>` reactive fetch that refetches when `page()`'s value changes, consumed by Task 5.
  - `create(mosqueId: string, input: CreateAssignmentInput): Promise<FridayAssignment>` — throws on failure (`$fetch` error), consumed by Task 5.
  - `update(mosqueId: string, assignmentId: string, input: UpdateAssignmentInput): Promise<FridayAssignment>` — throws on failure, consumed by Task 5.

- [ ] **Step 1: Check whether the file exists**

Run: `cat apps/web/composables/useFridayAssignment.ts 2>/dev/null || echo "does not exist"` (from `apps/web/`)

If it already exists (added read-only by the Module 4 UI plan with only `getCurrent`/`getHistory`), **extend it** — add `create`/`update` inside the same returned object, do not create a second composable file. If it doesn't exist, create it fresh with all four functions.

- [ ] **Step 2: Implement (fresh-file version; if extending an existing file, merge the `create`/`update` functions into its existing structure instead)**

```typescript
// apps/web/composables/useFridayAssignment.ts
import type {
  CreateAssignmentInput,
  CurrentFridayAssignment,
  FridayAssignment,
  PaginatedAssignments,
  UpdateAssignmentInput,
} from '~/types/api';

export function useFridayAssignment() {
  function getCurrent(mosqueId: string) {
    return useApi<CurrentFridayAssignment>(`/api/mosques/${mosqueId}/friday-schedule/current`);
  }

  /**
   * `page` accepts a getter (`() => someRef.value`) so `useApi`'s internal
   * `computed` URL reacts to page changes — passing a plain number would
   * freeze the URL at the value seen on first call and silently stop
   * refetching when the caller updates its page ref.
   */
  function getHistory(mosqueId: string, page: () => number, pageSize = 20) {
    return useApi<PaginatedAssignments>(
      () => `/api/mosques/${mosqueId}/friday-schedule/history?page=${page()}&pageSize=${pageSize}`,
    );
  }

  async function create(mosqueId: string, input: CreateAssignmentInput): Promise<FridayAssignment> {
    const token = useAuthToken();
    return await $fetch<FridayAssignment>(`/api/mosques/${mosqueId}/friday-schedule`, {
      method: 'POST',
      body: input,
      headers: token.value ? { Authorization: `Bearer ${token.value}` } : {},
    });
  }

  async function update(mosqueId: string, assignmentId: string, input: UpdateAssignmentInput): Promise<FridayAssignment> {
    const token = useAuthToken();
    return await $fetch<FridayAssignment>(`/api/mosques/${mosqueId}/friday-schedule/${assignmentId}`, {
      method: 'PATCH',
      body: input,
      headers: token.value ? { Authorization: `Bearer ${token.value}` } : {},
    });
  }

  return { getCurrent, getHistory, create, update };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` (from `apps/web/`)
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/composables/useFridayAssignment.ts
git commit -m "feat(web): add useFridayAssignment composable with create/update"
```

---

### Task 4: Install the `pagination` shadcn-vue component

**Files:**
- Create: `apps/web/components/ui/pagination/*` (generated by CLI)

**Interfaces:**
- Consumes: nothing.
- Produces: `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationEllipsis`, `PaginationFirst`, `PaginationPrev`, `PaginationNext`, `PaginationLast` (exact export names depend on the CLI's current template — Step 2 verifies), consumed by Task 5's history table.

- [ ] **Step 1: Check it isn't already installed**

Run: `ls apps/web/components/ui/pagination 2>/dev/null || echo "not installed"` (from `apps/web/`)

If already installed (e.g. another module's plan added it first), skip to Task 5 — nothing to do here.

- [ ] **Step 2: Install via the shadcn-vue CLI**

Run (from `apps/web/`): `npx shadcn-vue@latest add pagination`
Expected: new files under `apps/web/components/ui/pagination/`, plus an `index.ts` re-exporting the pagination sub-components.

- [ ] **Step 3: Verify it typechecks**

Run: `npm run typecheck` (from `apps/web/`)
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/pagination apps/web/components.json
git commit -m "chore(web): install shadcn-vue pagination component"
```

---

### Task 5: Jadwal Jumat tab — current assignment, create/edit form, history

**Files:**
- Modify: `apps/web/pages/admin/masjid/[id].vue` (insert into the Module 5 plan's placeholder — see the Architecture section and the coordination note in File Structure above)

**Interfaces:**
- Consumes: `useFridayAssignment` (Task 3); `getCurrentOrNextFridayWib` (Task 1, `apps/web/lib/wib-date-client.ts`); `Person` type (from `apps/web/types/api.ts`, added by the Module 5 UI plan); `usePeople` composable (from the Module 5 UI plan, used here to resolve Person names — this task calls `usePeople().list(mosqueId)` independently rather than sharing reactive state with the Person tab, per spec §4.6, so this tab works standalone regardless of tab-open order); shadcn-vue `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` (already installed), `Pagination*` (Task 4), `Alert`/`AlertDescription` (already installed, `variant="warning"` for the past-date-lock case), `Card`/`CardHeader`/`CardTitle`/`CardContent` (already installed), `Button`, `Label`.
- Produces: nothing for later tasks — this is the leaf UI task for this plan.

- [ ] **Step 1: Read the current state of the shared page file**

Run: `cat "apps/web/pages/admin/masjid/[id].vue"` (from `apps/web/`)

Confirm it exists and contains a `Tabs` structure with two tabs (Person, Jadwal Jumat). If the file does not exist, **stop here** — this is a blocker, not something to work around; the Module 5 UI plan must run first. If the file exists but has no second tab or a structurally different layout than described in this plan's Architecture section, stop and reconcile with whoever wrote/executed the Module 5 plan before proceeding — do not guess at insertion points.

- [ ] **Step 2: Write the `<script setup>` logic for the Jadwal Jumat tab**

Insert the following into the page's `<script setup>` block (alongside whatever the Person tab's script already added — do not remove existing code):

```typescript
import { getCurrentOrNextFridayWib } from '~/lib/wib-date-client';
import type { CreateAssignmentInput, Person, UpdateAssignmentInput } from '~/types/api';

// mosqueId is assumed already resolved by the page shell (Module 5 UI plan),
// typically via `const mosqueId = route.params.id as string`.

const { getCurrent, getHistory, create, update } = useFridayAssignment();
const { listActive } = usePeople();

const historyPage = ref(1);
const { data: current, refresh: refreshCurrent } = getCurrent(mosqueId);
const { data: history } = getHistory(mosqueId, () => historyPage.value);
const peopleList = ref<Person[]>([]);
onMounted(async () => {
  peopleList.value = await listActive(mosqueId);
});

const targetDate = computed(() => getCurrentOrNextFridayWib(new Date()));

const khatibPersonId = ref<string | null>(null);
const imamPersonId = ref<string | null>(null);
const muazzinPersonId = ref<string | null>(null);
const isPastLocked = ref(false);
const isSaving = ref(false);

// Sync form fields from the loaded assignment whenever it changes.
watch(
  current,
  (value) => {
    if (!value) return;
    if (value.has_assignment) {
      khatibPersonId.value = value.khatibPersonId;
      imamPersonId.value = value.imamPersonId;
      muazzinPersonId.value = value.muazzinPersonId;
    } else {
      khatibPersonId.value = null;
      imamPersonId.value = null;
      muazzinPersonId.value = null;
    }
  },
  { immediate: true },
);

function personName(id: string | null): string {
  if (!id) return '—';
  const person = (peopleList.value ?? []).find((p: Person) => p.id === id);
  return person ? person.name : '—';
}

async function handleSubmitAssignment() {
  if (!khatibPersonId.value && !imamPersonId.value && !muazzinPersonId.value) {
    toast.error('Isi minimal satu peran: Khatib, Imam, atau Muazzin.');
    return;
  }

  isSaving.value = true;
  try {
    if (current.value?.has_assignment) {
      const input: UpdateAssignmentInput = {
        khatibPersonId: khatibPersonId.value,
        imamPersonId: imamPersonId.value,
        muazzinPersonId: muazzinPersonId.value,
      };
      await update(mosqueId, current.value.id, input);
      toast.success('Jadwal Jumat diperbarui.');
    } else {
      const input: CreateAssignmentInput = {
        assignmentDate: targetDate.value,
        khatibPersonId: khatibPersonId.value,
        imamPersonId: imamPersonId.value,
        muazzinPersonId: muazzinPersonId.value,
      };
      await create(mosqueId, input);
      toast.success('Jadwal Jumat dibuat.');
    }
    await refreshCurrent();
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 403) {
      isPastLocked.value = true;
      toast.error('Jadwal ini sudah lewat dan tidak bisa diubah.');
    } else {
      toast.error('Gagal menyimpan jadwal Jumat.');
    }
  } finally {
    isSaving.value = false;
  }
}
```

- [ ] **Step 3: Write the template for the Jadwal Jumat `TabsContent`**

Insert at the marked placeholder inside the page's `<template>`:

```vue
<TabsContent value="jadwal" class="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>
        {{ current?.has_assignment ? 'Jadwal Jumat Saat Ini' : 'Buat Jadwal Jumat' }}
      </CardTitle>
      <p class="text-xs text-muted-foreground">
        Tanggal:
        <span class="font-mono tabular-nums">
          {{ current?.has_assignment ? current.assignmentDate : current?.assignment_date }}
        </span>
        (tidak dapat diubah setelah dibuat)
      </p>
    </CardHeader>
    <CardContent class="space-y-4">
      <Alert v-if="isPastLocked" variant="warning">
        <AlertDescription>
          Jadwal ini sudah lewat dan tidak bisa diubah. Tunggu sampai jadwal Jumat berikutnya tersedia.
        </AlertDescription>
      </Alert>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="space-y-1.5">
          <Label>Khatib</Label>
          <Select v-model="khatibPersonId" :disabled="isPastLocked">
            <SelectTrigger><SelectValue placeholder="Pilih Khatib" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="person in peopleList ?? []" :key="person.id" :value="person.id">
                {{ person.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1.5">
          <Label>Imam</Label>
          <Select v-model="imamPersonId" :disabled="isPastLocked">
            <SelectTrigger><SelectValue placeholder="Pilih Imam" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="person in peopleList ?? []" :key="person.id" :value="person.id">
                {{ person.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1.5">
          <Label>Muazzin</Label>
          <Select v-model="muazzinPersonId" :disabled="isPastLocked">
            <SelectTrigger><SelectValue placeholder="Pilih Muazzin" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="person in peopleList ?? []" :key="person.id" :value="person.id">
                {{ person.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button :disabled="isPastLocked || isSaving" @click="handleSubmitAssignment">
        {{ current?.has_assignment ? 'Simpan Perubahan' : 'Buat Jadwal' }}
      </Button>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>Riwayat Jadwal Jumat</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Khatib</TableHead>
            <TableHead>Imam</TableHead>
            <TableHead>Muazzin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="item in history?.items ?? []" :key="item.id">
            <TableCell class="font-mono tabular-nums">{{ item.assignmentDate }}</TableCell>
            <TableCell>{{ personName(item.khatibPersonId) }}</TableCell>
            <TableCell>{{ personName(item.imamPersonId) }}</TableCell>
            <TableCell>{{ personName(item.muazzinPersonId) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Pagination
        v-if="history && history.total > history.pageSize"
        :items-per-page="history.pageSize"
        :total="history.total"
        :default-page="historyPage"
        @update:page="(newPage: number) => (historyPage = newPage)"
      >
        <PaginationContent>
          <PaginationFirst />
          <PaginationPrev />
          <PaginationNext />
          <PaginationLast />
        </PaginationContent>
      </Pagination>
    </CardContent>
  </Card>
</TabsContent>
```

Note: the exact `Pagination*` sub-component names must match what Task 4's CLI install actually generated (verify against `apps/web/components/ui/pagination/index.ts` before finalizing this step) — the names above (`Pagination`, `PaginationContent`, `PaginationFirst`, `PaginationPrev`, `PaginationNext`, `PaginationLast`) match the current shadcn-vue `new-york` style template as of this plan's writing, but the CLI's template can change; treat the actual generated `index.ts` as the source of truth over this snippet.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev` (from `apps/web/`)

1. Log in as a `mosque_admin` who owns an approved mosque (or `super_admin`).
2. Navigate to `/admin/masjid/<that mosque's id>`.
3. Click the "Jadwal Jumat" tab.
4. Expected: either "Buat Jadwal Jumat" (empty state) or "Jadwal Jumat Saat Ini" (existing assignment) renders with the correct read-only target date.
5. Select at least one Person in one of the three selects, click the submit button.
6. Expected: a success toast appears, and the card now shows "Jadwal Jumat Saat Ini" with the selected Person(s) reflected.
7. Scroll down — expected: the history table shows the just-created/updated entry at the top (newest first), with resolved Person names, not raw ids.
8. If more than `pageSize` (20) history rows exist for this mosque, expected: pagination controls appear and paging works.

Stop the dev server after checking (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/pages/admin/masjid/[id].vue"
git commit -m "feat(web): add Jadwal Jumat tab to mosque admin panel"
```

---

## Self-Review Notes

- **Spec coverage:** §4.6's "Tab Jadwal Jumat" bullet list maps one-to-one to Task 5: current-assignment card with three Person selects (bullet 1) → the `Select` trio; create-when-empty / edit-when-present toggle (bullets 2-3) → `current?.has_assignment` branching in both script and template; 403-past-date-lock alert (bullet 3) → `isPastLocked` state and the `Alert variant="warning"`; paginated read-only history (bullet 4) → the second `Card` with `Table` + `Pagination`. §2.1's `has_assignment` naming quirk is called out three times (Architecture, Global Constraints, Task 2's type comment) and the template's date display (`current?.has_assignment ? current.assignmentDate : current?.assignment_date`) is the concrete narrowing pattern that prevents it from being "fixed" into a bug.
- **Placeholder scan:** no TBD/TODO; every step has real, runnable code. The one open item (exact `Pagination*` export names) is explicitly flagged as "verify against the CLI's actual output," not left as an unresolved placeholder — it's a documented external-dependency risk, not missing content.
- **Type consistency:** `FridayAssignment`, `CurrentFridayAssignment`, `PaginatedAssignments` (Task 2) are used unchanged by `useFridayAssignment` (Task 3) and the page (Task 5). `CreateAssignmentInput`/`UpdateAssignmentInput` field names (`khatibPersonId`, `imamPersonId`, `muazzinPersonId`) match `createAssignmentSchema`/`updateAssignmentSchema` in `server/utils/validation.ts` exactly — verified by reading the actual schema file during this plan's research, not assumed.
- **Corrected spec inaccuracy:** §3's prose suggesting a multi-Friday `select` ("Jumat ini", "Jumat depan", "2 minggu lagi") does not match what the backend supports (only the single date `getCurrentOrNextFridayWib` returns is ever valid to create against) — this plan implements the single-date read-only behavior that §4.6 (the authoritative section for this exact page) already describes, and flags the §3 wording as imprecise rather than silently picking one interpretation.
- **Shared-file coordination:** this plan was written before `docs/superpowers/plans/2026-08-25-ui-module-5-person.md` existed, using a generic placeholder assumption. After Module 5's plan was written, its actual page structure was cross-checked against this plan and two real mismatches were found and fixed: the tab `value` (this plan originally said `jadwal-jumat`, Module 5 actually uses `jadwal`) and the People composable's read method name (this plan originally called `usePeople().list(...)`, Module 5's `usePeople()` actually exposes `listActive`). Both are corrected above. Task 5 Step 1 remains a defensive read-and-verify step regardless, since either plan could still be edited again before execution.
- **Reactivity fix:** the original `getHistory(mosqueId, page: number, ...)` signature froze the URL at whatever `historyPage.value` was on first call, so paging controls would silently stop refetching after page 1. Fixed to take `page: () => number`, matching `useApi`'s existing pattern (`url: string | (() => string)`) of accepting a getter for reactive values.
- **Test coverage:** Task 1's `wib-date-client.ts` is the only genuinely testable unit in this plan (pure functions, zero Nuxt runtime) and gets the full 10-case suite mirrored from the already-proven server version. Composables and the page itself have no automated test harness in this repo (per the auth-frontend plan's precedent) and are covered by Task 5 Step 4's concrete manual smoke test instead.
