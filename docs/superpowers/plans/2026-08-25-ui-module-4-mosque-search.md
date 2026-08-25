# UI Module 4: Mosque Search & Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewire `pages/index.vue` from hardcoded mock mosque data to live calls against Module 4's search/nearby/detail endpoints and Module 5/6's read-only display data, and add a new public `/masjid/[id]` detail page — both consuming real backend contracts that are now fully implemented.

**Architecture:** Two composables (`useMosqueSearch`, plus read-only additions to `useFridayAssignment` and `usePeople`) wrap `useApi`/`$fetch` against the already-implemented Nitro routes under `apps/web/server/api/mosques/**`. `pages/index.vue` keeps its existing section anchors (`#jadwal-jumat`, `#masjid`, `#daftar-masjid`) that `AppHeader.vue` already links to, but every section's data source changes from a hardcoded array to a live fetch; two fields (`capacity`, `cash`) and the entire `#transparansi` section are deleted because nothing in any backend module produces them. `pages/masjid/[id].vue` is new: a public mosque detail page with a `Tabs` split between "Jadwal Jumat" (current + paginated history, Person names resolved client-side from `GET /mosques/:id/people`) and "Tentang" (address, map link, conditional "Kelola Masjid Ini" button gated on `user.id === mosque.adminUserId || role === 'super_admin'`).

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript (strict), shadcn-vue (`tabs`, `pagination` newly installed; `card`, `badge`, `input`, `button`, `separator`, `skeleton` already present), `lucide-vue-next` icons, `vue-sonner` for toasts, browser `navigator.geolocation` API. No vitest coverage for pages/composables (this repo's `vitest.config.ts` only includes `server/**`/`scripts/**`) — verification is manual dev-server smoke testing, following the pattern in `docs/superpowers/plans/2026-08-24-auth-frontend.md`.

**Spec:** `docs/superpowers/specs/2026-08-25-baituna-web-ui-design.md` — this plan implements §1 (index.vue mockup findings), §2.1 (API type layer — this plan's slice), §2.2 (composable layer — this plan's slice), §2.3 (ownership gating for "Kelola Masjid Ini"), §2.4 (route `/masjid/[id]`), §3 (tabs/pagination component additions, no-map/no-calendar decisions already approved), §4.1 (full index.vue rewrite), §4.3 (`/masjid/[id]` detail page). Backend contracts: `docs/superpowers/specs/2026-08-23-module-4-mosque-search.md`, `docs/superpowers/specs/2026-08-23-module-6-friday-assignment.md` (read-only slice only), `docs/superpowers/specs/2026-08-23-module-5-person.md` (read-only slice only).

## Global Constraints

These apply to every task in this plan. Copied from the spec and verified against the live backend code as of 2026-08-25.

- **Delete, don't hide, the two fabricated fields.** `capacity` and `cash` exist nowhere in `mosques`, `friday_assignments`, or any other table — every reference to them in `index.vue` is removed, not commented out or fed a placeholder.
- **Delete `#transparansi` entirely.** Its stat counters (`240+ Masjid`, `Rp 1,8M+ Kas`, etc.) have no backing data source in any implemented module.
- **Keep the three section anchor IDs.** `#jadwal-jumat`, `#masjid`, `#daftar-masjid` must remain on their respective `<section>` elements — `AppHeader.vue`'s nav links (`to="/#jadwal-jumat"`, `to="/#masjid"`, `to="/#daftar-masjid"`) depend on them and this plan does not modify `AppHeader.vue`.
- **`CurrentFridayAssignment` is a discriminated union with a deliberate naming inconsistency.** The `has_assignment: true` branch uses camelCase `assignmentDate`; the `has_assignment: false` branch uses snake_case `assignment_date`. This is the literal PRD §4.2 contract, not a bug — code must narrow on `has_assignment` before reading either date field, and must never "normalize" the field name.
- **`distanceKm` is optional on `MosqueSummary`.** It is present only when the array came from `GET /mosques/nearby`; `GET /mosques/search` omits it entirely. Code must not assume its presence.
- **Person names are resolved client-side.** `GET /mosques/:id/friday-schedule/current` and `.../history` return only `khatibPersonId`/`imamPersonId`/`muazzinPersonId` (nullable UUID strings), never names. This plan fetches `GET /mosques/:id/people` separately and matches IDs to names in the client — there is no backend join.
- **404 from `GET /mosques/:id` means "not found" full stop.** Backend collapses non-existent, non-approved, and soft-deleted mosques into an identical 404 to avoid leaking existence — the detail page must not attempt to distinguish these cases.
- **Write actions use `$fetch` directly; reads that need automatic reactivity use `useApi`/`useFetch`.** This mirrors `login()` in `useAuth.ts` (imperative `$fetch`) vs. the reactive pattern `useApi` already provides.
- **This plan is read-only against Module 5 and Module 6's endpoints.** It calls `GET /mosques/:id/people` and `GET /mosques/:id/friday-schedule/{current,history}` for display only. It does not implement `createPerson`/`updatePerson`/`deletePerson` or `createAssignment`/`updateAssignment` — those are added to the same composable files (`usePeople.ts`, `useFridayAssignment.ts`) by the Module 5 and Module 6 UI plans respectively. If those files already exist when a task in this plan runs (because those plans executed first), this plan's tasks must **add** the read-only functions without disturbing whatever write functions are already there.
- **`apps/web/types/api.ts` is shared across all five UI module plans.** This plan adds `MosqueSummary`, `MosqueDetail`, `FridayAssignment`, `CurrentFridayAssignment`, `PaginatedAssignments`, and `Person` to it. If the file already has content from another plan's earlier execution, add to it — do not overwrite.
- **Run every command in this plan from `apps/web/`** unless stated otherwise.
- **Commit messages follow Conventional Commits** (`feat:`, `test:`, `chore:`, `docs:`) — commitlint + husky enforce this on commit.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/types/api.ts` | Hand-written response/request types for Modules 4, 5 (read), 6 (read) | 1 |
| `apps/web/composables/useMosqueSearch.ts` | `nearby()` (geolocation-driven), `search(q)`, `detail(id)` | 2 |
| `apps/web/composables/usePeople.ts` | `listActive(mosqueId)` — read-only slice | 3 |
| `apps/web/composables/useFridayAssignment.ts` | `getCurrent(mosqueId)`, `getHistory(mosqueId, page, pageSize)` — read-only slice | 4 |
| `apps/web/pages/index.vue` | Full rewrite: `#jadwal-jumat`, `#masjid`, `#daftar-masjid` wired to live data; `#transparansi` deleted | 5, 6, 7 |
| `apps/web/pages/masjid/[id].vue` | New public mosque detail page with Jadwal Jumat / Tentang tabs | 8 |

---

### Task 1: API types for Module 4/5/6 (read slice)

**Files:**
- Create: `apps/web/types/api.ts`

**Interfaces:**
- Consumes: nothing (pure type definitions).
- Produces: `MosqueSummary`, `MosqueDetail`, `FridayAssignment`, `CurrentFridayAssignment`, `PaginatedAssignments`, `Person` — imported by Tasks 2, 3, 4, 5, 6, 7, 8, and by the Module 5/6 UI plans when they extend the same composables.

No runtime behavior — pure type declarations copied verbatim from the backend service files already read and verified. Skip TDD steps; create the file and verify it typechecks.

- [ ] **Step 1: Create the types file**

```typescript
// apps/web/types/api.ts

/** Mirrors apps/web/server/services/mosque-search.service.ts MosqueSummary. `distanceKm` is present only from GET /mosques/nearby; absent from GET /mosques/search. */
export interface MosqueSummary {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  distanceKm?: number;
}

/** Mirrors apps/web/server/services/mosque-search.service.ts MosqueDetail. Returned only for status='approved' mosques — see GET /mosques/:id. */
export interface MosqueDetail {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  cityId: string;
  provinceId: string;
  status: 'approved';
  adminUserId: string | null;
}

/** Mirrors apps/web/server/services/friday-assignment.service.ts AssignmentRecord. Used by GET .../friday-schedule/history items. */
export interface FridayAssignment {
  id: string;
  mosqueId: string;
  assignmentDate: string;
  khatibPersonId: string | null;
  imamPersonId: string | null;
  muazzinPersonId: string | null;
}

/**
 * Mirrors apps/web/server/services/friday-assignment.service.ts CurrentAssignment.
 * Deliberate naming inconsistency, NOT a bug: the `true` branch uses camelCase
 * `assignmentDate`; the `false` branch uses snake_case `assignment_date`. This is
 * the literal PRD §4.2 contract. Always narrow on `has_assignment` before reading
 * either date field.
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

/** Mirrors apps/web/server/services/friday-assignment.service.ts PaginatedAssignments. Returned by GET .../friday-schedule/history. */
export interface PaginatedAssignments {
  items: FridayAssignment[];
  page: number;
  pageSize: number;
  total: number;
}

/** Mirrors apps/web/server/services/person.service.ts PersonSummary. Returned by GET /mosques/:id/people. */
export interface Person {
  id: string;
  name: string;
  phone: string | null;
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/types/api.ts
git commit -m "feat(web): add mosque search/detail/friday-assignment/person types"
```

---

### Task 2: `useMosqueSearch` composable

**Files:**
- Create: `apps/web/composables/useMosqueSearch.ts`

**Interfaces:**
- Consumes: `MosqueSummary`, `MosqueDetail` from `apps/web/types/api.ts` (Task 1).
- Produces:
  - `useMosqueSearch()` returning `{ nearby(radiusKm?: number): Promise<MosqueSummary[]>, search(query: string): Promise<MosqueSummary[]>, detail(id: string): Promise<MosqueDetail | null> }`.
  - `nearby` is consumed by `pages/index.vue` (Task 5, 6).
  - `search` is consumed by `pages/index.vue` (Task 6).
  - `detail` is consumed by `pages/masjid/[id].vue` (Task 8).

`nearby` wraps the browser Geolocation API in a Promise and calls `GET /mosques/nearby?lat&lng&radius`; if geolocation is denied, unavailable, or times out, it resolves to `[]` rather than rejecting, so callers can render an empty-state without a try/catch. `search` calls `GET /mosques/search?q=`. `detail` calls `GET /mosques/:id` and translates a 404 into `null` (never throws for "not found") so the detail page can render "not found" without a try/catch on every use.

- [ ] **Step 1: Create the composable**

```typescript
// apps/web/composables/useMosqueSearch.ts
import type { MosqueDetail, MosqueSummary } from '~/types/api';

const DEFAULT_RADIUS_KM = 5;
const GEOLOCATION_TIMEOUT_MS = 8000;

function getBrowserPosition(): Promise<GeolocationPosition | null> {
  if (!import.meta.client || !('geolocation' in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { timeout: GEOLOCATION_TIMEOUT_MS },
    );
  });
}

export function useMosqueSearch() {
  async function nearby(radiusKm: number = DEFAULT_RADIUS_KM): Promise<MosqueSummary[]> {
    const position = await getBrowserPosition();
    if (!position) return [];

    return await $fetch<MosqueSummary[]>('/api/mosques/nearby', {
      query: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        radius: radiusKm,
      },
    });
  }

  async function search(query: string): Promise<MosqueSummary[]> {
    return await $fetch<MosqueSummary[]>('/api/mosques/search', {
      query: { q: query },
    });
  }

  async function detail(id: string): Promise<MosqueDetail | null> {
    try {
      return await $fetch<MosqueDetail>(`/api/mosques/${id}`);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  return { nearby, search, detail };
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/composables/useMosqueSearch.ts
git commit -m "feat(web): add useMosqueSearch composable"
```

---

### Task 3: `usePeople` composable — read-only slice

**Files:**
- Create: `apps/web/composables/usePeople.ts`

**Interfaces:**
- Consumes: `Person` from `apps/web/types/api.ts` (Task 1).
- Produces: `usePeople()` returning `{ listActive(mosqueId: string): Promise<Person[]> }`. Consumed by `pages/index.vue` (Task 5) and `pages/masjid/[id].vue` (Task 8) to resolve Person IDs to names. The Module 5 UI plan will later add `create`/`update`/`remove` to this same returned object — this task only adds `listActive`.

- [ ] **Step 1: Create the composable**

```typescript
// apps/web/composables/usePeople.ts
import type { Person } from '~/types/api';

export function usePeople() {
  async function listActive(mosqueId: string): Promise<Person[]> {
    return await $fetch<Person[]>(`/api/mosques/${mosqueId}/people`);
  }

  return { listActive };
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/composables/usePeople.ts
git commit -m "feat(web): add usePeople composable (read-only slice)"
```

---

### Task 4: `useFridayAssignment` composable — read-only slice

**Files:**
- Create: `apps/web/composables/useFridayAssignment.ts`

**Interfaces:**
- Consumes: `CurrentFridayAssignment`, `PaginatedAssignments` from `apps/web/types/api.ts` (Task 1).
- Produces: `useFridayAssignment()` returning `{ getCurrent(mosqueId: string): Promise<CurrentFridayAssignment>, getHistory(mosqueId: string, page: number, pageSize: number): Promise<PaginatedAssignments> }`. Consumed by `pages/index.vue` (Task 5) and `pages/masjid/[id].vue` (Task 8). The Module 6 UI plan will later add `createAssignment`/`updateAssignment` to this same returned object — this task only adds the two read methods.

- [ ] **Step 1: Create the composable**

```typescript
// apps/web/composables/useFridayAssignment.ts
import type { CurrentFridayAssignment, PaginatedAssignments } from '~/types/api';

export function useFridayAssignment() {
  async function getCurrent(mosqueId: string): Promise<CurrentFridayAssignment> {
    return await $fetch<CurrentFridayAssignment>(`/api/mosques/${mosqueId}/friday-schedule/current`);
  }

  async function getHistory(mosqueId: string, page: number, pageSize: number): Promise<PaginatedAssignments> {
    return await $fetch<PaginatedAssignments>(`/api/mosques/${mosqueId}/friday-schedule/history`, {
      query: { page, pageSize },
    });
  }

  return { getCurrent, getHistory };
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/composables/useFridayAssignment.ts
git commit -m "feat(web): add useFridayAssignment composable (read-only slice)"
```

---

### Task 5: Install `tabs` and `pagination` shadcn-vue components

**Files:**
- Create: `apps/web/components/ui/tabs/*` (via CLI)
- Create: `apps/web/components/ui/pagination/*` (via CLI)

**Interfaces:**
- Consumes: nothing.
- Produces: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs` — consumed by `pages/masjid/[id].vue` (Task 8). `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationPrevious`, `PaginationNext` from `@/components/ui/pagination` — consumed by `pages/masjid/[id].vue` (Task 8).

- [ ] **Step 1: Install the components**

Run (from `apps/web`):

```bash
npx shadcn-vue@latest add tabs pagination
```

Expected: new directories `components/ui/tabs/` and `components/ui/pagination/` appear, each with an `index.ts` and one or more `.vue` files, following the same structure as the existing `components/ui/dialog/` directory.

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/tabs apps/web/components/ui/pagination apps/web/components.json
git commit -m "chore(web): install tabs and pagination shadcn-vue components"
```

---

### Task 6: Rewrite `index.vue` — `#jadwal-jumat` section

**Files:**
- Modify: `apps/web/pages/index.vue`

**Interfaces:**
- Consumes: `useMosqueSearch` (Task 2), `useFridayAssignment` (Task 4), `usePeople` (Task 3), `MosqueSummary`/`CurrentFridayAssignment`/`Person` (Task 1).
- Produces: a `featuredMosque` ref and `featuredAssignment` ref consumed only within this file, replacing the old `featuredFriday` computed. Later tasks in this plan (7) touch the same file's other sections.

This task replaces the entire `<script setup>` block's mock data and the `#jadwal-jumat` `<section>`'s template with live-data equivalents. Because `<script setup>` is one block per file, this step and Task 7's steps together produce the file's final script — this step writes the full script now (used by both this section and the next), and Task 7 only touches the remaining two template sections.

- [ ] **Step 1: Replace the full `<script setup>` block**

Replace the entire `<script setup lang="ts">...</script>` block at the top of `apps/web/pages/index.vue` (currently lines 1–206) with:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Building2,
  Compass,
  ShieldCheck,
  PlusCircle,
} from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import type { CurrentFridayAssignment, MosqueSummary, Person } from '~/types/api';

const { nearby, search } = useMosqueSearch();
const { getCurrent } = useFridayAssignment();
const { listActive } = usePeople();

// #jadwal-jumat state
const featuredMosque = ref<MosqueSummary | null>(null);
const featuredAssignment = ref<CurrentFridayAssignment | null>(null);
const featuredPeople = ref<Person[]>([]);
const featuredLoading = ref(true);

function resolvePersonName(personId: string | null, people: Person[]): string | null {
  if (!personId) return null;
  return people.find((person) => person.id === personId)?.name ?? null;
}

async function loadFeatured() {
  featuredLoading.value = true;
  try {
    const results = await nearby();
    const mosque = results[0] ?? null;
    featuredMosque.value = mosque;

    if (mosque) {
      const [assignment, people] = await Promise.all([
        getCurrent(mosque.id),
        listActive(mosque.id),
      ]);
      featuredAssignment.value = assignment;
      featuredPeople.value = people;
    }
  } catch {
    toast.error('Gagal memuat jadwal Jumat unggulan');
  } finally {
    featuredLoading.value = false;
  }
}

// #masjid state
const searchQuery = ref('');
const mosques = ref<MosqueSummary[]>([]);
const mosquesLoading = ref(true);
const hasSearched = ref(false);

async function loadNearbyMosques() {
  mosquesLoading.value = true;
  try {
    mosques.value = await nearby();
  } catch {
    toast.error('Gagal memuat daftar masjid terdekat');
  } finally {
    mosquesLoading.value = false;
  }
}

async function runSearch() {
  const query = searchQuery.value.trim();
  if (!query) {
    hasSearched.value = false;
    await loadNearbyMosques();
    return;
  }

  mosquesLoading.value = true;
  hasSearched.value = true;
  try {
    mosques.value = await search(query);
  } catch {
    toast.error('Pencarian masjid gagal, coba lagi');
  } finally {
    mosquesLoading.value = false;
  }
}

function resetSearch() {
  searchQuery.value = '';
  hasSearched.value = false;
  loadNearbyMosques();
}

function mapsUrl(mosque: MosqueSummary): string {
  return `https://www.google.com/maps?q=${mosque.latitude},${mosque.longitude}`;
}

onMounted(() => {
  loadFeatured();
  loadNearbyMosques();
});
</script>
```

Note: `useMosqueSearch`, `useFridayAssignment`, `usePeople` are Nuxt auto-imported composables (no explicit `import` line needed for them specifically, matching how `useAuth()` is already called unqualified elsewhere in this codebase) — only their consumed types need explicit `import type`.

- [ ] **Step 2: Replace the `#jadwal-jumat` `<section>` in the template**

In the `<template>` block, replace the entire `<section id="jadwal-jumat" ...>...</section>` (currently lines 270–387) with:

```vue
    <!-- SECTION 1: FEATURED FRIDAY PRAYER (JADWAL JUMAT INI) -->
    <section id="jadwal-jumat" class="py-12 border-b border-border bg-card/30">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div class="flex items-center gap-2">
              <Badge variant="secondary" class="gap-1 font-semibold uppercase tracking-wider text-[10px]">
                <Calendar class="size-3" />
                <span>Jadwal Khutbah Jumat Terkini</span>
              </Badge>
            </div>
            <h2 class="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Sorotan Jadwal Shalat Jumat
            </h2>
          </div>
        </div>

        <Skeleton v-if="featuredLoading" class="h-64 w-full rounded-xl" />

        <div
          v-else-if="!featuredMosque"
          class="rounded-xl border border-dashed border-border p-12 text-center space-y-3"
        >
          <Calendar class="size-10 text-muted-foreground mx-auto" />
          <h3 class="font-display text-base font-semibold">Belum Ada Masjid Terdekat</h3>
          <p class="text-xs text-muted-foreground max-w-sm mx-auto">
            Izinkan akses lokasi browser Anda, atau cari nama masjid di bawah untuk melihat jadwal Jumat.
          </p>
        </div>

        <!-- Featured Banner Card -->
        <Card v-else class="border-border bg-card shadow-sm overflow-hidden">
          <div class="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
            <div class="p-6 lg:p-8 lg:col-span-2 space-y-6">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <Badge variant="approved">Masjid Terverifikasi</Badge>
                  <span v-if="featuredMosque.distanceKm !== undefined" class="font-mono text-xs tabular-nums text-muted-foreground">
                    Jarak: {{ featuredMosque.distanceKm.toFixed(1) }} km
                  </span>
                </div>
              </div>

              <div>
                <h3 class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance">
                  {{ featuredMosque.name }}
                </h3>
                <p class="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin class="size-3.5 text-primary shrink-0" />
                  <span>{{ featuredMosque.address }}</span>
                </p>
              </div>

              <template v-if="featuredAssignment?.has_assignment">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
                  <div class="space-y-1">
                    <span class="text-muted-foreground font-medium">Khatib:</span>
                    <div class="font-semibold text-foreground text-sm">
                      {{ resolvePersonName(featuredAssignment.khatibPersonId, featuredPeople) ?? 'Belum ditentukan' }}
                    </div>
                  </div>
                  <div class="space-y-1">
                    <span class="text-muted-foreground font-medium">Imam:</span>
                    <div class="font-semibold text-foreground text-sm">
                      {{ resolvePersonName(featuredAssignment.imamPersonId, featuredPeople) ?? 'Belum ditentukan' }}
                    </div>
                  </div>
                  <div class="space-y-1">
                    <span class="text-muted-foreground font-medium">Muadzin:</span>
                    <div class="font-semibold text-foreground text-sm">
                      {{ resolvePersonName(featuredAssignment.muazzinPersonId, featuredPeople) ?? 'Belum ditentukan' }}
                    </div>
                  </div>
                </div>
              </template>
              <div v-else-if="featuredAssignment" class="rounded-xl border border-border/80 bg-background p-4">
                <p class="text-sm text-muted-foreground">
                  Belum ada jadwal untuk Jumat {{ featuredAssignment.assignment_date }}.
                </p>
              </div>
            </div>

            <div class="p-6 lg:p-8 bg-card/50 flex flex-col justify-between space-y-6">
              <div class="space-y-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Koordinat:</span>
                  <span class="font-mono font-medium tabular-nums">{{ featuredMosque.latitude.toFixed(4) }}, {{ featuredMosque.longitude.toFixed(4) }}</span>
                </div>
              </div>

              <div class="space-y-2 pt-4">
                <NuxtLink :to="`/masjid/${featuredMosque.id}`">
                  <Button class="w-full gap-2">
                    <Compass class="size-4" />
                    <span>Lihat Profil Masjid</span>
                  </Button>
                </NuxtLink>
                <a :href="mapsUrl(featuredMosque)" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" class="w-full">
                    Petunjuk Arah Rute
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
```

- [ ] **Step 3: Manual smoke test**

Run (from `apps/web`): `npm run dev`, open `http://localhost:3000/`.

- If the browser prompts for location access, click "Allow". Expected: `#jadwal-jumat` section shows a real approved mosque (or the "Belum Ada Masjid Terdekat" empty state if no approved mosques exist within 5km of your test location — seed at least one approved mosque near your test coordinates first, e.g. via the Module 3 approval flow, to see the populated state).
- If you deny location access, expected: the empty state renders, no console error.
- Confirm no reference to `capacity`, `cash`, `khatibTitle`, `topic`, or `facilities` appears anywhere in this section's rendered output.

Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/pages/index.vue
git commit -m "feat(web): rewire index.vue jadwal-jumat section to live data"
```

---

### Task 7: Rewrite `index.vue` — `#masjid` and `#daftar-masjid` sections, delete `#transparansi`

**Files:**
- Modify: `apps/web/pages/index.vue`

**Interfaces:**
- Consumes: `mosques`, `mosquesLoading`, `hasSearched`, `searchQuery`, `runSearch`, `resetSearch`, `mapsUrl` from Task 6's script (already in the file from the previous task).
- Produces: nothing new for later tasks — this is the final template edit to this file within this plan.

- [ ] **Step 1: Replace the `#masjid` `<section>` in the template**

Replace the entire `<section id="masjid" ...>...</section>` (currently the "SECTION 2: MOSQUE DIRECTORY" block) with:

```vue
    <!-- SECTION 2: MOSQUE DIRECTORY (DAFTAR MASJID) -->
    <section id="masjid" class="py-16">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div class="flex items-center gap-2">
              <Badge variant="approved">Daftar Terverifikasi</Badge>
              <span class="text-xs text-muted-foreground">Menampilkan {{ mosques.length }} masjid</span>
            </div>
            <h2 class="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {{ hasSearched ? 'Hasil Pencarian' : 'Eksplorasi Masjid Terdekat' }}
            </h2>
          </div>
        </div>

        <div v-if="mosquesLoading" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton v-for="n in 6" :key="n" class="h-56 w-full rounded-xl" />
        </div>

        <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="mosque in mosques"
            :key="mosque.id"
            class="border-border shadow-sm flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-md group"
          >
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <Badge variant="approved" class="text-[11px] gap-1">
                  <ShieldCheck class="size-3" />
                  <span>Disetujui</span>
                </Badge>
                <span
                  v-if="mosque.distanceKm !== undefined"
                  class="font-mono text-xs tabular-nums text-muted-foreground bg-background px-2 py-0.5 rounded border border-border"
                >
                  {{ mosque.distanceKm.toFixed(1) }} km
                </span>
              </div>

              <CardTitle class="mt-3 font-display text-lg font-bold group-hover:text-primary transition-colors text-balance">
                {{ mosque.name }}
              </CardTitle>
              <CardDescription class="flex items-center gap-1 text-xs">
                <MapPin class="size-3 text-muted-foreground shrink-0" />
                <span class="truncate">{{ mosque.address }}</span>
              </CardDescription>
            </CardHeader>

            <CardFooter class="border-t border-border pt-4 gap-2">
              <NuxtLink :to="`/masjid/${mosque.id}`" class="flex-1">
                <Button size="sm" class="w-full">
                  Lihat Profil
                </Button>
              </NuxtLink>
              <a :href="mapsUrl(mosque)" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  <Compass class="size-3.5" />
                </Button>
              </a>
            </CardFooter>
          </Card>
        </div>

        <div v-if="!mosquesLoading && mosques.length === 0" class="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <Building2 class="size-10 text-muted-foreground mx-auto" />
          <h3 class="font-display text-base font-semibold">Tidak Ada Masjid Ditemukan</h3>
          <p class="text-xs text-muted-foreground max-w-sm mx-auto">
            {{ hasSearched ? 'Coba kata kunci lain, atau reset untuk melihat masjid terdekat.' : 'Izinkan akses lokasi, atau ketik nama masjid untuk mencari.' }}
          </p>
          <Button v-if="hasSearched" size="sm" variant="outline" @click="resetSearch">
            Reset Pencarian
          </Button>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Replace the hero search bar to call `runSearch`**

In the hero section (`<section class="relative border-b ...">`), the search `<input>` and "Cari" button currently do nothing. Replace the interactive search block (the `<div class="pt-4 max-w-2xl mx-auto">...</div>` containing the search bar and the old location filter chips) with:

```vue
          <div class="pt-4 max-w-2xl mx-auto">
            <form class="relative flex items-center rounded-xl border border-border bg-card p-1.5 shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20" @submit.prevent="runSearch">
              <div class="pl-3 pr-2 text-muted-foreground">
                <Search class="size-5" />
              </div>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Cari nama masjid atau alamat..."
                class="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              >
              <Button type="submit" size="sm" class="gap-1.5 shrink-0 px-4">
                <span>Cari</span>
              </Button>
            </form>
          </div>
```

This removes the hardcoded `locations` filter chips (Baiturrahman, Lueng Bata, etc.) entirely — Module 4 does not support Province/City filtering (documented out-of-scope in `docs/superpowers/specs/2026-08-23-module-4-mosque-search.md` §Batasan).

- [ ] **Step 3: Replace the `#daftar-masjid` `<section>` and delete `#transparansi`**

Replace the entire `<section id="daftar-masjid" ...>...</section>` (the "SECTION 4: DKM REGISTRATION CTA" block, including its `Dialog`) with a section that links out instead of opening an inline dialog:

```vue
    <!-- SECTION 3: DKM REGISTRATION CTA -->
    <section id="daftar-masjid" class="py-16">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="rounded-2xl border border-border bg-card p-8 sm:p-12 shadow-sm">
          <div class="mx-auto max-w-2xl text-center space-y-4">
            <Badge variant="approved">Khusus Pengurus BKM & DKM</Badge>
            <h2 class="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
              Daftarkan Masjid Anda di Baituna
            </h2>
            <p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Permudah pengelolaan jadwal shalat Jumat dan penugasan khatib mingguan secara mandiri.
            </p>

            <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <NuxtLink to="/masjid/daftar">
                <Button size="lg" class="gap-2 w-full sm:w-auto">
                  <PlusCircle class="size-4" />
                  <span>Ajukan Pendaftaran Masjid</span>
                </Button>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>
```

Delete the entire `<section id="transparansi" ...>...</section>` (the "SECTION 3: TRANSPARENCY & STATS" block) — it no longer exists in the file after this step.

Note: `/masjid/daftar` does not exist yet at this point in the overall UI rollout — it is built by the Module 3 UI plan. This link is correct regardless of build order (Nuxt does not error on a `NuxtLink` to a route that doesn't exist yet at dev-server-start; it 404s only if actually navigated to before that page exists).

- [ ] **Step 4: Remove now-unused imports**

Confirm `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger`, `DialogClose` and `Input` are no longer referenced anywhere in the file (they were only used by the old inline registration dialog and the old `#masjid` filter chips) and remove their `import` line if present in the script block written in Task 6 Step 1 — it already omits them, so this step is a verification, not an edit, unless a previous task's execution left stale imports.

- [ ] **Step 5: Manual smoke test**

Run (from `apps/web`): `npm run dev`, open `http://localhost:3000/`.

- Type a mosque name that exists (approved status) into the hero search bar and press Enter or click "Cari". Expected: `#masjid` section updates to show matching results, heading changes to "Hasil Pencarian".
- Click "Reset Pencarian" (visible only in the empty-search-result state) or clear the search box and resubmit with empty query. Expected: reverts to nearby-mosques view.
- Click "Ajukan Pendaftaran Masjid". Expected: navigates to `/masjid/daftar` (may 404 if Module 3 UI plan hasn't run yet — that's expected at this stage, not a bug in this plan).
- Confirm the `#transparansi` section (stat counters) no longer renders anywhere on the page.
- Click each `AppHeader.vue` nav link ("Beranda", "Cari Masjid", "Jadwal Jumat") and confirm each anchor scrolls to the correct section.

Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add apps/web/pages/index.vue
git commit -m "feat(web): rewire index.vue masjid/daftar-masjid sections, remove transparansi"
```

---

### Task 8: `/masjid/[id]` — public mosque detail page

**Files:**
- Create: `apps/web/pages/masjid/[id].vue`

**Interfaces:**
- Consumes: `useMosqueSearch` (Task 2), `useFridayAssignment` (Task 4), `usePeople` (Task 3), `MosqueDetail`/`CurrentFridayAssignment`/`FridayAssignment`/`PaginatedAssignments`/`Person` (Task 1), `Tabs`/`Pagination` components (Task 5), `useAuth` (existing, `apps/web/composables/useAuth.ts`).
- Produces: nothing consumed by other tasks in this plan — this is a leaf page. The Module 5/6 UI plans link to `/admin/masjid/[id]` from the "Kelola Masjid Ini" button this page renders, but do not import anything from this file.

Public page, no `middleware` applied. 404 (mosque not found/not approved/deleted — collapsed by the backend into one case) renders an inline "not found" state rather than throwing, since this repo has no custom error page convention yet (spec §5 explicitly defers that decision).

- [ ] **Step 1: Create the page**

```vue
<!-- apps/web/pages/masjid/[id].vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { MapPin, Compass, Building2, Settings, Calendar } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';

import type { CurrentFridayAssignment, FridayAssignment, MosqueDetail, Person } from '~/types/api';

const route = useRoute();
const mosqueId = route.params.id as string;

const { detail } = useMosqueSearch();
const { getCurrent, getHistory } = useFridayAssignment();
const { listActive } = usePeople();
const { user } = useAuth();

const mosque = ref<MosqueDetail | null>(null);
const notFound = ref(false);
const loading = ref(true);

const currentAssignment = ref<CurrentFridayAssignment | null>(null);
const people = ref<Person[]>([]);
const historyItems = ref<FridayAssignment[]>([]);
const historyPage = ref(1);
const historyPageSize = 10;
const historyTotal = ref(0);
const historyTotalPages = computed(() => Math.max(1, Math.ceil(historyTotal.value / historyPageSize)));

const canManage = computed(() => {
  if (!mosque.value || !user.value) return false;
  return user.value.role === 'super_admin' || user.value.id === mosque.value.adminUserId;
});

function resolvePersonName(personId: string | null): string | null {
  if (!personId) return null;
  return people.value.find((person) => person.id === personId)?.name ?? null;
}

function mapsUrl(m: MosqueDetail): string {
  return `https://www.google.com/maps?q=${m.latitude},${m.longitude}`;
}

async function loadHistory(page: number) {
  if (!mosque.value) return;
  try {
    const result = await getHistory(mosque.value.id, page, historyPageSize);
    historyItems.value = result.items;
    historyTotal.value = result.total;
    historyPage.value = result.page;
  } catch {
    toast.error('Gagal memuat riwayat jadwal Jumat');
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    const result = await detail(mosqueId);
    if (!result) {
      notFound.value = true;
      return;
    }
    mosque.value = result;

    const [assignment, activePeople] = await Promise.all([
      getCurrent(result.id),
      listActive(result.id),
    ]);
    currentAssignment.value = assignment;
    people.value = activePeople;
    await loadHistory(1);
  } catch {
    toast.error('Gagal memuat detail masjid');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-background text-foreground transition-colors flex flex-col justify-between">
    <AppHeader />

    <main class="flex-1">
      <div v-if="loading" class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-4">
        <Skeleton class="h-10 w-2/3" />
        <Skeleton class="h-4 w-1/2" />
        <Skeleton class="h-64 w-full rounded-xl" />
      </div>

      <div v-else-if="notFound" class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-24 text-center space-y-3">
        <Building2 class="size-10 text-muted-foreground mx-auto" />
        <h1 class="font-display text-2xl font-bold">Masjid Tidak Ditemukan</h1>
        <p class="text-sm text-muted-foreground">
          Masjid ini tidak ada, belum disetujui, atau sudah dihapus.
        </p>
        <NuxtLink to="/">
          <Button variant="outline" size="sm">Kembali ke Beranda</Button>
        </NuxtLink>
      </div>

      <div v-else-if="mosque" class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="approved">Masjid Terverifikasi</Badge>
            <h1 class="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance">
              {{ mosque.name }}
            </h1>
            <p class="mt-1 text-sm text-muted-foreground flex items-center gap-1">
              <MapPin class="size-4 text-primary shrink-0" />
              <span>{{ mosque.address }}</span>
            </p>
          </div>
          <NuxtLink v-if="canManage" :to="`/admin/masjid/${mosque.id}`">
            <Button variant="outline" size="sm" class="gap-1.5">
              <Settings class="size-4" />
              <span>Kelola Masjid Ini</span>
            </Button>
          </NuxtLink>
        </div>

        <Tabs default-value="jadwal">
          <TabsList>
            <TabsTrigger value="jadwal">Jadwal Jumat</TabsTrigger>
            <TabsTrigger value="tentang">Tentang</TabsTrigger>
          </TabsList>

          <TabsContent value="jadwal" class="space-y-6 pt-4">
            <Card>
              <CardContent class="pt-6">
                <div class="flex items-center gap-2 mb-4">
                  <Calendar class="size-4 text-secondary-foreground" />
                  <h2 class="font-display text-lg font-semibold">Jumat Ini / Berikutnya</h2>
                </div>

                <template v-if="currentAssignment?.has_assignment">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span class="text-xs text-muted-foreground">Tanggal:</span>
                      <div class="font-medium tabular-nums">{{ currentAssignment.assignmentDate }}</div>
                    </div>
                    <div>
                      <span class="text-xs text-muted-foreground">Khatib:</span>
                      <div class="font-medium">{{ resolvePersonName(currentAssignment.khatibPersonId) ?? 'Belum ditentukan' }}</div>
                    </div>
                    <div>
                      <span class="text-xs text-muted-foreground">Imam:</span>
                      <div class="font-medium">{{ resolvePersonName(currentAssignment.imamPersonId) ?? 'Belum ditentukan' }}</div>
                    </div>
                  </div>
                </template>
                <p v-else-if="currentAssignment" class="text-sm text-muted-foreground">
                  Belum ada jadwal untuk Jumat {{ currentAssignment.assignment_date }}.
                </p>
              </CardContent>
            </Card>

            <Separator />

            <div>
              <h3 class="font-display text-sm font-semibold mb-3">Riwayat Jadwal</h3>
              <div v-if="historyItems.length === 0" class="text-sm text-muted-foreground">
                Belum ada riwayat jadwal Jumat.
              </div>
              <ul v-else class="space-y-2">
                <li
                  v-for="item in historyItems"
                  :key="item.id"
                  class="rounded-lg border border-border bg-card p-3 text-sm flex flex-wrap items-center justify-between gap-2"
                >
                  <span class="font-medium tabular-nums">{{ item.assignmentDate }}</span>
                  <span class="text-xs text-muted-foreground">
                    Khatib: {{ resolvePersonName(item.khatibPersonId) ?? '—' }}
                  </span>
                </li>
              </ul>

              <Pagination v-if="historyTotalPages > 1" class="mt-4" :total="historyTotal" :items-per-page="historyPageSize" :page="historyPage">
                <PaginationContent>
                  <PaginationPrevious @click="loadHistory(Math.max(1, historyPage - 1))" />
                  <PaginationItem
                    v-for="page in historyTotalPages"
                    :key="page"
                    :value="page"
                    :is-active="page === historyPage"
                    @click="loadHistory(page)"
                  >
                    {{ page }}
                  </PaginationItem>
                  <PaginationNext @click="loadHistory(Math.min(historyTotalPages, historyPage + 1))" />
                </PaginationContent>
              </Pagination>
            </div>
          </TabsContent>

          <TabsContent value="tentang" class="space-y-4 pt-4">
            <Card>
              <CardContent class="pt-6 space-y-3 text-sm">
                <div>
                  <span class="text-xs text-muted-foreground">Alamat:</span>
                  <p class="font-medium">{{ mosque.address }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Koordinat:</span>
                  <p class="font-mono font-medium tabular-nums">{{ mosque.latitude }}, {{ mosque.longitude }}</p>
                </div>
                <a :href="mapsUrl(mosque)" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" class="gap-1.5">
                    <Compass class="size-4" />
                    <span>Buka di Google Maps</span>
                  </Button>
                </a>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors. If the installed `pagination` component's prop names differ from `total`/`items-per-page`/`page`/`value`/`is-active` used above, adjust to match what `npx shadcn-vue@latest add pagination` (Task 5) actually generated — read `apps/web/components/ui/pagination/Pagination.vue` and its sibling files for the exact prop contract before adjusting, since shadcn-vue component APIs can differ by version.

- [ ] **Step 3: Manual smoke test**

Run (from `apps/web`): `npm run dev`.

- Navigate to `http://localhost:3000/masjid/<a-real-approved-mosque-uuid>`. Expected: mosque name, address, and Jadwal Jumat tab render with real data (or the empty "Belum ada jadwal" message if no assignment exists yet for that mosque).
- Switch to the "Tentang" tab. Expected: address, coordinates, and a working "Buka di Google Maps" link.
- Navigate to `http://localhost:3000/masjid/00000000-0000-0000-0000-000000000000` (a syntactically valid but non-existent UUID). Expected: "Masjid Tidak Ditemukan" state, no console error, no page crash.
- While logged out, confirm the "Kelola Masjid Ini" button is absent. While logged in as the mosque's actual `adminUserId` (or as `super_admin`), confirm the button appears and links to `/admin/masjid/<id>` (may 404 at this stage if Module 5/6 UI plans haven't run yet — expected).
- If the mosque has more than 10 Friday assignment history entries, confirm pagination controls appear and clicking a page number loads different rows.

Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/pages/masjid/[id].vue
git commit -m "feat(web): add public mosque detail page with Jadwal Jumat tabs"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (mockup findings) → addressed by Tasks 6–7 removing every fabricated field. §2.1 (types) → Task 1. §2.2 (composables) → Tasks 2–4. §2.3 (ownership gating) → Task 8's `canManage` computed, matching the spec's exact `user.id === mosque.adminUserId || role === 'super_admin'` rule. §2.4 (routes) → `/masjid/[id]` is Task 8; `/` stays at its existing path. §3 (tabs/pagination install, no-map/no-calendar decisions) → Task 5 installs components; this plan never introduces a map library or calendar picker, consistent with the approved decision. §4.1 (index.vue rewrite, section by section) → Tasks 6–7 cover all three retained sections plus deletion of `#transparansi`. §4.3 (`/masjid/[id]`) → Task 8.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable Vue SFC content, not prose descriptions of changes.
- **Anchor IDs preserved:** confirmed `#jadwal-jumat` (Task 6 Step 2), `#masjid` (Task 7 Step 1), `#daftar-masjid` (Task 7 Step 3) all remain as `id` attributes on their `<section>` elements, matching what `AppHeader.vue`'s `NuxtLink to="/#..."` targets expect — verified by including an explicit smoke-test step (Task 7 Step 5) that clicks each header nav link.
- **Type consistency:** `MosqueSummary`, `MosqueDetail`, `CurrentFridayAssignment`, `FridayAssignment`, `PaginatedAssignments`, `Person` are defined once in Task 1 and reused unchanged through every later task — field names (`assignmentDate` vs `assignment_date`, `khatibPersonId`, `distanceKm?`) match the verified backend service code exactly, not the design spec's prose paraphrase, since Task 1 was written after re-reading `mosque-search.service.ts`, `friday-assignment.service.ts`, and `person.service.ts` directly.
- **Composable file ownership across parallel plans:** Tasks 3 and 4 explicitly create `usePeople.ts`/`useFridayAssignment.ts` with only their read methods and document in each task's Interfaces block that Module 5/6 UI plans add write methods to the same files later — this prevents a later plan from assuming it must create these files from scratch and accidentally dropping the read methods this plan adds.
- **Geolocation failure path:** `useMosqueSearch().nearby()` never rejects on denied/unavailable geolocation — it resolves to `[]`, so every caller in Tasks 6–8 renders an explicit empty state rather than needing per-call try/catch for that specific failure mode. This was a deliberate simplification over the spec's prose (which described the fallback behavior narratively) made concrete here as a Promise contract.
