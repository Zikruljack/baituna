# UI Module 5: Person (Admin Panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Person" (Khatib/Imam/Muazzin roster) management tab inside the Mosque Admin panel — list, create, edit, and soft-delete Person rows for one mosque, wired to the already-implemented `GET/POST/PATCH/DELETE /mosques/:id/people` endpoints.

**Architecture:** This plan creates `apps/web/pages/admin/masjid/[id].vue` — the **page shell** for the whole admin mosque management panel, including page-level middleware, the mosque-ownership check, and a two-tab `Tabs` layout. It fills in the **Person tab** completely. The **Jadwal Jumat tab** (Module 6) is left as a clearly marked placeholder `TabsContent` block for the Module 6 UI plan to fill in later — see "Shared-file coordination" below. This plan is the one that creates the page shell (not Module 6's plan) because Person has no dependency on Friday Assignment, while Friday Assignment's UI needs Person data to populate its Khatib/Imam/Muazzin selects — Person comes first in build order the same way it does in the backend module design doc (`docs/superpowers/specs/2026-08-23-baituna-modules-design.md` §6: "Modul 5 (Person), lalu modul 6"). This plan also creates `apps/web/types/api.ts` (does not exist yet at plan-writing time — an empty `apps/web/types/` directory exists) with only the Person-related types, and `apps/web/middleware/require-role.ts` (does not exist yet either) — both are shared files other module UI plans (2, 3, 4, 6) will also extend; each of those plans must check whether the file already exists before creating it fresh.

**Shared-file coordination (read this before starting):**
- `apps/web/pages/admin/masjid/[id].vue` is created by **this plan** (Task 4). It contains a `Tabs` with two `TabsTrigger`/`TabsContent` pairs: `"person"` (fully built here) and `"jadwal"` (a one-line placeholder here: `<TabsContent value="jadwal"><p class="text-sm text-muted-foreground">Modul 6 UI plan fills in the Jadwal Jumat tab content here.</p></TabsContent>`, marked with the HTML comment `<!-- MODULE-6-UI-PLAN: replace this TabsContent with the Jadwal Jumat panel -->` immediately above it). The Module 6 UI plan's implementer must read this file, find that exact comment, and replace only that one `TabsContent` block — not touch the Person tab, the page's `<script setup>` mosque-loading logic, or the ownership-check block. If Task 4 in this plan has not run yet when Module 6's plan executes, Module 6's plan is responsible for creating the page shell itself following this same pattern (page shell ownership always goes to whichever of these two plans runs first).
- `apps/web/types/api.ts` is created by **this plan** (Task 1) with exactly: `Person`, `CreatePersonInput`, `UpdatePersonInput`. Every other module UI plan appends its own types to the same file using the same one-line-comment-per-interface convention (see Task 1) — never overwrites the file. If `apps/web/types/api.ts` already exists when this plan executes (another module's plan ran first), Task 1 changes from "create the file" to "append to the file if the three Person types are not already present" — the step-by-step instructions below cover file creation; an implementer running this plan second should skip the `Write` and instead `Edit`-append the same content block after the existing content.
- `apps/web/middleware/require-role.ts` is created by **this plan** (Task 3) since it is needed here first. If it already exists when this plan runs (Module 3's plan ran first), Task 3 becomes a no-op verification step (confirm the file exists and matches the signature documented in Task 3) rather than a creation step.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript (strict), shadcn-vue (`table`, `dialog`, `dropdown-menu`, `button`, `input`, `label`, `badge` — already installed; `tabs`, `form` — installed by this plan), Zod (already a dependency), `vue-sonner` (already installed, used via `toast` import as in `pages/index.vue`).

**Spec:** `docs/superpowers/specs/2026-08-25-baituna-web-ui-design.md` (shared UI spec — read §2.1 for the `Person` type shape, §2.2 for composable conventions, §2.3 for role-gating middleware, §2.4 for the `/admin/masjid/[id]` route, §3 for the `tabs`/`form`/`dropdown-menu` component list, §4.6 "Tab Person" for exact page content). Backend contract: `docs/superpowers/specs/2026-08-23-module-5-person.md`.

## Global Constraints

- Person name: 1–200 characters, required. Phone: optional, max 30 characters, nullable — exact limits from `createPersonSchema`/`updatePersonSchema` in `apps/web/server/utils/validation.ts`.
- `GET /mosques/:id/people` is public (no auth header needed, but sending one when present is harmless — `useApi` always attaches the token if present per spec §2.2).
- `POST`/`PATCH`/`DELETE` on `/mosques/:id/people` all require the caller to be the mosque's owner (`requireMosqueOwner` server-side) — the frontend must not assume role alone is sufcient; the page checks `mosque.adminUserId === user.id` (or `super_admin`) before showing the panel at all (spec §2.3).
- A cross-mosque or already-deleted Person returns `404` from `PATCH`/`DELETE`, not `403` — the UI must not try to distinguish these cases; both are shown as a generic "Person tidak ditemukan" toast error.
- Soft delete only: `DELETE` never removes the row server-side. The UI treats a deleted Person as gone from the active list (no "trash" view exists anywhere in this MVP).
- 2-space indent, named exports for non-component TS modules, `<script setup lang="ts">` for all `.vue` files, one-line comments only where a WHY isn't obvious — follow `apps/web/composables/useAuth.ts` house style.
- Run `npm run typecheck` and `npm run lint` (from `apps/web/`) after every task that adds `.vue` or `.ts` files.
- Every command in this plan runs from `apps/web/` unless stated otherwise.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/types/api.ts` | `Person`, `CreatePersonInput`, `UpdatePersonInput` types | 1 |
| `apps/web/composables/usePeople.ts` | `listActive(mosqueId)`, `create(mosqueId, input)`, `update(mosqueId, personId, input)`, `remove(mosqueId, personId)` | 2 |
| `apps/web/middleware/require-role.ts` | Role-gate factory middleware, shared across all admin pages | 3 |
| `apps/web/pages/admin/masjid/[id].vue` | Page shell (mosque load, ownership check, `Tabs`) + full Person tab content | 4 |

---

### Task 1: API types for Person

**Files:**
- Create: `apps/web/types/api.ts`

**Interfaces:**
- Consumes: nothing (pure type definitions).
- Produces: `Person`, `CreatePersonInput`, `UpdatePersonInput` — imported by `composables/usePeople.ts` (Task 2) and `pages/admin/masjid/[id].vue` (Task 4). Other module UI plans append their own types below these in the same file (see Shared-file coordination above).

No runtime behavior — pure type declarations. Skip TDD steps; just create the file and typecheck.

- [ ] **Step 1: Create the types file**

```typescript
// apps/web/types/api.ts
//
// Hand-written types mirroring backend JSON response/request shapes.
// apps/web/server/utils/openapi.ts has no components.schemas (descriptions
// only), so these are copied by hand from each module's spec + service code
// — see the one-line comment above each interface for its source of truth.
// Every module UI plan appends its own section here; never remove another
// module's types when editing this file.

// --- Module 5 (Person) — docs/superpowers/specs/2026-08-23-module-5-person.md ---

/** Shape returned by GET/POST/PATCH .../people(/:personId) — apps/web/server/services/person.service.ts PersonSummary. */
export interface Person {
  id: string;
  name: string;
  phone: string | null;
}

/** Body for POST /mosques/:id/people. phone omitted or null both mean "no phone". */
export interface CreatePersonInput {
  name: string;
  phone?: string | null;
}

/** Body for PATCH /mosques/:id/people/:personId. At least one field required (enforced by updatePersonSchema server-side). */
export interface UpdatePersonInput {
  name?: string;
  phone?: string | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/types/api.ts
git commit -m "feat(web): add Person API types"
```

---

### Task 2: `usePeople` composable

**Files:**
- Create: `apps/web/composables/usePeople.ts`

**Interfaces:**
- Consumes: `Person`, `CreatePersonInput`, `UpdatePersonInput` from `apps/web/types/api.ts` (Task 1); `useAuthToken` from `apps/web/composables/useAuth.ts` (already exists, auto-imported by Nuxt).
- Produces:
  - `usePeople()` returning `{ listActive(mosqueId: string): Promise<Person[]>, create(mosqueId: string, input: CreatePersonInput): Promise<Person>, update(mosqueId: string, personId: string, input: UpdatePersonInput): Promise<Person>, remove(mosqueId: string, personId: string): Promise<{ id: string }> }`.
  - All four methods are consumed by `pages/admin/masjid/[id].vue` (Task 4). `listActive` is also expected to be reused by the Module 4 UI plan (mosque detail page, read-only Person display) and the Module 6 UI plan (populating Khatib/Imam/Muazzin selects) — both call the same `listActive`, no separate read-only variant needed.

This composable wraps `$fetch` directly (not `useApi`/`useFetch`) for every method, matching the pattern in `useAuth.ts`'s `login()` — these are one-shot actions triggered by user interaction (button clicks, form submits), not reactive data that needs to re-fetch when a ref changes.

- [ ] **Step 1: Create the composable**

```typescript
// apps/web/composables/usePeople.ts
import type { CreatePersonInput, Person, UpdatePersonInput } from '~/types/api';

/** CRUD for the Person (Khatib/Imam/Muazzin) roster, scoped per mosque. */
export function usePeople() {
  const token = useAuthToken();

  function authHeaders(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {};
  }

  async function listActive(mosqueId: string): Promise<Person[]> {
    return await $fetch<Person[]>(`/api/mosques/${mosqueId}/people`);
  }

  async function create(mosqueId: string, input: CreatePersonInput): Promise<Person> {
    return await $fetch<Person>(`/api/mosques/${mosqueId}/people`, {
      method: 'POST',
      headers: authHeaders(),
      body: input,
    });
  }

  async function update(mosqueId: string, personId: string, input: UpdatePersonInput): Promise<Person> {
    return await $fetch<Person>(`/api/mosques/${mosqueId}/people/${personId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: input,
    });
  }

  async function remove(mosqueId: string, personId: string): Promise<{ id: string }> {
    return await $fetch<{ id: string }>(`/api/mosques/${mosqueId}/people/${personId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  }

  return { listActive, create, update, remove };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/composables/usePeople.ts
git commit -m "feat(web): add usePeople composable"
```

---

### Task 3: `require-role` middleware

**Files:**
- Create: `apps/web/middleware/require-role.ts`

**Interfaces:**
- Consumes: `useAuth` from `apps/web/composables/useAuth.ts` (already exists); `UserRole` from `apps/web/lib/auth-types.ts` (already exists).
- Produces: a Nuxt route middleware named `require-role`, applied via `definePageMeta({ middleware: ['auth', 'require-role'], requiredRoles: ['mosque_admin', 'super_admin'] })` (or whatever role list a page needs). Consumed by `pages/admin/masjid/[id].vue` (Task 4) and, later, by the Module 3 UI plan's `/admin/pendaftaran` page.

This middleware assumes `auth` middleware (already exists, unmodified by this plan) has already run first in the same `middleware` array and guaranteed a token exists — `require-role` only needs to check the role on top of that, using `useAuth().user`. If `user` is not yet loaded (e.g. hard page refresh before `useAuth().init()` resolves), this middleware treats a missing user the same as a role mismatch — it does not wait or retry, since `app.vue`/a root plugin is expected to call `useAuth().init()` before route middleware runs on client-side navigation (already the case for the existing `auth` middleware's assumptions; this plan does not change that startup sequence).

- [ ] **Step 1: Create the middleware**

```typescript
// apps/web/middleware/require-role.ts
import { toast } from 'vue-sonner';

import type { UserRole } from '~/lib/auth-types';

declare module '#app' {
  interface PageMeta {
    requiredRoles?: UserRole[];
  }
}

/**
 * Redirects to / if the current user's role is not in `requiredRoles`
 * (set via definePageMeta). Must run after the `auth` middleware in the
 * same page's middleware array, since it assumes a session may already
 * exist but does not itself check for a token.
 */
export default defineNuxtRouteMiddleware((to) => {
  const requiredRoles = to.meta.requiredRoles;
  if (!requiredRoles || requiredRoles.length === 0) return;

  const { user } = useAuth();
  if (!user.value || !requiredRoles.includes(user.value.role)) {
    toast.error('Anda tidak memiliki akses ke halaman ini');
    return navigateTo('/');
  }
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware/require-role.ts
git commit -m "feat(web): add require-role route middleware"
```

---

### Task 4: Admin mosque panel page shell + Person tab

**Files:**
- Create: `apps/web/pages/admin/masjid/[id].vue`

**Interfaces:**
- Consumes: `usePeople` (Task 2), `Person`/`CreatePersonInput`/`UpdatePersonInput` (Task 1), `require-role` middleware (Task 3), `useAuth` (existing), shadcn-vue `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`/`DialogClose`, `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`, `Button`, `Input`, `Label`.
- Produces: the `/admin/masjid/[id]` route. The page's mosque-loading logic (`mosque` ref, `isOwner` computed) and the `Tabs` wrapper are the shared shell other module UI plans (Module 6) build on top of — see Shared-file coordination in this plan's header.

This is a page, not a reusable unit — no exported interface beyond the route itself.

- [ ] **Step 1: Install the `tabs` and `form` shadcn-vue components**

Run: `npx shadcn-vue@latest add tabs form` (from `apps/web/`)
Expected: creates `apps/web/components/ui/tabs/*.vue` + `index.ts` and `apps/web/components/ui/form/*.vue` + `index.ts`. Answer any CLI prompts with the defaults already configured in `apps/web/components.json` (this repo already ran `shadcn-vue init`, so no new prompts about style/baseColor should appear).

This plan's Person tab does not actually need `form` (a plain `<form>` + manual `ref`s + `Input`/`Label` is enough for two fields with simple validation) — `form` is installed here anyara because it is listed as required by the shared spec (§3) for Module 3's registration form, and installing shadcn-vue components is idempotent/cheap to do once. If `npx shadcn-vue@latest add form` reports it is already installed (another module's plan ran first), that's expected — continue.

- [ ] **Step 2: Create the page**

Create `apps/web/pages/admin/masjid/[id].vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { toast } from 'vue-sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Person } from '~/types/api';

definePageMeta({
  middleware: ['auth', 'require-role'],
  requiredRoles: ['mosque_admin', 'super_admin'],
});

interface MosqueOwnerCheck {
  id: string;
  name: string;
  adminUserId: string | null;
}

const route = useRoute();
const mosqueId = route.params.id as string;
const { user } = useAuth();
const { listActive, create, update, remove } = usePeople();

const mosque = ref<MosqueOwnerCheck | null>(null);
const mosqueLoadFailed = ref(false);

async function loadMosque() {
  try {
    mosque.value = await $fetch<MosqueOwnerCheck>(`/api/mosques/${mosqueId}`);
  } catch {
    mosqueLoadFailed.value = true;
    return;
  }

  const isOwner = mosque.value.adminUserId === user.value?.id;
  const isSuperAdmin = user.value?.role === 'super_admin';
  if (!isOwner && !isSuperAdmin) {
    toast.error('Anda bukan pengelola masjid ini');
    await navigateTo(`/masjid/${mosqueId}`);
  }
}

await loadMosque();

// --- Person tab state ---
const people = ref<Person[]>([]);
const peopleLoading = ref(true);

async function loadPeople() {
  peopleLoading.value = true;
  try {
    people.value = await listActive(mosqueId);
  } catch {
    toast.error('Gagal memuat daftar Person');
  } finally {
    peopleLoading.value = false;
  }
}

if (mosque.value) await loadPeople();

const addDialogOpen = ref(false);
const addName = ref('');
const addPhone = ref('');
const addSubmitting = ref(false);

async function submitAdd() {
  if (addName.value.trim().length === 0) {
    toast.error('Nama wajib diisi');
    return;
  }
  addSubmitting.value = true;
  try {
    await create(mosqueId, { name: addName.value.trim(), phone: addPhone.value.trim() || null });
    toast.success('Person berhasil ditambahkan');
    addDialogOpen.value = false;
    addName.value = '';
    addPhone.value = '';
    await loadPeople();
  } catch {
    toast.error('Gagal menambahkan Person');
  } finally {
    addSubmitting.value = false;
  }
}

const editDialogOpen = ref(false);
const editTarget = ref<Person | null>(null);
const editName = ref('');
const editPhone = ref('');
const editSubmitting = ref(false);

function openEdit(person: Person) {
  editTarget.value = person;
  editName.value = person.name;
  editPhone.value = person.phone ?? '';
  editDialogOpen.value = true;
}

async function submitEdit() {
  if (!editTarget.value) return;
  if (editName.value.trim().length === 0) {
    toast.error('Nama wajib diisi');
    return;
  }
  editSubmitting.value = true;
  try {
    await update(mosqueId, editTarget.value.id, {
      name: editName.value.trim(),
      phone: editPhone.value.trim() || null,
    });
    toast.success('Person berhasil diperbarui');
    editDialogOpen.value = false;
    await loadPeople();
  } catch {
    toast.error('Gagal memperbarui Person');
  } finally {
    editSubmitting.value = false;
  }
}

const deleteDialogOpen = ref(false);
const deleteTarget = ref<Person | null>(null);
const deleteSubmitting = ref(false);

function openDelete(person: Person) {
  deleteTarget.value = person;
  deleteDialogOpen.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleteSubmitting.value = true;
  try {
    await remove(mosqueId, deleteTarget.value.id);
    toast.success('Person berhasil dihapus');
    deleteDialogOpen.value = false;
    await loadPeople();
  } catch {
    toast.error('Gagal menghapus Person');
  } finally {
    deleteSubmitting.value = false;
  }
}

const canManage = computed(() => Boolean(mosque.value) && !mosqueLoadFailed.value);
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <div v-if="mosqueLoadFailed" class="rounded-xl border border-dashed border-border p-12 text-center">
      <h1 class="font-display text-xl font-semibold">Masjid tidak ditemukan</h1>
      <p class="mt-2 text-sm text-muted-foreground">Masjid ini mungkin belum disetujui atau sudah dihapus.</p>
    </div>

    <template v-else-if="canManage && mosque">
      <div class="mb-6">
        <Badge variant="approved" class="mb-2">Panel Kelola Masjid</Badge>
        <h1 class="font-display text-2xl font-bold tracking-tight sm:text-3xl">{{ mosque.name }}</h1>
      </div>

      <Tabs default-value="person">
        <TabsList>
          <TabsTrigger value="person">Person</TabsTrigger>
          <TabsTrigger value="jadwal">Jadwal Jumat</TabsTrigger>
        </TabsList>

        <TabsContent value="person" class="space-y-4 pt-4">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg font-semibold">Roster Khatib / Imam / Muazzin</h2>
            <Dialog v-model:open="addDialogOpen">
              <Button size="sm" @click="addDialogOpen = true">Tambah Person</Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Person</DialogTitle>
                  <DialogDescription>Nama akan muncul sebagai pilihan saat membuat jadwal Jumat.</DialogDescription>
                </DialogHeader>
                <div class="space-y-3 py-2">
                  <div class="space-y-1">
                    <Label for="add-name">Nama</Label>
                    <Input id="add-name" v-model="addName" placeholder="Ustadz Fulan" maxlength="200" />
                  </div>
                  <div class="space-y-1">
                    <Label for="add-phone">Telepon (opsional)</Label>
                    <Input id="add-phone" v-model="addPhone" placeholder="0812xxxxxxx" maxlength="30" />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose as-child>
                    <Button variant="outline" size="sm">Batal</Button>
                  </DialogClose>
                  <Button size="sm" :disabled="addSubmitting" @click="submitAdd">
                    {{ addSubmitting ? 'Menyimpan...' : 'Simpan' }}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead class="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="person in people" :key="person.id">
                <TableCell>{{ person.name }}</TableCell>
                <TableCell>{{ person.phone ?? '—' }}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="sm">⋮</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="openEdit(person)">Edit</DropdownMenuItem>
                      <DropdownMenuItem class="text-destructive" @click="openDelete(person)">Hapus</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              <TableEmpty v-if="!peopleLoading && people.length === 0" :colspan="3">
                Belum ada Person untuk masjid ini.
              </TableEmpty>
            </TableBody>
          </Table>
        </TabsContent>

        <!-- MODULE-6-UI-PLAN: replace this TabsContent with the Jadwal Jumat panel -->
        <TabsContent value="jadwal" class="pt-4">
          <p class="text-sm text-muted-foreground">Modul 6 UI plan fills in the Jadwal Jumat tab content here.</p>
        </TabsContent>
      </Tabs>

      <Dialog v-model:open="editDialogOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
          </DialogHeader>
          <div class="space-y-3 py-2">
            <div class="space-y-1">
              <Label for="edit-name">Nama</Label>
              <Input id="edit-name" v-model="editName" maxlength="200" />
            </div>
            <div class="space-y-1">
              <Label for="edit-phone">Telepon (opsional)</Label>
              <Input id="edit-phone" v-model="editPhone" maxlength="30" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose as-child>
              <Button variant="outline" size="sm">Batal</Button>
            </DialogClose>
            <Button size="sm" :disabled="editSubmitting" @click="submitEdit">
              {{ editSubmitting ? 'Menyimpan...' : 'Simpan' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="deleteDialogOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Person?</DialogTitle>
            <DialogDescription>
              "{{ deleteTarget?.name }}" akan dihapus dari daftar aktif. Riwayat jadwal Jumat lama yang
              menyertakan nama ini tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose as-child>
              <Button variant="outline" size="sm">Batal</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" :disabled="deleteSubmitting" @click="confirmDelete">
              {{ deleteSubmitting ? 'Menghapus...' : 'Hapus' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
```

Note on the `Dialog v-model:open` + `Button @click` pattern for the "Tambah Person" trigger: unlike the `DialogTrigger as-child` pattern used in `pages/index.vue`'s existing registration dialog, this page drives dialog visibility from script-side `ref`s (`addDialogOpen`, `editDialogOpen`, `deleteDialogOpen`) because the edit and delete dialogs need to be opened programmatically from a table row's dropdown menu item click, not from a static trigger button — `DialogTrigger` only works for a fixed trigger element, not "open this dialog for whichever row was clicked." The add dialog uses the same `v-model:open` pattern for consistency with its two siblings, even though it could have used `DialogTrigger`.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint` (from `apps/web/`)
Expected: no new errors. Fix any that appear (most likely: unused import, or a shadcn-vue component prop name mismatch — check the installed `.vue` file's `defineProps` if a prop type error appears).

- [ ] **Step 4: Manual smoke test**

This page has no automated test harness (per the auth-frontend plan's established precedent: `vitest.config.ts` only includes `server/**`/`scripts/**`, and Nuxt page/composable testing would need `@nuxt/test-utils`, out of scope here). Verify manually:

1. Run `npm run dev` (from `apps/web/`).
2. Seed or use an existing approved mosque you own (as a `mosque_admin`) or log in as `super_admin`. If you don't have one, use `npm run db:seed:admin` (existing script, per Module 1) to get a Super Admin account, then approve a pending mosque via `PATCH /api/mosques/:id/approve` (curl or the admin approval page once Module 3's UI plan is done) to get a mosque `id` to test with.
3. Navigate to `http://localhost:3000/admin/masjid/<that-mosque-id>`.
4. Expected: page loads, shows the mosque name, two tabs ("Person" active by default), an empty Person table with "Belum ada Person untuk masjid ini."
5. Click "Tambah Person", fill in a name (e.g. "Ustadz Test"), leave phone blank, click "Simpan". Expected: dialog closes, toast "Person berhasil ditambahkan", table now shows one row with phone shown as "—".
6. Click the "⋮" menu on that row → "Edit". Change the name, click "Simpan". Expected: toast "Person berhasil diperbarui", table row updates.
7. Click "⋮" → "Hapus". Confirm in the dialog. Expected: toast "Person berhasil dihapus", row disappears, table shows the empty state again.
8. Log out (or open an incognito window) and navigate to the same URL as a `public_user` or logged-out visitor. Expected: redirected away (to `/login` if logged out, to `/` with a toast if logged in as `public_user`) — never sees the Person tab.
9. Stop the dev server after checking (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/pages/admin/masjid/[id].vue apps/web/components/ui/tabs apps/web/components/ui/form
git commit -m "feat(web): add mosque admin panel with Person tab"
```

---

## Self-Review Notes

- **Spec coverage:** §4.6 "Tab Person" is fully covered by Task 4 — table of active people (kolom nama+telepon), "Tambah Person" dialog+form, edit via dropdown-menu, delete via dropdown-menu+confirmation dialog, row disappears from active list on delete (soft delete is a backend detail, not surfaced in UI). §2.3 role gating is covered by Task 3 (middleware) + Task 4 (ownership check via `adminUserId`). §2.1's `Person` type is covered by Task 1. §2.2's `usePeople` composable responsibility is covered by Task 2.
- **Placeholder scan:** no TBD/TODO in any code block; the one intentional placeholder (`TabsContent value="jadwal"`) is explicitly documented as an inter-plan handoff point, not an unfinished plan step — it has real, runnable code (a `<p>` tag), just deliberately minimal content pending Module 6's plan.
- **Type consistency:** `Person`/`CreatePersonInput`/`UpdatePersonInput` defined once in Task 1, imported unchanged by Task 2 and Task 4. `usePeople()`'s four method names (`listActive`, `create`, `update`, `remove`) match exactly between Task 2's definition and Task 4's usage — verified by re-reading Task 4's script block against Task 2's return statement.
- **Shared-file coordination re-confirmed:** the exact HTML comment string `<!-- MODULE-6-UI-PLAN: replace this TabsContent with the Jadwal Jumat panel -->` appears once in Task 4's page code, immediately above the placeholder `TabsContent`. An implementer of the Module 6 UI plan searching this file for that literal string will find exactly one match with no ambiguity about what to replace. The mosque-loading (`loadMosque`), ownership-check, and Person-tab state/handlers are all defined above the `</script>` closing tag in a single `<script setup>` block that Module 6's plan will need to *add to* (new refs/functions for its own tab), not replace — this is called out in the plan header's Shared-file coordination section so Module 6's plan writer knows to append rather than rewrite the script block.
