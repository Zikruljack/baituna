# Auth Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend auth flow (email/password login, Google OAuth login, session state, route guard) in `apps/web`, wired to the auth endpoints that already exist in `apps/web/server/api/auth/**`.

**Architecture:** Nuxt 4 fullstack app (`apps/web`) with Nitro API routes under `server/api` and a Vue/Nuxt frontend at the repo root of `apps/web` (no `app/` src dir — components/pages/composables live directly under `apps/web/`). This plan adds frontend-only files: hand-written TypeScript types mirroring the server's auth responses, a `useAuth` composable holding session state in a cookie, a thin `useApi` fetch wrapper that attaches the bearer token, two pages (`login.vue`, `auth/callback.vue`), and a route middleware (`auth.ts`) that guards pages requiring a session. No backend files are modified.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript (strict), Vitest (node environment), shadcn-vue components already present in `apps/web/components/ui/**`, Zod (already a dependency, used only if a step needs it — none do here).

**Spec:** No separate spec file — this is a bounded task; the design was approved in chat during the 2026-08-23 brainstorming session (see conversation history). This plan is the authoritative source for implementers.

## Global Constraints

- Do not modify any file under `apps/web/server/**`. The three auth endpoints (`POST /api/auth/login`, `GET /api/auth/google`, `GET /api/auth/google/callback`) are settled (Module 1) and are consumed as-is.
- The JWT is opaque to the frontend: store it, send it, never decode or inspect its contents client-side. The server already returns `user` alongside `token` in both login responses — always use that `user` object, never derive identity from the token.
- Store the token in a cookie via Nuxt's `useCookie`, not `localStorage`. This keeps SSR requests authenticated and avoids a client-only `window` check. The cookie is **not** `httpOnly` (it must be written by client-side JS after `$fetch` calls), so set `sameSite: 'lax'` and a `maxAge` matching the server's 7-day token lifetime (`60 * 60 * 24 * 7` seconds).
- `apps/web/server/utils/openapi.ts`'s `openApiDocument` has no `components.schemas` and no response bodies — it is descriptions only. Do not attempt to generate types from it (`openapi-typescript` would produce empty/useless types against this document). Types are hand-written in this plan, mirrored exactly from the server code already read (Task 1).
- Follow existing code conventions: 2-space indent, no default exports for non-component/non-page TS modules, named exports, JSDoc-style one-line comments only where a WHY isn't obvious from the code (see `apps/web/server/utils/auth.ts` for the house style).
- New frontend logic that does not require the Nuxt runtime (e.g. parsing/validation helpers) must be plain exported functions, testable with the existing `vitest` setup. Composables themselves use Nuxt auto-imports (`useState`, `useCookie`, `useRuntimeConfig`, `navigateTo`) and are **not** unit-tested in this plan — the project's `vitest.config.ts` only includes `server/**` and `scripts/**`, and adding `@nuxt/test-utils` is out of scope. Composables are verified manually in Task 6 (dev server smoke test).
- Run `npm run typecheck` and `npm run lint` (both defined in `apps/web/package.json`) after each task that adds `.vue` or `.ts` files, from the `apps/web` directory.

---

## Reference: exact server response shapes (already implemented, do not change)

`POST /api/auth/login` (`apps/web/server/api/auth/login.post.ts`) — request body `{ email: string, password: string }`, on success (200) returns:
```json
{ "token": "string", "user": { "id": "string", "name": "string", "email": "string", "role": "super_admin | mosque_admin | public_user" } }
```
On failure: 401 with `statusMessage: "Invalid email or password"`.

`GET /api/auth/google` (`apps/web/server/api/auth/google/index.get.ts`) — no params; sets an `oauth_state` cookie and issues a 302 redirect to Google's consent screen. The frontend triggers this via a full page navigation (`window.location.href` or `navigateTo(..., { external: true })`), never `$fetch` (redirects can't be followed cross-origin via fetch in the browser for this flow).

`GET /api/auth/google/callback?code=...&state=...` (`apps/web/server/api/auth/google/callback.get.ts`) — reads `code`/`state` from the query string, validates `state` against the `oauth_state` cookie, on success (200) returns:
```json
{ "token": "string", "user": { "id": "string", "name": "string", "email": "string", "role": "super_admin | mosque_admin | public_user" } }
```
On failure: 400 (missing/invalid code, state, or mismatched state) or 500 (misconfiguration).

Role type, verbatim from `apps/web/server/services/token.ts`: `type UserRole = 'super_admin' | 'mosque_admin' | 'public_user'`.

---

### Task 1: Auth types module

**Files:**
- Create: `apps/web/lib/auth-types.ts`

**Interfaces:**
- Consumes: nothing (pure type definitions).
- Produces: `UserRole`, `AuthUser`, `AuthResponse` — imported by `composables/useAuth.ts` (Task 2), `composables/useApi.ts` (Task 3), `pages/login.vue` (Task 4), `pages/auth/callback.vue` (Task 5).

This task has no runtime behavior, so there is no test to write — it is pure type declarations copied verbatim from the server code cited above. Skip the TDD steps; just create the file and verify it typechecks.

- [ ] **Step 1: Create the types file**

```typescript
// apps/web/lib/auth-types.ts

/** Mirrors apps/web/server/services/token.ts UserRole. Keep in sync manually — no shared package boundary exists yet. */
export type UserRole = 'super_admin' | 'mosque_admin' | 'public_user';

/** Shape returned as `user` by both apps/web/server/api/auth/login.post.ts and .../google/callback.get.ts. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Full JSON body returned by both auth endpoints on success. */
export interface AuthResponse {
  token: string;
  user: AuthUser;
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/auth-types.ts
git commit -m "feat(web): add auth response types"
```

---

### Task 2: `useAuth` composable

**Files:**
- Create: `apps/web/composables/useAuth.ts`

**Interfaces:**
- Consumes: `AuthUser`, `AuthResponse` from `apps/web/lib/auth-types.ts` (Task 1).
- Produces:
  - `useAuthToken(): Ref<string | null>` — the raw cookie ref, also used directly by `useApi.ts` (Task 3) to read the token for the `Authorization` header.
  - `useAuth()` returning `{ user: Ref<AuthUser | null>, isAuthenticated: ComputedRef<boolean>, setSession(auth: AuthResponse): void, login(email: string, password: string): Promise<void>, loginWithGoogle(): void, logout(): void }`.
  - `login` is consumed by `pages/login.vue` (Task 4).
  - `loginWithGoogle` is consumed by `pages/login.vue` (Task 4).
  - `setSession` is consumed by `pages/auth/callback.vue` (Task 5).
  - `logout` and `isAuthenticated`/`user` are consumed by `middleware/auth.ts` (Task 6) and any header/nav component later (out of scope here).

- [ ] **Step 1: Create the composable**

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

  return { user, isAuthenticated, setSession, login, loginWithGoogle, logout };
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors. (Nuxt auto-imports `useCookie`, `useState`, `computed` — if typecheck fails on these being unresolved, run `npx nuxt prepare` first from `apps/web` to regenerate `.nuxt/` types, then re-run typecheck.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/composables/useAuth.ts
git commit -m "feat(web): add useAuth composable for session state"
```

---

### Task 3: `useApi` fetch wrapper

**Files:**
- Create: `apps/web/composables/useApi.ts`

**Interfaces:**
- Consumes: `useAuthToken` from `apps/web/composables/useAuth.ts` (Task 2).
- Produces: `useApi<T>(url: string, opts?: Parameters<typeof useFetch>[1]): ReturnType<typeof useFetch<T>>` — a thin wrapper other pages/components call instead of raw `useFetch` for any authenticated endpoint added in future modules. Not consumed by any other task in this plan (login and callback pages call `$fetch`/`useAuth().login` directly, since those two calls are unauthenticated by definition), but must exist and typecheck since it is part of the approved design and future modules depend on it.

- [ ] **Step 1: Create the wrapper**

```typescript
// apps/web/composables/useApi.ts

/** useFetch wrapper that attaches the bearer token cookie, if present, to every request. */
export function useApi<T>(url: string, opts: Parameters<typeof useFetch>[1] = {}) {
  const token = useAuthToken();

  return useFetch<T>(url, {
    ...opts,
    headers: {
      ...(opts.headers as Record<string, string> | undefined),
      ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/composables/useApi.ts
git commit -m "feat(web): add useApi composable for authenticated requests"
```

---

### Task 4: Login page

**Files:**
- Create: `apps/web/pages/login.vue`

**Interfaces:**
- Consumes: `useAuth()` (`login`, `loginWithGoogle`) from Task 2; `Button`, `Input`, `Label`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Alert`, `AlertDescription` from `apps/web/components/ui/**` (already present — see `apps/web/components/ui/{button,input,label,card,alert}/index.ts`).
- Produces: the `/login` route. Consumed by `middleware/auth.ts` (Task 6) as the redirect target.

- [ ] **Step 1: Create the page**

```vue
<!-- apps/web/pages/login.vue -->
<script setup lang="ts">
const email = ref('');
const password = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);

const { login, loginWithGoogle } = useAuth();

async function onSubmit() {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await login(email.value, password.value);
    await navigateTo('/');
  } catch {
    errorMessage.value = 'Email atau kata sandi salah.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>Masuk ke akun Baituna Anda</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" required autocomplete="email" />
          </div>
          <div class="space-y-2">
            <Label for="password">Kata Sandi</Label>
            <Input id="password" v-model="password" type="password" required autocomplete="current-password" />
          </div>
          <Button type="submit" class="w-full" :disabled="isSubmitting">
            {{ isSubmitting ? 'Memproses...' : 'Masuk' }}
          </Button>
        </form>

        <Button variant="outline" class="w-full" @click="loginWithGoogle">
          Masuk dengan Google
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
```

- [ ] **Step 2: Typecheck and lint**

Run (from `apps/web`): `npm run typecheck && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual smoke check**

Run (from `apps/web`): `npm run dev`, open `http://localhost:3000/login`. Confirm the form and "Masuk dengan Google" button render using the existing design system styling (compare visually against `http://localhost:3000/design-system`). Do not submit yet — the database/env may not be configured in this environment; rendering without console errors is sufficient for this step. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/pages/login.vue
git commit -m "feat(web): add login page"
```

---

### Task 5: Google OAuth callback page

**Files:**
- Create: `apps/web/pages/auth/callback.vue`

**Interfaces:**
- Consumes: `useAuth()` (`setSession`) from Task 2; `AuthResponse` type from Task 1 (imported transitively, only needed if annotating the `$fetch` call explicitly, which this step does).
- Produces: the `/auth/callback` route, which is the `googleRedirectUri` target. Note: this plan does not change `GOOGLE_REDIRECT_URI` env configuration — that value must point at `<origin>/auth/callback` for this page to ever receive the query params. Flag this to whoever configures the environment; it is not a code change this plan can make (no `.env` file exists to edit in the repo).

- [ ] **Step 1: Create the page**

```vue
<!-- apps/web/pages/auth/callback.vue -->
<script setup lang="ts">
import type { AuthResponse } from '~/lib/auth-types';

const route = useRoute();
const { setSession } = useAuth();
const errorMessage = ref('');

onMounted(async () => {
  const code = route.query.code;
  const state = route.query.state;

  if (typeof code !== 'string' || typeof state !== 'string') {
    errorMessage.value = 'Tautan Google tidak valid.';
    return;
  }

  try {
    const auth = await $fetch<AuthResponse>('/api/auth/google/callback', {
      query: { code, state },
    });
    setSession(auth);
    await navigateTo('/');
  } catch {
    errorMessage.value = 'Gagal masuk dengan Google. Silakan coba lagi.';
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Alert v-if="errorMessage" variant="destructive" class="max-w-sm">
      <AlertDescription>{{ errorMessage }}</AlertDescription>
    </Alert>
    <p v-else class="text-muted-foreground text-sm">Menyelesaikan proses masuk...</p>
  </div>
</template>
```

- [ ] **Step 2: Typecheck and lint**

Run (from `apps/web`): `npm run typecheck && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual smoke check**

Run (from `apps/web`): `npm run dev`, open `http://localhost:3000/auth/callback` directly with no query params. Confirm it shows the "Tautan Google tidak valid." alert instead of crashing. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/pages/auth/callback.vue
git commit -m "feat(web): add Google OAuth callback page"
```

---

### Task 6: Auth route middleware

**Files:**
- Create: `apps/web/middleware/auth.ts`

**Interfaces:**
- Consumes: `useAuthToken` from `apps/web/composables/useAuth.ts` (Task 2).
- Produces: the named middleware `'auth'`, applied by any future page via `definePageMeta({ middleware: 'auth' })`. Not applied to any page in this plan — Module 1/2's only frontend pages so far (`index.vue`, `design-system.vue`) are intentionally public; wiring `definePageMeta` into a protected page is the responsibility of whichever module plan adds that first protected page.

- [ ] **Step 1: Create the middleware**

```typescript
// apps/web/middleware/auth.ts

/** Redirects to /login if there is no auth token cookie. Apply via definePageMeta({ middleware: 'auth' }). */
export default defineNuxtRouteMiddleware((to) => {
  const token = useAuthToken();
  if (!token.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
});
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Manual smoke check**

Add `definePageMeta({ middleware: 'auth' })` temporarily to the top of `apps/web/pages/design-system.vue`'s `<script setup>` block, run `npm run dev`, visit `http://localhost:3000/design-system` with no auth cookie set, and confirm it redirects to `/login?redirect=%2Fdesign-system`. Then **revert** that temporary edit (`git checkout -- apps/web/pages/design-system.vue`) — it was only to prove the middleware works, `design-system.vue` must stay public. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/web/middleware/auth.ts
git commit -m "feat(web): add auth route middleware"
```

---

### Task 7: Full-stack smoke test (manual, requires configured environment)

This task has no files to create — it verifies Tasks 1-6 together against a real database and real Google OAuth credentials. Skip this task if `.env` (`DATABASE_URL`, `JWT_SECRET`, and the `GOOGLE_*` values) is not configured in the execution environment, and say so explicitly when reporting completion rather than claiming it passed.

- [ ] **Step 1: Verify email/password login end-to-end**

With the database migrated and seeded (see `apps/web/scripts/seed-super-admin.ts` / `db:seed:admin`), run `npm run dev` from `apps/web`, go to `/login`, submit the seeded super admin's email/password, and confirm redirect to `/` with no console errors. Check `document.cookie` in devtools for `auth_token`.

- [ ] **Step 2: Verify Google OAuth end-to-end**

Confirm `GOOGLE_REDIRECT_URI` in the environment is set to `<dev origin>/auth/callback` (per the note in Task 5). Click "Masuk dengan Google" on `/login`, complete the Google consent flow, confirm redirect back through `/auth/callback` to `/` with `auth_token` cookie set.

- [ ] **Step 3: Verify logout clears session**

From the browser console (no logout UI exists yet — out of scope for this plan), run `useAuth().logout()` is not directly callable from devtools; instead confirm manually by clearing the `auth_token` cookie and reloading a middleware-protected page (using the same temporary `definePageMeta` trick as Task 6 Step 3) to confirm it redirects to `/login`.

No commit for this task — it is verification only.
