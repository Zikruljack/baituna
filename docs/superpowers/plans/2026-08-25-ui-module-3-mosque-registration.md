# UI Module 3: Mosque Registration & Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend for the mosque registration lifecycle — a form to submit a mosque (`/masjid/daftar`), a page showing the caller's own submissions and their status (`/masjid/pendaftaran-saya`), and a Super Admin approval queue (`/admin/pendaftaran`) — wired to the Module 3 backend endpoints that already exist under `apps/web/server/api/mosques/**`.

**Architecture:** Nuxt 4 fullstack app (`apps/web`), frontend-only change (no backend files touched). Adds hand-written types to the shared `apps/web/types/api.ts` file, a `composables/useMosqueRegistration.ts` composable wrapping the four Module 3 endpoints, a new generic `middleware/require-role.ts` for Super-Admin-only pages (reused by later modules), and three pages. Two new shadcn-vue components (`form`, `textarea`) are installed as part of this plan since no earlier module needed them.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript (strict), Zod (already a dependency — `createMosqueSchema` is reused client-side for the registration form's validation), shadcn-vue (`form`, `textarea`, plus already-installed `input`, `select`, `button`, `card`, `alert`, `badge`, `table`, `dialog`, `label`).

**Spec:** `docs/superpowers/specs/2026-08-25-baituna-web-ui-design.md` §2.1 (types), §2.2 (composable), §2.3 (role gating), §2.4 (routes), §3 (new components, no-map decision), §4.2, §4.4, §4.5. Backend contract: `docs/superpowers/specs/2026-08-23-module-3-mosque-registration.md`, verified against `apps/web/server/services/mosque.service.ts` and `apps/web/server/utils/validation.ts`.

## Global Constraints

- Do not modify any file under `apps/web/server/**`. The six Module 3 endpoints (`POST /mosques`, `GET /mosques/pending`, `PATCH /mosques/:id/approve`, `PATCH /mosques/:id/reject`, `PATCH /mosques/:id`, `GET /mosques/my-submissions`) are settled and consumed as-is.
- `latitude`/`longitude` are sent to the backend as **strings** matching `^-?\d{1,3}\.\d{1,7}$` (max 7 decimal places), never as `number` — this is a Zod string-regex field on the server (`apps/web/server/utils/validation.ts`), not a numeric column type on the wire.
- `apps/web/server/utils/openapi.ts` has no `components.schemas` — types are hand-written in `apps/web/types/api.ts`, mirrored from the server code cited above, never generated.
- Read-heavy calls to endpoints that don't need reactivity to a changing parameter (approval queue list, my-submissions list) use `useApi`/`useFetch`. Write actions (submit, approve, reject) call `$fetch` directly inside the composable, matching `useAuth().login()`'s pattern — errors are thrown as-is and the calling page's `try/catch` shows a `toast.error` (`vue-sonner`, already used in `pages/index.vue`).
- `apps/web/types/api.ts` is a **shared file** — Module 2, 5, 6 plans also add sections to it. This plan creates the file if it doesn't exist yet (defensive: plan execution order across modules is not guaranteed) using a clearly delimited per-module comment block, so later plans can append without needing to touch this plan's block.
- `middleware/require-role.ts` (this plan creates it) is **shared** — Module 5 and Module 6 plans reuse it unmodified for their own admin pages. Build it generically now, not scoped to only Super Admin.
- Follow existing code conventions: 2-space indent, named exports (no default exports for non-page/non-component `.ts` files), JSDoc-style one-line comments only where the WHY isn't obvious.
- Run `npm run typecheck` and `npm run lint` (from `apps/web`) after every task that adds `.vue` or `.ts` files.
- Every command in this plan runs from `apps/web/` unless stated otherwise.

---

## Reference: exact server contracts (already implemented, do not change)

`POST /api/mosques` (`apps/web/server/api/mosques/index.post.ts`) — auth required (any role). Body (`createMosqueSchema`):
```json
{ "name": "string, 1-200 chars", "address": "string, 1-500 chars", "latitude": "string, regex ^-?\\d{1,3}\\.\\d{1,7}$", "longitude": "string, same regex", "cityId": "uuid", "provinceId": "uuid" }
```
Success (201):
```json
{ "id": "uuid", "name": "string", "status": "pending", "duplicateWarning": [{ "id": "uuid", "name": "string", "address": "string", "distanceMeters": 42, "nameSimilarity": 0.62 }] }
```
`duplicateWarning` is always present, empty array if no candidates. Never blocks the submission — the mosque is created regardless.

`GET /api/mosques/pending` (`apps/web/server/api/mosques/pending.get.ts`) — auth: `super_admin` only (401/403 otherwise). Success (200): array, oldest `createdAt` first:
```json
[{ "id": "uuid", "name": "string", "address": "string", "createdAt": "2026-08-25T10:00:00.000Z", "submittedBy": "uuid | null" }]
```
(`createdAt` is a JS `Date` server-side, serialized to an ISO string over JSON — the frontend type is `string`.)

`PATCH /api/mosques/:id/approve` — auth: `super_admin`. Success (200): `{ "id": "uuid", "status": "approved" }`. Errors: `404` (not found/soft-deleted), `409` (not pending), `422` (data-integrity edge case, should not occur through normal flow).

`PATCH /api/mosques/:id/reject` — auth: `super_admin`. Success (200): `{ "id": "uuid", "status": "rejected" }`. Errors: `404`, `409` (same as approve, no `422`).

`GET /api/mosques/my-submissions` — auth: any authenticated user. Success (200): array, newest `createdAt` first:
```json
[{ "id": "uuid", "name": "string", "status": "pending" | "approved" | "rejected", "createdAt": "2026-08-25T10:00:00.000Z" }]
```

---

### Task 1: Install `form` and `textarea` shadcn-vue components

**Files:**
- Create (via CLI, not hand-written): `apps/web/components/ui/form/**`, `apps/web/components/ui/textarea/**`

**Interfaces:**
- Consumes: nothing.
- Produces: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` (form), `Textarea` (textarea) — consumed by Task 6 (`/masjid/daftar` page).

No TDD steps — this is a CLI scaffold task, not logic.

- [ ] **Step 1: Install the components**

Run (from `apps/web`):
```bash
npx shadcn-vue@latest add form textarea
```
Accept any prompts with defaults (the project's `components.json` already configures aliases and style — see `apps/web/components.json`). This will also add `vee-validate` and `@vee-validate/zod` (or equivalent form-handling deps) as npm dependencies if not already present — that is expected and required for the `form` component to work with Zod schemas.

- [ ] **Step 2: Verify the files landed**

Run: `ls apps/web/components/ui/form apps/web/components/ui/textarea`
Expected: both directories exist with `.vue`/`index.ts` files, mirroring the structure of `apps/web/components/ui/select/`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/form apps/web/components/ui/textarea apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): add form and textarea shadcn-vue components"
```

---

### Task 2: Mosque registration types

**Files:**
- Create: `apps/web/types/api.ts` (if it does not already exist — check first; if it exists, this task **appends** a new section rather than overwriting the file)

**Interfaces:**
- Consumes: nothing (pure type definitions).
- Produces: `MosqueRegistrationInput`, `DuplicateWarning`, `CreatedMosqueRegistration`, `PendingMosque`, `MySubmission`, `MosqueStatus` — imported by `composables/useMosqueRegistration.ts` (Task 3) and the three pages (Tasks 6, 7, 8).

- [ ] **Step 1: Check whether the file exists**

Run: `test -f apps/web/types/api.ts && echo EXISTS || echo MISSING`

- [ ] **Step 2a: If MISSING, create the file with this exact content**

```typescript
// apps/web/types/api.ts
//
// Hand-written types mirroring backend response/request shapes. The server's
// OpenAPI document (apps/web/server/utils/openapi.ts) has no
// components.schemas — it is descriptions only — so these are maintained by
// hand, one section per module. Keep in sync manually when a backend
// contract changes; each section links back to the module spec it mirrors.

// ---------------------------------------------------------------------------
// Module 3 — Mosque Registration & Approval
// Spec: docs/superpowers/specs/2026-08-23-module-3-mosque-registration.md
// ---------------------------------------------------------------------------

/** Body for POST /api/mosques. latitude/longitude are strings, not numbers — see apps/web/server/utils/validation.ts latitudeSchema/longitudeSchema. */
export interface MosqueRegistrationInput {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  cityId: string;
  provinceId: string;
}

/** One fuzzy-duplicate candidate returned in POST /api/mosques's 201 response. Informational only — never blocks submission. */
export interface DuplicateWarning {
  id: string;
  name: string;
  address: string;
  distanceMeters: number;
  nameSimilarity: number;
}

/** Full 201 response body from POST /api/mosques. */
export interface CreatedMosqueRegistration {
  id: string;
  name: string;
  status: 'pending';
  duplicateWarning: DuplicateWarning[];
}

export type MosqueStatus = 'pending' | 'approved' | 'rejected';

/** One row from GET /api/mosques/pending (Super Admin only). */
export interface PendingMosque {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  submittedBy: string | null;
}

/** One row from GET /api/mosques/my-submissions. */
export interface MySubmission {
  id: string;
  name: string;
  status: MosqueStatus;
  createdAt: string;
}
```

- [ ] **Step 2b: If EXISTS, append this section to the end of the file**

Read the current end of `apps/web/types/api.ts` first, then append (preserving whatever earlier module sections are already there — do not remove or reorder them):

```typescript

// ---------------------------------------------------------------------------
// Module 3 — Mosque Registration & Approval
// Spec: docs/superpowers/specs/2026-08-23-module-3-mosque-registration.md
// ---------------------------------------------------------------------------

/** Body for POST /api/mosques. latitude/longitude are strings, not numbers — see apps/web/server/utils/validation.ts latitudeSchema/longitudeSchema. */
export interface MosqueRegistrationInput {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  cityId: string;
  provinceId: string;
}

/** One fuzzy-duplicate candidate returned in POST /api/mosques's 201 response. Informational only — never blocks submission. */
export interface DuplicateWarning {
  id: string;
  name: string;
  address: string;
  distanceMeters: number;
  nameSimilarity: number;
}

/** Full 201 response body from POST /api/mosques. */
export interface CreatedMosqueRegistration {
  id: string;
  name: string;
  status: 'pending';
  duplicateWarning: DuplicateWarning[];
}

export type MosqueStatus = 'pending' | 'approved' | 'rejected';

/** One row from GET /api/mosques/pending (Super Admin only). */
export interface PendingMosque {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  submittedBy: string | null;
}

/** One row from GET /api/mosques/my-submissions. */
export interface MySubmission {
  id: string;
  name: string;
  status: MosqueStatus;
  createdAt: string;
}
```

Only run Step 2a **or** 2b, whichever matches Step 1's output — not both.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/types/api.ts
git commit -m "feat(web): add mosque registration types"
```

---

### Task 3: `useMosqueRegistration` composable

**Files:**
- Create: `apps/web/composables/useMosqueRegistration.ts`

**Interfaces:**
- Consumes: `MosqueRegistrationInput`, `CreatedMosqueRegistration`, `PendingMosque`, `MySubmission` from `apps/web/types/api.ts` (Task 2); `useAuthToken` from `apps/web/composables/useAuth.ts` (already exists).
- Produces:
  - `submitMosqueRegistration(input: MosqueRegistrationInput): Promise<CreatedMosqueRegistration>` — consumed by Task 6 (`/masjid/daftar`).
  - `listPendingMosques(): Promise<PendingMosque[]>` — consumed by Task 8 (`/admin/pendaftaran`).
  - `approveMosque(mosqueId: string): Promise<{ id: string; status: 'approved' }>` — consumed by Task 8.
  - `rejectMosque(mosqueId: string): Promise<{ id: string; status: 'rejected' }>` — consumed by Task 8.
  - `listMySubmissions(): Promise<MySubmission[]>` — consumed by Task 7 (`/masjid/pendaftaran-saya`).

All five are plain async functions wrapping `$fetch` directly (matching `useAuth().login()`'s pattern), not `useApi`/`useFetch` — none of these calls need to react to a changing reactive parameter, they are one-shot actions/loads triggered by page lifecycle or button clicks.

- [ ] **Step 1: Create the composable**

```typescript
// apps/web/composables/useMosqueRegistration.ts
import type {
  CreatedMosqueRegistration,
  MosqueRegistrationInput,
  MySubmission,
  PendingMosque,
} from '~/types/api';

/** Write/read actions for the Module 3 mosque registration & approval lifecycle. */
export function useMosqueRegistration() {
  const token = useAuthToken();

  function authHeaders() {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {};
  }

  async function submitMosqueRegistration(input: MosqueRegistrationInput) {
    return await $fetch<CreatedMosqueRegistration>('/api/mosques', {
      method: 'POST',
      headers: authHeaders(),
      body: input,
    });
  }

  async function listPendingMosques() {
    return await $fetch<PendingMosque[]>('/api/mosques/pending', {
      headers: authHeaders(),
    });
  }

  async function approveMosque(mosqueId: string) {
    return await $fetch<{ id: string; status: 'approved' }>(`/api/mosques/${mosqueId}/approve`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  }

  async function rejectMosque(mosqueId: string) {
    return await $fetch<{ id: string; status: 'rejected' }>(`/api/mosques/${mosqueId}/reject`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  }

  async function listMySubmissions() {
    return await $fetch<MySubmission[]>('/api/mosques/my-submissions', {
      headers: authHeaders(),
    });
  }

  return {
    submitMosqueRegistration,
    listPendingMosques,
    approveMosque,
    rejectMosque,
    listMySubmissions,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors. (If Nuxt auto-import types for `$fetch`/`useAuthToken` are unresolved, run `npx nuxt prepare` first, then re-run typecheck — same note as the auth-frontend plan's Task 2.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/composables/useMosqueRegistration.ts
git commit -m "feat(web): add useMosqueRegistration composable"
```

---

### Task 4: `require-role` middleware

**Files:**
- Create: `apps/web/middleware/require-role.ts`

**Interfaces:**
- Consumes: `useAuth` from `apps/web/composables/useAuth.ts` (already exists, returns `{ user, ... }` where `user: Ref<AuthUser | null>`).
- Produces: the named middleware `'require-role'`. A page applies it alongside `'auth'` via `definePageMeta({ middleware: ['auth', 'require-role'], requiredRoles: ['super_admin'] })` — `requiredRoles` is read from `to.meta.requiredRoles`, cast at the call site. Consumed by Task 8 (`/admin/pendaftaran`, `requiredRoles: ['super_admin']`) in this plan, and by Module 5/6 plans later for `/admin/masjid/[id]` (`requiredRoles: ['mosque_admin', 'super_admin']`) — do not scope this file to Super-Admin-only logic.

- [ ] **Step 1: Create the middleware**

```typescript
// apps/web/middleware/require-role.ts
import { toast } from 'vue-sonner';

import type { UserRole } from '~/lib/auth-types';

/**
 * Redirects to / if the current user's role is not in the page's
 * `requiredRoles` meta. Must run after the 'auth' middleware (which
 * guarantees a token exists) — apply both together:
 * definePageMeta({ middleware: ['auth', 'require-role'], requiredRoles: [...] }).
 */
export default defineNuxtRouteMiddleware((to) => {
  const requiredRoles = to.meta.requiredRoles as UserRole[] | undefined;
  if (!requiredRoles || requiredRoles.length === 0) return;

  const { user } = useAuth();
  if (!user.value || !requiredRoles.includes(user.value.role)) {
    toast.error('Anda tidak memiliki akses ke halaman ini.');
    return navigateTo('/');
  }
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: an error about `requiredRoles` not existing on `PageMeta` is possible here — if so, add a module augmentation. Create `apps/web/types/page-meta.d.ts`:

```typescript
// apps/web/types/page-meta.d.ts
import type { UserRole } from '~/lib/auth-types';

declare module '#app' {
  interface PageMeta {
    requiredRoles?: UserRole[];
  }
}

export {};
```

Then re-run `npm run typecheck`. Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware/require-role.ts apps/web/types/page-meta.d.ts
git commit -m "feat(web): add require-role route middleware"
```

---

### Task 5: Wire `require-role` type augmentation only if Task 4 needed it — skip note

(No separate task — Task 4 Step 2 already handles this conditionally. Numbering continues at Task 6 to keep task IDs stable for cross-references from other module plans.)

---

### Task 6: `/masjid/daftar` — registration page

**Files:**
- Create: `apps/web/pages/masjid/daftar.vue`

**Interfaces:**
- Consumes: `useMosqueRegistration().submitMosqueRegistration` (Task 3); `useRegions().listProvinces`/`listCities` — **this composable is created by the Module 2 plan** (`docs/superpowers/plans/2026-08-25-ui-module-2-region-reference.md`); if that plan has not run yet when this task executes, `apps/web/composables/useRegions.ts` will not exist and this task's `npm run typecheck` (Step 2) will fail on the missing import. If that happens, stop and either run the Module 2 plan first or create a minimal stub matching this exact signature before continuing: `useRegions(): { listProvinces(): Promise<{ id: string; name: string }[]>; listCities(provinceId: string): Promise<{ id: string; name: string; provinceId: string }[]> }`.
- Produces: the `/masjid/daftar` route, linked from `pages/index.vue`'s `#daftar-masjid` section (that section's rewire is owned by the Module 4 plan, not this task — this task only needs the route to exist and work standalone).

- [ ] **Step 1: Create the page**

```vue
<!-- apps/web/pages/masjid/daftar.vue -->
<script setup lang="ts">
import { toast } from 'vue-sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { DuplicateWarning } from '~/types/api';

definePageMeta({ middleware: 'auth' });

const { submitMosqueRegistration } = useMosqueRegistration();
const { listProvinces, listCities } = useRegions();

const name = ref('');
const address = ref('');
const provinceId = ref('');
const cityId = ref('');
const latitude = ref('');
const longitude = ref('');

const provinces = ref<{ id: string; name: string }[]>([]);
const cities = ref<{ id: string; name: string; provinceId: string }[]>([]);
const isSubmitting = ref(false);
const isLocating = ref(false);
const duplicateWarning = ref<DuplicateWarning[]>([]);
const errorMessage = ref('');

onMounted(async () => {
  provinces.value = await listProvinces();
});

watch(provinceId, async (newProvinceId) => {
  cityId.value = '';
  cities.value = newProvinceId ? await listCities(newProvinceId) : [];
});

function useMyLocation() {
  if (!navigator.geolocation) {
    toast.error('Browser Anda tidak mendukung deteksi lokasi.');
    return;
  }
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      latitude.value = position.coords.latitude.toFixed(7);
      longitude.value = position.coords.longitude.toFixed(7);
      isLocating.value = false;
    },
    () => {
      toast.error('Gagal mendapatkan lokasi. Isi koordinat secara manual.');
      isLocating.value = false;
    },
  );
}

async function onSubmit() {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    const result = await submitMosqueRegistration({
      name: name.value,
      address: address.value,
      latitude: latitude.value,
      longitude: longitude.value,
      cityId: cityId.value,
      provinceId: provinceId.value,
    });
    duplicateWarning.value = result.duplicateWarning;
    toast.success('Pendaftaran masjid berhasil dikirim.');
    await navigateTo('/masjid/pendaftaran-saya');
  } catch {
    errorMessage.value = 'Gagal mengirim pendaftaran. Periksa kembali data yang diisi.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
    <Card>
      <CardHeader>
        <CardTitle class="font-display text-xl">Daftarkan Masjid</CardTitle>
        <CardDescription>Lengkapi data masjid untuk diverifikasi oleh Super Admin.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <Alert v-if="duplicateWarning.length > 0" variant="default">
          <AlertTitle>Kemungkinan Masjid Serupa Ditemukan</AlertTitle>
          <AlertDescription>
            <ul class="mt-2 space-y-1 text-xs">
              <li v-for="candidate in duplicateWarning" :key="candidate.id">
                {{ candidate.name }} — {{ candidate.address }} ({{ Math.round(candidate.distanceMeters) }}m, kemiripan {{ Math.round(candidate.nameSimilarity * 100) }}%)
              </li>
            </ul>
            <p class="mt-2">Pendaftaran Anda tetap tersimpan dan akan diproses.</p>
          </AlertDescription>
        </Alert>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <div class="space-y-2">
            <Label for="name">Nama Masjid</Label>
            <Input id="name" v-model="name" required maxlength="200" />
          </div>

          <div class="space-y-2">
            <Label for="address">Alamat</Label>
            <Textarea id="address" v-model="address" required maxlength="500" rows="3" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label>Provinsi</Label>
              <Select v-model="provinceId">
                <SelectTrigger><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="p in provinces" :key="p.id" :value="p.id">{{ p.name }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>Kabupaten/Kota</Label>
              <Select v-model="cityId" :disabled="!provinceId">
                <SelectTrigger><SelectValue placeholder="Pilih kabupaten/kota" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label>Koordinat</Label>
              <Button type="button" variant="outline" size="sm" :disabled="isLocating" @click="useMyLocation">
                {{ isLocating ? 'Mendeteksi...' : 'Gunakan Lokasi Saya Sekarang' }}
              </Button>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <Input v-model="latitude" placeholder="Latitude" required />
              <Input v-model="longitude" placeholder="Longitude" required />
            </div>
          </div>

          <Button type="submit" class="w-full" :disabled="isSubmitting">
            {{ isSubmitting ? 'Mengirim...' : 'Kirim Pendaftaran' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
```

Note: this task uses plain `v-model` inputs plus manual `try/catch`, not the newly-installed `form`/`FormField` Zod-integrated components — the six-field form here is simple enough that per-field Zod messages are not required for MVP, and the spec (§4.2) does not mandate `form` specifically, only lists it as an available component. If a future iteration wants field-level validation messages, swap this markup for `Form`/`FormField` bound to `createMosqueSchema` — not required by this plan.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open `http://localhost:3000/masjid/daftar` with no auth cookie set. Confirm it redirects to `/login?redirect=%2Fmasjid%2Fdaftar` (the `auth` middleware, already proven working by the auth-frontend plan). Then log in (seeded Super Admin or any test account) and revisit `/masjid/daftar` — confirm the form renders, the Province select populates (requires `DATABASE_URL` configured and Module 2's region seed run — if not available in this environment, confirm the page renders without a JS crash and note the seed dependency when reporting). Do not submit unless a full local backend is configured. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/pages/masjid/daftar.vue
git commit -m "feat(web): add mosque registration page"
```

---

### Task 7: `/masjid/pendaftaran-saya` — my submissions page

**Files:**
- Create: `apps/web/pages/masjid/pendaftaran-saya.vue`

**Interfaces:**
- Consumes: `useMosqueRegistration().listMySubmissions` (Task 3), `MySubmission` type (Task 2).
- Produces: the `/masjid/pendaftaran-saya` route.

- [ ] **Step 1: Create the page**

```vue
<!-- apps/web/pages/masjid/pendaftaran-saya.vue -->
<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MosqueStatus, MySubmission } from '~/types/api';

definePageMeta({ middleware: 'auth' });

const { listMySubmissions } = useMosqueRegistration();

const submissions = ref<MySubmission[]>([]);
const isLoading = ref(true);

onMounted(async () => {
  submissions.value = await listMySubmissions();
  isLoading.value = false;
});

const statusVariant: Record<MosqueStatus, 'approved' | 'pending' | 'rejected'> = {
  approved: 'approved',
  pending: 'pending',
  rejected: 'rejected',
};

const statusLabel: Record<MosqueStatus, string> = {
  approved: 'Disetujui',
  pending: 'Menunggu',
  rejected: 'Ditolak',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
    <h1 class="font-display text-2xl font-bold tracking-tight">Pendaftaran Saya</h1>
    <p class="mt-1 text-sm text-muted-foreground">Status masjid yang pernah Anda daftarkan.</p>

    <div v-if="!isLoading && submissions.length === 0" class="mt-8 rounded-xl border border-dashed border-border p-12 text-center space-y-3">
      <h3 class="font-display text-base font-semibold">Belum Ada Pendaftaran</h3>
      <p class="text-xs text-muted-foreground">Anda belum pernah mendaftarkan masjid.</p>
      <NuxtLink to="/masjid/daftar">
        <Button size="sm">Daftarkan Masjid</Button>
      </NuxtLink>
    </div>

    <Table v-else class="mt-6">
      <TableHeader>
        <TableRow>
          <TableHead>Nama Masjid</TableHead>
          <TableHead>Tanggal Daftar</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="s in submissions" :key="s.id">
          <TableCell class="font-medium">
            <NuxtLink v-if="s.status === 'approved'" :to="`/masjid/${s.id}`" class="hover:underline">
              {{ s.name }}
            </NuxtLink>
            <span v-else>{{ s.name }}</span>
          </TableCell>
          <TableCell class="text-sm text-muted-foreground">{{ formatDate(s.createdAt) }}</TableCell>
          <TableCell>
            <Badge :variant="statusVariant[s.status]">{{ statusLabel[s.status] }}</Badge>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open `http://localhost:3000/masjid/pendaftaran-saya` with no auth cookie — confirm redirect to `/login`. Log in and revisit — confirm either the empty state (if no submissions) or a table renders without console errors. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/pages/masjid/pendaftaran-saya.vue
git commit -m "feat(web): add my-submissions status page"
```

---

### Task 8: `/admin/pendaftaran` — approval queue (Super Admin)

**Files:**
- Create: `apps/web/pages/admin/pendaftaran.vue`

**Interfaces:**
- Consumes: `useMosqueRegistration().listPendingMosques`/`approveMosque`/`rejectMosque` (Task 3), `PendingMosque` type (Task 2), `require-role` middleware (Task 4).
- Produces: the `/admin/pendaftaran` route.

- [ ] **Step 1: Create the page**

```vue
<!-- apps/web/pages/admin/pendaftaran.vue -->
<script setup lang="ts">
import { toast } from 'vue-sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PendingMosque } from '~/types/api';

definePageMeta({ middleware: ['auth', 'require-role'], requiredRoles: ['super_admin'] });

const { listPendingMosques, approveMosque, rejectMosque } = useMosqueRegistration();

const pending = ref<PendingMosque[]>([]);
const isLoading = ref(true);
const processingId = ref<string | null>(null);

onMounted(async () => {
  pending.value = await listPendingMosques();
  isLoading.value = false;
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function onApprove(mosqueId: string) {
  processingId.value = mosqueId;
  try {
    await approveMosque(mosqueId);
    pending.value = pending.value.filter((m) => m.id !== mosqueId);
    toast.success('Masjid disetujui.');
  } catch {
    toast.error('Gagal menyetujui masjid.');
  } finally {
    processingId.value = null;
  }
}

async function onReject(mosqueId: string) {
  processingId.value = mosqueId;
  try {
    await rejectMosque(mosqueId);
    pending.value = pending.value.filter((m) => m.id !== mosqueId);
    toast.success('Masjid ditolak.');
  } catch {
    toast.error('Gagal menolak masjid.');
  } finally {
    processingId.value = null;
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
    <h1 class="font-display text-2xl font-bold tracking-tight">Antrean Persetujuan Masjid</h1>
    <p class="mt-1 text-sm text-muted-foreground">Masjid yang menunggu verifikasi, diurutkan dari yang terlama.</p>

    <div v-if="!isLoading && pending.length === 0" class="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
      <p class="text-sm text-muted-foreground">Tidak ada pendaftaran yang menunggu persetujuan.</p>
    </div>

    <Table v-else class="mt-6">
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead>Alamat</TableHead>
          <TableHead>Tanggal Daftar</TableHead>
          <TableHead class="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="m in pending" :key="m.id">
          <TableCell class="font-medium">{{ m.name }}</TableCell>
          <TableCell class="text-sm text-muted-foreground">{{ m.address }}</TableCell>
          <TableCell class="text-sm text-muted-foreground">{{ formatDate(m.createdAt) }}</TableCell>
          <TableCell class="flex justify-end gap-2">
            <Dialog>
              <DialogTrigger as-child>
                <Button size="sm" :disabled="processingId === m.id">Setujui</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Setujui {{ m.name }}?</DialogTitle>
                  <DialogDescription>
                    Pendaftar akan otomatis menjadi Mosque Admin untuk masjid ini.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter class="gap-2">
                  <DialogClose as-child>
                    <Button variant="outline" size="sm">Batal</Button>
                  </DialogClose>
                  <DialogClose as-child>
                    <Button size="sm" @click="onApprove(m.id)">Ya, Setujui</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger as-child>
                <Button size="sm" variant="outline" :disabled="processingId === m.id">Tolak</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tolak {{ m.name }}?</DialogTitle>
                  <DialogDescription>
                    Status pendaftar tidak berubah. Tindakan ini tidak menghapus data masjid.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter class="gap-2">
                  <DialogClose as-child>
                    <Button variant="outline" size="sm">Batal</Button>
                  </DialogClose>
                  <DialogClose as-child>
                    <Button size="sm" variant="destructive" @click="onReject(m.id)">Ya, Tolak</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
```

Note per spec §4.5: `GET /mosques/pending`'s response (`PendingMosque`) does not include `duplicateWarning` — that field only exists on the `POST /mosques` response at submission time and is not persisted anywhere queryable later. This page's approve/reject dialogs correctly do **not** attempt to show duplicate-check history; do not add a field that doesn't exist in the backend contract.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open `http://localhost:3000/admin/pendaftaran` while logged in as a non-`super_admin` user (or logged out). Confirm redirect: logged-out goes to `/login`; logged-in-but-wrong-role goes to `/` with a toast "Anda tidak memiliki akses ke halaman ini." Then log in as the seeded Super Admin and revisit — confirm the table (or empty state) renders. If a pending mosque exists in the dev database, click "Setujui" on one, confirm the confirmation dialog appears, confirm it, and confirm the row disappears from the table with a success toast. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/pages/admin/pendaftaran.vue
git commit -m "feat(web): add mosque approval queue page"
```

---

## Self-Review Notes

- **Spec coverage:** §4.2 → Task 6; §4.4 → Task 7; §4.5 → Task 8; §2.1 (types) → Task 2; §2.2 (composable) → Task 3; §2.3 (role gating, `require-role.ts`) → Task 4; §3 (`form`/`textarea` install, no-map decision reflected in Task 6's geolocation button) → Tasks 1 and 6. Every named page and composable in the spec's Module 3 scope has a task.
- **Placeholder scan:** no TBD/TODO; every step has real, runnable code. Task 5 is an intentional no-op placeholder in the *numbering* only (documented as such) to keep task references stable if a reviewer cites "Task 8" from outside this document — not a content placeholder.
- **Type consistency:** `MosqueRegistrationInput`, `PendingMosque`, `MySubmission`, `MosqueStatus` defined once in Task 2 and reused unchanged through Tasks 3, 6, 7, 8. Composable function names (`submitMosqueRegistration`, `listPendingMosques`, `approveMosque`, `rejectMosque`, `listMySubmissions`) match exactly between Task 3's Interfaces block, its implementation, and every page task that calls them.
- **Cross-plan dependency called out explicitly:** Task 6 depends on `useRegions()` from the Module 2 plan and states the exact fallback if that plan hasn't run yet. Task 2 and Task 4 are written defensively (check-before-create / append-don't-overwrite) since `apps/web/types/api.ts` and `middleware/require-role.ts` are shared across this plan and the Module 5/6 plans, and execution order across the five module plans is not guaranteed.
- **No automated test harness for composables/pages** — matches the auth-frontend plan's precedent (`vitest.config.ts` only covers `server/**`/`scripts/**`). Every composable/page task ends with a concrete manual dev-server verification step (exact URL, exact clicks, exact expected outcome), not a vague "test it works."
