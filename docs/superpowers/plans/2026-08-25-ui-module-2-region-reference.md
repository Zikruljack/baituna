# UI Module 2: Region Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the frontend types and composable that expose Province/City data (Module 2's backend, already implemented) to the rest of the UI — specifically the mosque registration form built by the UI Module 3 plan.

**Architecture:** Nuxt 4 fullstack app (`apps/web`). This plan creates `apps/web/types/api.ts`, the single shared file that will hold hand-written response/request types for every UI module (Module 2 starts it; Modules 3/4/5/6's plans append to it, never recreate it), and `apps/web/composables/useRegions.ts`, a thin composable wrapping the two read-only region endpoints. No page is built here — Province/City selects are consumed inside Module 3's `/masjid/daftar` registration form, built by a separate plan (`docs/superpowers/plans/2026-08-25-ui-module-3-mosque-registration.md`). No backend files are modified.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript (strict), shadcn-vue components (not used directly in this plan — no page), Zod (not used — no form here).

**Spec:** `docs/superpowers/specs/2026-08-25-baituna-web-ui-design.md` §2.1 (Lapisan Tipe API — `RegionOption`/`CityOption` shape and the `{ data: [...] }` wrapper), §2.2 (Lapisan Pemanggilan API — one composable per domain, `useRegions.ts` table entry). Backend contract: `docs/superpowers/specs/2026-08-23-module-2-region-reference.md`.

## Global Constraints

- Do not modify any file under `apps/web/server/**`. The two region endpoints (`GET /api/provinces`, `GET /api/provinces/:id/cities`) are settled (Module 2 backend) and are consumed as-is.
- `apps/web/server/utils/openapi.ts` has no `components.schemas` — types are hand-written, not generated. (Same constraint as the auth-frontend plan.)
- Both endpoints wrap their array in `{ data: [...] }`, unlike most other endpoints in this system which return bare arrays. This is verified directly against `apps/web/server/api/provinces/index.get.ts` and `apps/web/server/api/provinces/[id]/cities.get.ts` (both literally `return { data }` / `return { data: await listActiveCities(...) }`) — do not assume a bare array.
- Follow existing code conventions: 2-space indent, no default exports for non-component/non-page TS modules, named exports, JSDoc-style one-line comments only where a WHY isn't obvious (see `apps/web/lib/auth-types.ts` and `apps/web/composables/useAuth.ts` for the house style).
- Composables use Nuxt auto-imports (`useFetch`, `$fetch`) and are **not** unit-tested in this plan — `apps/web/vitest.config.ts` only includes `server/**` and `scripts/**`. Composables are verified manually via a dev-server smoke test, matching the pattern in `docs/superpowers/plans/2026-08-24-auth-frontend.md`.
- Run `npm run typecheck` and `npm run lint` (both defined in `apps/web/package.json`) after each task that adds `.ts` files, from the `apps/web` directory.

---

## Reference: exact server response shapes (already implemented, do not change)

`GET /api/provinces` (`apps/web/server/api/provinces/index.get.ts`) — no params, returns:
```json
{ "data": [{ "id": "uuid", "name": "Aceh" }] }
```
Sorted `name ASC`.

`GET /api/provinces/:id/cities` (`apps/web/server/api/provinces/[id]/cities.get.ts`) — `:id` must be a UUID, returns:
```json
{ "data": [{ "id": "uuid", "name": "Banda Aceh", "provinceId": "uuid" }] }
```
Sorted `name ASC`. `400` if `:id` is not a valid UUID (`statusMessage: "Invalid Province ID"`). `404` if the Province doesn't exist or is soft-deleted (`statusMessage: "Province not found"`). `200` with `data: []` if the Province is active but has no cities.

Backend types, verbatim from `apps/web/server/services/region.service.ts`:
```typescript
export interface RegionOption {
  id: string;
  name: string;
}

export interface CityOption extends RegionOption {
  provinceId: string;
}
```

---

### Task 1: Shared API types file — Region types

**Files:**
- Create: `apps/web/types/api.ts`

**Interfaces:**
- Consumes: nothing (pure type definitions).
- Produces: `RegionOption`, `CityOption` — imported by `composables/useRegions.ts` (Task 2). This file is the shared home for every UI module's hand-written response types; later plans (UI Module 3, 4, 5, 6) append their own interfaces to it — they must not recreate it or remove these two.

This task has no runtime behavior, so there is no test to write — it is pure type declarations copied verbatim from the server code cited above. Skip the TDD steps; just create/extend the file and verify it typechecks.

- [ ] **Step 1: Check whether the file already exists**

Run: `cat apps/web/types/api.ts 2>/dev/null || echo "does not exist"` (from `apps/web/`)

`apps/web/types/api.ts` is shared across all five UI module plans (2, 3, 4, 5, 6) and any of them may run first. If it already exists (another module's plan ran first), **append** the block below at the end of the file instead of overwriting it. If it does not exist, create it fresh with the block below.

- [ ] **Step 2: Create or append the types**

```typescript
// apps/web/types/api.ts
//
// Hand-written response/request types for the UI modules that consume
// apps/web/server/api/**. apps/web/server/utils/openapi.ts has no
// components.schemas (descriptions only), so these are mirrored by hand from
// the actual service/route code, the same approach used in
// apps/web/lib/auth-types.ts for Module 1. Each module's implementation plan
// appends its own interfaces here — this file is never recreated wholesale.

/** Mirrors apps/web/server/services/region.service.ts RegionOption (Module 2). */
export interface RegionOption {
  id: string;
  name: string;
}

/** Mirrors apps/web/server/services/region.service.ts CityOption (Module 2). */
export interface CityOption extends RegionOption {
  provinceId: string;
}
```

- [ ] **Step 3: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/types/api.ts
git commit -m "feat(web): add shared API types file with Region types"
```

---

### Task 2: `useRegions` composable

**Files:**
- Create: `apps/web/composables/useRegions.ts`

**Interfaces:**
- Consumes: `RegionOption`, `CityOption` from `apps/web/types/api.ts` (Task 1).
- Produces:
  - `useRegions()` returning `{ listProvinces(): Promise<RegionOption[]>, listCities(provinceId: string): Promise<CityOption[]> }`.
  - Both functions unwrap the `{ data: [...] }` envelope so callers (Module 3's registration form) receive plain arrays — the envelope is this composable's implementation detail, not something every consumer re-parses.
  - Consumed by `apps/web/pages/masjid/daftar.vue`, built in the UI Module 3 plan (`docs/superpowers/plans/2026-08-25-ui-module-3-mosque-registration.md`).

- [ ] **Step 1: Create the composable**

```typescript
// apps/web/composables/useRegions.ts
import type { CityOption, RegionOption } from '~/types/api';

/** Read-only Province/City lookups (Module 2 backend). Both endpoints are public — no auth header needed. */
export function useRegions() {
  async function listProvinces(): Promise<RegionOption[]> {
    const { data } = await $fetch<{ data: RegionOption[] }>('/api/provinces');
    return data;
  }

  async function listCities(provinceId: string): Promise<CityOption[]> {
    const { data } = await $fetch<{ data: CityOption[] }>(`/api/provinces/${provinceId}/cities`);
    return data;
  }

  return { listProvinces, listCities };
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Manual smoke check**

Run (from `apps/web`): `npm run dev`. With the dev server running, open a second terminal and run:

```bash
curl -s http://localhost:3000/api/provinces | head -c 300
```

Expected: JSON matching `{ "data": [{ "id": "...", "name": "Aceh" }] }` (assuming the region seed has run — if the array is empty, that's a seed/database state issue outside this plan's scope, not a composable bug; the shape is what matters here).

Then, in the browser devtools console on any page of the running dev app (e.g. `http://localhost:3000/`), run:

```js
const { listProvinces } = useRegions();
const provinces = await listProvinces();
console.log(provinces);
```

Expected: an array of `{ id, name }` objects logged, no thrown error. If `provinces` is non-empty, also run `listCities(provinces[0].id)` and confirm it logs an array of `{ id, name, provinceId }` objects. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/composables/useRegions.ts
git commit -m "feat(web): add useRegions composable for Province/City lookups"
```

---

## Self-Review

**Spec coverage:** Spec §2.1's `RegionOption`/`CityOption` shapes and the `{ data: [...] }` wrapper note are implemented exactly in Task 1/2, verified against the live route files rather than assumed from the spec prose. Spec §2.2's composable table entry for Module 2 (`useRegions.ts` — `listProvinces()`, `listCities(provinceId)`) is implemented exactly in Task 2, including the note that region reads don't need a dedicated reactive `useApi`/`useFetch` treatment since they're only ever called imperatively from within another composable's async flow (the registration form's Province-change handler), not rendered reactively on their own.

**Placeholder scan:** No TBD/TODO. Every step has real, runnable code. No test-writing steps were skipped without cause — this plan correctly has zero automated tests because both new files are Nuxt-runtime-dependent (`$fetch`, auto-imports) and this repo's `vitest.config.ts` scope (`server/**`, `scripts/**`) deliberately excludes composables, exactly as the auth-frontend plan established as precedent.

**Type consistency:** `RegionOption`/`CityOption` are defined once in Task 1 and imported unchanged into Task 2 — no renaming or reshaping between tasks. The composable's return type (`Promise<RegionOption[]>` / `Promise<CityOption[]>`) matches what Module 3's plan will expect to bind directly to `select` options (each option needs `id` for the `v-model` value and `name` for the label — both present, nothing extra to strip).
