# Module 1: Auth & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authentication and authorization foundation for Baituna — Google OAuth login for public users, a seeded Super Admin with email/password, JWT issuing, and role/ownership guards that every later module depends on.

**Architecture:** Nitro server routes under `apps/web/server/api/auth/` handle HTTP; all logic lives in `apps/web/server/services/auth.service.ts` and `user.service.ts` so it can be unit-tested without HTTP. JWTs are signed with HS256 via `jose` (already a dependency) and carry `sub` (user id) and `role`. Guards live in `apps/web/server/utils/auth.ts`, which already has a working `requireAuth`. Google OAuth uses the authorization-code flow, hitting Google's token and userinfo endpoints directly with `fetch` — no OAuth client library is added.

**Tech Stack:** Nuxt 4 / Nitro, TypeScript (strict), Drizzle ORM + PostgreSQL, Zod 4, jose 6, Vitest 4, node:crypto (`scrypt`) for password hashing.

**Spec:** `docs/superpowers/specs/2026-08-23-baituna-modules-design.md` (this plan implements §2.1 and §3.1). Background: `docs/baituna-erd.md`, `docs/baituna-prd.md`.

## Global Constraints

These apply to every task. Copied from the spec and the repo's existing conventions.

- **Roles are exactly three:** `super_admin`, `mosque_admin`, `public_user`. Never add a fourth. (ERD §6.3)
- **No email/password registration for the public.** `POST /auth/login` serves only the seeded Super Admin. Public users enter via Google OAuth only. (Spec §2.1)
- **Ownership is per-mosque, not per-role.** Any "owns this mosque" check must compare `mosques.admin_user_id` to the user id. Checking `role === 'mosque_admin'` alone is a bug. (Spec §3.3, ERD §6.3)
- **Never write business logic in route handlers.** Route files parse input, call a service, and shape the response. All decisions live in `server/services/`. (Scaffold convention, see `server/services/README.md`)
- **Soft delete everywhere.** Rows are never hard-deleted. Queries that read live data must filter `isNull(table.deletedAt)`. The `active` column is a generated column — never write to it.
- **Do not touch the `mukims` table or `mosques.mukim_id`.** They exist in the schema but are unused in the MVP. (Spec §2.3)
- **TypeScript is strict.** No `any`. No non-null assertions (`!`) on values that can genuinely be null.
- **Commit messages follow Conventional Commits** (`feat:`, `test:`, `chore:`, `docs:`) — commitlint + husky enforce this on commit.
- **Every command in this plan runs from `apps/web/`** unless stated otherwise.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/vitest.config.ts` | Test harness config | 1 |
| `apps/web/server/services/password.ts` | Hash/verify passwords (scrypt) | 1 |
| `apps/web/server/services/password.test.ts` | Tests for the above | 1 |
| `apps/web/drizzle/schema.ts` | Add `provider`, `providerId`; `passwordHash` nullable | 2 |
| `apps/web/drizzle/0001_*.sql` | Generated migration | 2 |
| `apps/web/server/services/token.ts` | Sign/verify JWTs | 3 |
| `apps/web/server/services/token.test.ts` | Tests for the above | 3 |
| `apps/web/server/services/user.service.ts` | Find/create users, role upgrade | 4 |
| `apps/web/server/services/user.service.test.ts` | Tests for the above | 4 |
| `apps/web/server/api/auth/login.post.ts` | `POST /api/auth/login` | 5 |
| `apps/web/server/services/google-oauth.ts` | Google token + userinfo exchange | 6 |
| `apps/web/server/services/google-oauth.test.ts` | Tests for the above | 6 |
| `apps/web/server/api/auth/google/index.get.ts` | Redirect to Google | 7 |
| `apps/web/server/api/auth/google/callback.get.ts` | Handle Google callback | 7 |
| `apps/web/server/utils/auth.ts` | Add `requireRole`, `requireMosqueOwner` | 8 |
| `apps/web/server/utils/auth.test.ts` | Tests for the above | 8 |
| `apps/web/scripts/seed-super-admin.ts` | Seed script | 9 |
| `apps/web/nuxt.config.ts` | Add OAuth runtime config | 2, 7 |
| `apps/web/.env.example` | Document new env vars | 2, 7 |

**Why `password.ts` and `token.ts` are separate from `auth.service.ts`:** they are pure functions with no database access, which makes them testable without a running Postgres. Everything that touches the DB is isolated in `user.service.ts`.

---

### Task 1: Test harness + password hashing

Nothing in this repo has tests yet and `vitest` has no config file. This task establishes both, using the smallest real deliverable (password hashing) to prove the harness works.

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/server/services/password.ts`
- Test: `apps/web/server/services/password.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hashPassword(plain: string): Promise<string>` — returns `"<saltHex>:<hashHex>"`
  - `verifyPassword(plain: string, stored: string): Promise<boolean>`

- [ ] **Step 1: Create the Vitest config**

Create `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/server/services/password.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies a password against its own hash', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('Tr0ub4dor&3', stored)).toBe(false);
  });

  it('produces a different hash each time for the same password', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');
    expect(first).not.toBe(second);
  });

  it('returns false for a malformed stored value instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });
});
```

The third test matters: it proves the salt is random. Without it, a constant-salt implementation would pass.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- password`
Expected: FAIL — `Failed to resolve import "./password"`.

- [ ] **Step 4: Write the implementation**

Create `apps/web/server/services/password.ts`:

```typescript
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/** Hashes a password with a per-call random salt. Returns "<saltHex>:<hashHex>". */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Verifies a password against a stored "<saltHex>:<hashHex>" value. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;

  const derived = (await scryptAsync(plain, Buffer.from(saltHex, 'hex'), KEY_LENGTH)) as Buffer;
  return timingSafeEqual(derived, expected);
}
```

`timingSafeEqual` throws if the two buffers differ in length, which is why the length is checked first.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- password`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/server/services/password.ts apps/web/server/services/password.test.ts
git commit -m "feat(auth): add password hashing with a vitest harness"
```

---

### Task 2: Schema change for OAuth

Applies spec §2.1 to the database: `password_hash` becomes nullable and two provider columns are added.

**Files:**
- Modify: `apps/web/drizzle/schema.ts:57-63` (the `users` table)
- Create: `apps/web/drizzle/0001_*.sql` (generated — do not hand-write)
- Modify: `apps/web/.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: `authProvider` pgEnum (`'local' | 'google'`), and `users.provider` / `users.providerId` columns for Task 4.

- [ ] **Step 1: Add the provider enum**

In `apps/web/drizzle/schema.ts`, add below the existing `auditAction` enum on line 17:

```typescript
export const authProvider = pgEnum('AuthProvider', ['local', 'google']);
```

- [ ] **Step 2: Update the users table**

Replace the `users` table definition (currently lines 57-63) with:

```typescript
export const users = pgTable(
  'users',
  {
    ...createAuditColumns(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    // Nullable: users who sign in through Google never set a password.
    passwordHash: text('password_hash'),
    provider: authProvider('provider').notNull().default('local'),
    // Subject id from the OAuth provider; null for local accounts.
    providerId: text('provider_id'),
    role: userRole('role').notNull().default('public_user'),
  },
  (table) => [unique('users_provider_key').on(table.provider, table.providerId)],
);
```

`unique` is already imported at the top of the file, so no import change is needed.

- [ ] **Step 3: Generate the migration**

Run: `npm run db:generate`
Expected: a new file `apps/web/drizzle/0001_<random-name>.sql` appears, and `apps/web/drizzle/meta/` is updated.

- [ ] **Step 4: Verify the generated SQL**

Read the new `0001_*.sql`. It must contain an `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`, two `ADD COLUMN` statements, a `CREATE TYPE "AuthProvider"`, and a unique constraint on `(provider, provider_id)`.

If it instead contains `DROP TABLE` or `DROP COLUMN` for anything, stop — the schema edit was wrong. Do not apply it.

- [ ] **Step 5: Apply the migration**

Start the database if it is not running (from the repo root): `docker compose -f docker/docker-compose.yml up -d db`

Then from `apps/web/`: `npm run db:migrate`
Expected: migration applies with no error.

- [ ] **Step 6: Document the seed env vars**

Append to `apps/web/.env.example`:

```
# Seeded Super Admin (used by: npm run db:seed:admin)
SUPER_ADMIN_EMAIL="admin@baituna.local"
SUPER_ADMIN_PASSWORD="replace-with-a-strong-password"
SUPER_ADMIN_NAME="Super Admin"
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/drizzle/ apps/web/.env.example
git commit -m "feat(auth): add OAuth provider columns to users"
```

---

### Task 3: JWT signing and verification

**Files:**
- Create: `apps/web/server/services/token.ts`
- Test: `apps/web/server/services/token.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AuthTokenPayload = { sub: string; role: 'super_admin' | 'mosque_admin' | 'public_user' }`
  - `signAuthToken(payload: AuthTokenPayload, secret: string): Promise<string>`
  - `verifyAuthToken(token: string, secret: string): Promise<AuthTokenPayload | null>` — returns `null` on any failure, never throws.

Task 5, 7, and 8 all use these.

- [ ] **Step 1: Write the failing test**

Create `apps/web/server/services/token.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { signAuthToken, verifyAuthToken } from './token';

const SECRET = 'test-secret-that-is-long-enough-for-hs256';

describe('auth tokens', () => {
  it('round-trips a payload', async () => {
    const token = await signAuthToken({ sub: 'user-1', role: 'super_admin' }, SECRET);
    const payload = await verifyAuthToken(token, SECRET);
    expect(payload).toEqual({ sub: 'user-1', role: 'super_admin' });
  });

  it('returns null when the secret does not match', async () => {
    const token = await signAuthToken({ sub: 'user-1', role: 'public_user' }, SECRET);
    expect(await verifyAuthToken(token, 'a-completely-different-secret-value')).toBeNull();
  });

  it('returns null for a malformed token instead of throwing', async () => {
    expect(await verifyAuthToken('not.a.jwt', SECRET)).toBeNull();
  });

  it('returns null when the role claim is not a known role', async () => {
    // A token signed with a valid secret but a bogus role must still be rejected.
    const { SignJWT } = await import('jose');
    const forged = await new SignJWT({ role: 'root' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));

    expect(await verifyAuthToken(forged, SECRET)).toBeNull();
  });
});
```

The last test is the important one: a valid signature is not enough, the claims must also be shaped correctly.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- token`
Expected: FAIL — `Failed to resolve import "./token"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/server/services/token.ts`:

```typescript
import { SignJWT, jwtVerify } from 'jose';

const ROLES = ['super_admin', 'mosque_admin', 'public_user'] as const;

export type UserRole = (typeof ROLES)[number];

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

const TOKEN_LIFETIME = '7d';

/** Signs a 7-day HS256 token carrying the user id and role. */
export async function signAuthToken(payload: AuthTokenPayload, secret: string): Promise<string> {
  return await new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(new TextEncoder().encode(secret));
}

/** Verifies a token. Returns null for any invalid token — bad signature, expiry, or claims. */
export async function verifyAuthToken(
  token: string,
  secret: string,
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = payload.role;
    const sub = payload.sub;

    if (typeof sub !== 'string' || typeof role !== 'string') return null;
    if (!ROLES.includes(role as UserRole)) return null;

    return { sub, role: role as UserRole };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- token`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/services/token.ts apps/web/server/services/token.test.ts
git commit -m "feat(auth): add JWT signing and verification"
```

---

### Task 4: User service

The only module that touches the `users` table. Tests inject a fake database so they need no running Postgres.

**Files:**
- Create: `apps/web/server/services/user.service.ts`
- Test: `apps/web/server/services/user.service.test.ts`

**Interfaces:**
- Consumes: `users` table from Task 2.
- Produces:
  - `type AuthUser = { id: string; name: string; email: string; role: UserRole }`
  - `findUserByEmail(db: Database, email: string): Promise<UserRow | null>`
  - `findOrCreateGoogleUser(db: Database, profile: GoogleProfile): Promise<AuthUser>`
  - `upgradeToMosqueAdmin(db: Database, userId: string): Promise<void>` — used by Module 3, not by this module.

- [ ] **Step 1: Write the failing test**

Create `apps/web/server/services/user.service.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

import { findOrCreateGoogleUser } from './user.service';
import type { Database } from './user.service';

/** Minimal fake matching the Drizzle call chains the service uses. */
function fakeDb(options: { existing?: unknown[]; inserted?: unknown[] }) {
  const insertValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(options.inserted ?? []),
  });

  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(options.existing ?? []),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    } as unknown as Database,
    insertValues,
  };
}

const profile = { providerId: 'google-sub-123', email: 'aisyah@example.com', name: 'Aisyah' };

describe('findOrCreateGoogleUser', () => {
  it('returns the existing user without inserting', async () => {
    const { db } = fakeDb({
      existing: [
        { id: 'user-1', name: 'Aisyah', email: 'aisyah@example.com', role: 'mosque_admin' },
      ],
    });

    const user = await findOrCreateGoogleUser(db, profile);

    expect(user).toEqual({
      id: 'user-1',
      name: 'Aisyah',
      email: 'aisyah@example.com',
      role: 'mosque_admin',
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('creates a public_user when the provider id is unknown', async () => {
    const { db, insertValues } = fakeDb({
      existing: [],
      inserted: [
        { id: 'user-2', name: 'Aisyah', email: 'aisyah@example.com', role: 'public_user' },
      ],
    });

    const user = await findOrCreateGoogleUser(db, profile);

    expect(user.role).toBe('public_user');
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        providerId: 'google-sub-123',
        passwordHash: null,
        role: 'public_user',
      }),
    );
  });

  it('throws when the insert returns nothing', async () => {
    const { db } = fakeDb({ existing: [], inserted: [] });
    await expect(findOrCreateGoogleUser(db, profile)).rejects.toThrow('Failed to create user');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- user.service`
Expected: FAIL — `Failed to resolve import "./user.service"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/server/services/user.service.ts`:

```typescript
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '../../drizzle/schema';
import { users } from '../../drizzle/schema';
import type { UserRole } from './token';

export type Database = NodePgDatabase<typeof schema>;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface GoogleProfile {
  providerId: string;
  email: string;
  name: string;
}

/** Looks up a live local-provider user by email. Used by password login only. */
export async function findUserByEmail(db: Database, email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.provider, 'local'), isNull(users.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Resolves a Google profile to a user, creating a public_user on first sign-in.
 * Matching is by provider id, never by email — an email match would let someone
 * take over an account by registering the same address with a different provider.
 */
export async function findOrCreateGoogleUser(
  db: Database,
  profile: GoogleProfile,
): Promise<AuthUser> {
  const existing = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.provider, 'google'),
        eq(users.providerId, profile.providerId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const found = existing[0];
  if (found) {
    return { id: found.id, name: found.name, email: found.email, role: found.role };
  }

  const inserted = await db
    .insert(users)
    .values({
      name: profile.name,
      email: profile.email,
      passwordHash: null,
      provider: 'google',
      providerId: profile.providerId,
      role: 'public_user',
    })
    .returning();

  const created = inserted[0];
  if (!created) throw new Error('Failed to create user');

  return { id: created.id, name: created.name, email: created.email, role: created.role };
}

/**
 * Promotes a user to mosque_admin. Called by Module 3 when a mosque is approved.
 * A user who is already super_admin is left alone — never demote.
 */
export async function upgradeToMosqueAdmin(db: Database, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ role: 'mosque_admin', modifiedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.role, 'public_user'), isNull(users.deletedAt)));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- user.service`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/services/user.service.ts apps/web/server/services/user.service.test.ts
git commit -m "feat(auth): add user lookup and Google user provisioning"
```

---

### Task 5: Password login endpoint

`POST /api/auth/login`, serving only the seeded Super Admin (Global Constraints).

**Files:**
- Create: `apps/web/server/api/auth/login.post.ts`

**Interfaces:**
- Consumes: `verifyPassword` (Task 1), `signAuthToken` (Task 3), `findUserByEmail` (Task 4), `useDatabase` (existing, `server/utils/database.ts`), `parseBody` (existing, `server/utils/validation.ts`).
- Produces: response `{ token: string; user: { id, name, email, role } }`.

There is no unit test for this file — it is a thin composition of already-tested pieces, and its behavior is covered by manual verification here and by e2e tests in a later module.

- [ ] **Step 1: Write the route**

Create `apps/web/server/api/auth/login.post.ts`:

```typescript
import { z } from 'zod';

import { signAuthToken } from '../../services/token';
import { findUserByEmail } from '../../services/user.service';
import { verifyPassword } from '../../services/password';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const { email, password } = await parseBody(event, loginSchema);
  const { jwtSecret } = useRuntimeConfig();

  if (!jwtSecret) {
    throw createError({ statusCode: 500, statusMessage: 'JWT_SECRET is not configured' });
  }

  const user = await findUserByEmail(useDatabase(), email);

  // One message for both "no such user" and "wrong password" so the response
  // cannot be used to discover which emails exist.
  const invalid = () =>
    createError({ statusCode: 401, statusMessage: 'Invalid email or password' });

  if (!user?.passwordHash) throw invalid();
  if (!(await verifyPassword(password, user.passwordHash))) throw invalid();

  return {
    token: await signAuthToken({ sub: user.id, role: user.role }, jwtSecret),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
});
```

`parseBody`, `useDatabase`, `useRuntimeConfig`, and `createError` are auto-imported by Nitro — do not add imports for them.

- [ ] **Step 2: Verify it type-checks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/api/auth/login.post.ts
git commit -m "feat(auth): add password login endpoint"
```

---

### Task 6: Google OAuth exchange

Pure functions that talk to Google. Tests stub `fetch`, so no network access is needed.

**Files:**
- Create: `apps/web/server/services/google-oauth.ts`
- Test: `apps/web/server/services/google-oauth.test.ts`

**Interfaces:**
- Consumes: `GoogleProfile` type from Task 4.
- Produces:
  - `buildGoogleAuthUrl(config: GoogleOAuthConfig, state: string): string`
  - `exchangeGoogleCode(config: GoogleOAuthConfig, code: string): Promise<GoogleProfile>`
  - `interface GoogleOAuthConfig { clientId: string; clientSecret: string; redirectUri: string }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/server/services/google-oauth.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildGoogleAuthUrl, exchangeGoogleCode } from './google-oauth';

const config = {
  clientId: 'client-id-123',
  clientSecret: 'client-secret-456',
  redirectUri: 'http://localhost:3000/api/auth/google/callback',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildGoogleAuthUrl', () => {
  it('includes the client id, redirect uri, and state', () => {
    const url = new URL(buildGoogleAuthUrl(config, 'state-token'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id-123');
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toContain('email');
  });
});

describe('exchangeGoogleCode', () => {
  it('returns the profile from the userinfo response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at-1' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'google-sub-1', email: 'x@example.com', name: 'Xavier' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const profile = await exchangeGoogleCode(config, 'auth-code');

    expect(profile).toEqual({
      providerId: 'google-sub-1',
      email: 'x@example.com',
      name: 'Xavier',
    });
  });

  it('throws when the token exchange fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(exchangeGoogleCode(config, 'bad-code')).rejects.toThrow(
      'Google token exchange failed',
    );
  });

  it('throws when the profile has no email', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'google-sub-1' }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeGoogleCode(config, 'auth-code')).rejects.toThrow(
      'Google profile is missing required fields',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- google-oauth`
Expected: FAIL — `Failed to resolve import "./google-oauth"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/server/services/google-oauth.ts`:

```typescript
import type { GoogleProfile } from './user.service';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/** Builds the URL the browser is redirected to in order to start the OAuth flow. */
export function buildGoogleAuthUrl(config: GoogleOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Trades an authorization code for the user's Google profile. */
export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  code: string,
): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) throw new Error('Google token exchange failed');

  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) throw new Error('Google token exchange failed');

  const profileResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!profileResponse.ok) throw new Error('Failed to fetch Google profile');

  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
  };

  if (!profile.sub || !profile.email) {
    throw new Error('Google profile is missing required fields');
  }

  return {
    providerId: profile.sub,
    email: profile.email,
    // Google omits `name` when the user hides it; fall back to the email local part.
    name: profile.name ?? profile.email.split('@')[0],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- google-oauth`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/services/google-oauth.ts apps/web/server/services/google-oauth.test.ts
git commit -m "feat(auth): add Google OAuth code exchange"
```

---

### Task 7: Google OAuth routes

Wires Task 6 into two endpoints and adds the runtime config they read.

**Files:**
- Create: `apps/web/server/api/auth/google/index.get.ts`
- Create: `apps/web/server/api/auth/google/callback.get.ts`
- Modify: `apps/web/nuxt.config.ts` (the `runtimeConfig` block)
- Modify: `apps/web/.env.example`

**Interfaces:**
- Consumes: `buildGoogleAuthUrl`, `exchangeGoogleCode` (Task 6), `findOrCreateGoogleUser` (Task 4), `signAuthToken` (Task 3).
- Produces: `GET /api/auth/google` (302 to Google) and `GET /api/auth/google/callback` (returns `{ token, user }`).

- [ ] **Step 1: Add the runtime config**

In `apps/web/nuxt.config.ts`, replace the existing `runtimeConfig` block with:

```typescript
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
  },
```

- [ ] **Step 2: Document the new env vars**

Append to `apps/web/.env.example`:

```
# Google OAuth (create credentials at https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
```

- [ ] **Step 3: Write the redirect route**

Create `apps/web/server/api/auth/google/index.get.ts`:

```typescript
import { randomBytes } from 'node:crypto';

import { buildGoogleAuthUrl } from '../../../services/google-oauth';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  if (!config.googleClientId || !config.googleRedirectUri) {
    throw createError({ statusCode: 500, statusMessage: 'Google OAuth is not configured' });
  }

  // CSRF protection: the state is echoed back by Google and compared in the callback.
  const state = randomBytes(16).toString('hex');

  setCookie(event, 'oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return sendRedirect(
    event,
    buildGoogleAuthUrl(
      {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        redirectUri: config.googleRedirectUri,
      },
      state,
    ),
  );
});
```

- [ ] **Step 4: Write the callback route**

Create `apps/web/server/api/auth/google/callback.get.ts`:

```typescript
import { z } from 'zod';

import { exchangeGoogleCode } from '../../../services/google-oauth';
import { signAuthToken } from '../../../services/token';
import { findOrCreateGoogleUser } from '../../../services/user.service';

const querySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const parsed = querySchema.safeParse(getQuery(event));

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Missing code or state' });
  }

  const expectedState = getCookie(event, 'oauth_state');
  deleteCookie(event, 'oauth_state', { path: '/' });

  if (!expectedState || expectedState !== parsed.data.state) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state' });
  }

  if (!config.jwtSecret) {
    throw createError({ statusCode: 500, statusMessage: 'JWT_SECRET is not configured' });
  }

  const profile = await exchangeGoogleCode(
    {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      redirectUri: config.googleRedirectUri,
    },
    parsed.data.code,
  );

  const user = await findOrCreateGoogleUser(useDatabase(), profile);

  return {
    token: await signAuthToken({ sub: user.id, role: user.role }, config.jwtSecret),
    user,
  };
});
```

`setCookie`, `getCookie`, `deleteCookie`, `getQuery`, and `sendRedirect` are Nitro auto-imports — do not import them.

- [ ] **Step 5: Verify it type-checks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/api/auth/google/ apps/web/nuxt.config.ts apps/web/.env.example
git commit -m "feat(auth): add Google OAuth redirect and callback routes"
```

---

### Task 8: Role and ownership guards

Every later module gates its endpoints with these. `requireAuth` already exists in `server/utils/auth.ts` and stays — this task refactors it onto `verifyAuthToken` and adds two guards beside it.

**Files:**
- Modify: `apps/web/server/utils/auth.ts` (replace the whole file)
- Test: `apps/web/server/utils/auth.test.ts`

**Interfaces:**
- Consumes: `verifyAuthToken`, `UserRole`, `AuthTokenPayload` (Task 3).
- Produces:
  - `requireAuth(event): Promise<AuthTokenPayload>`
  - `requireRole(event, ...roles: UserRole[]): Promise<AuthTokenPayload>` — 403 when the role does not match
  - `requireMosqueOwner(event, mosqueId): Promise<AuthTokenPayload>` — `super_admin` always passes; `mosque_admin` passes only when `mosques.admin_user_id` equals their id

Module 3, 5, and 6 all consume these.

- [ ] **Step 1: Write the failing test**

Create `apps/web/server/utils/auth.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

import { assertRole } from './auth';

describe('assertRole', () => {
  it('passes when the role is in the allowed list', () => {
    expect(() => assertRole({ sub: 'u1', role: 'super_admin' }, ['super_admin'])).not.toThrow();
  });

  it('passes when the role is one of several allowed', () => {
    expect(() =>
      assertRole({ sub: 'u1', role: 'mosque_admin' }, ['super_admin', 'mosque_admin']),
    ).not.toThrow();
  });

  it('throws a 403 when the role is not allowed', () => {
    expect(() => assertRole({ sub: 'u1', role: 'public_user' }, ['super_admin'])).toThrowError(
      expect.objectContaining({ statusCode: 403 }),
    );
  });
});
```

`assertRole` is the pure, testable core of `requireRole` — separating it keeps the HTTP-bound guard thin while the decision itself stays unit-testable.

Only `assertRole` is unit-tested here. The other two guards call Nitro
auto-imports (`getHeader`, `useRuntimeConfig`, `useDatabase`) that do not exist
outside a Nitro server context; testing them properly needs an HTTP-level test,
which belongs to the e2e suite in a later module. This is why the test file
imports `assertRole` alone — do not add unit tests for `requireAuth` or
`requireMosqueOwner` here, they will fail for environment reasons rather than
logic reasons.

- [ ] **Step 2: Stub `createError` for the test environment**

`createError` is a Nitro auto-import and is not defined when Vitest runs the file directly. Add this to `apps/web/vitest.config.ts`, inside `test`:

```typescript
    setupFiles: ['./vitest.setup.ts'],
```

Create `apps/web/vitest.setup.ts`:

```typescript
import { vi } from 'vitest';

// Nitro auto-imports these at runtime; unit tests import the modules directly,
// so the globals have to exist before the module under test is evaluated.
vi.stubGlobal('createError', (input: { statusCode: number; statusMessage: string }) => {
  const error = new Error(input.statusMessage) as Error & { statusCode: number };
  error.statusCode = input.statusCode;
  return error;
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- utils/auth`
Expected: FAIL — `assertRole` is not exported.

- [ ] **Step 4: Rewrite the guards**

Replace the entire contents of `apps/web/server/utils/auth.ts` with:

```typescript
import { and, eq, isNull } from 'drizzle-orm';
import type { H3Event } from 'h3';

import { mosques } from '../../drizzle/schema';
import { type AuthTokenPayload, type UserRole, verifyAuthToken } from '../services/token';

/** Pure role check, extracted so it can be unit-tested without an H3 event. */
export function assertRole(payload: AuthTokenPayload, allowed: UserRole[]): void {
  if (!allowed.includes(payload.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' });
  }
}

/** Requires a valid bearer token. Throws 401 otherwise. */
export async function requireAuth(event: H3Event): Promise<AuthTokenPayload> {
  const authorization = getHeader(event, 'authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  const { jwtSecret } = useRuntimeConfig();

  if (!token || !jwtSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' });
  }

  const payload = await verifyAuthToken(token, jwtSecret);
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired token' });
  }

  return payload;
}

/** Requires a valid token whose role is one of `allowed`. */
export async function requireRole(
  event: H3Event,
  ...allowed: UserRole[]
): Promise<AuthTokenPayload> {
  const payload = await requireAuth(event);
  assertRole(payload, allowed);
  return payload;
}

/**
 * Requires the caller to own `mosqueId`. Ownership is `mosques.admin_user_id`,
 * never the role alone — a mosque_admin of one mosque must not touch another.
 * super_admin bypasses the ownership check.
 */
export async function requireMosqueOwner(
  event: H3Event,
  mosqueId: string,
): Promise<AuthTokenPayload> {
  const payload = await requireAuth(event);
  if (payload.role === 'super_admin') return payload;

  const rows = await useDatabase()
    .select({ adminUserId: mosques.adminUserId })
    .from(mosques)
    .where(and(eq(mosques.id, mosqueId), isNull(mosques.deletedAt)))
    .limit(1);

  const mosque = rows[0];
  if (!mosque) {
    throw createError({ statusCode: 404, statusMessage: 'Mosque not found' });
  }

  if (mosque.adminUserId !== payload.sub) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' });
  }

  return payload;
}
```

Note the signature change: the old `requireAuth` took `{ headers: Headers }`, the new one takes an `H3Event` and uses `getHeader`. No route calls it yet, so nothing breaks.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- utils/auth`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the whole suite and type-check**

Run: `npm test && npm run typecheck`
Expected: all tests pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/utils/auth.ts apps/web/server/utils/auth.test.ts apps/web/vitest.config.ts apps/web/vitest.setup.ts
git commit -m "feat(auth): add role and mosque-ownership guards"
```

---

### Task 9: Super Admin seed script

The only way a Super Admin account comes into existence (Global Constraints).

**Files:**
- Create: `apps/web/scripts/seed-super-admin.ts`
- Modify: `apps/web/package.json` (add the `db:seed:admin` script)

**Interfaces:**
- Consumes: `hashPassword` (Task 1), `users` table (Task 2).
- Produces: an `npm run db:seed:admin` command.

- [ ] **Step 1: Write the script**

Create `apps/web/scripts/seed-super-admin.ts`:

```typescript
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../drizzle/schema';
import { users } from '../drizzle/schema';
import { hashPassword } from '../server/services/password';

/**
 * Creates the Super Admin account, or resets its password if it already exists.
 * Run with: npm run db:seed:admin
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must both be set');
  }
  if (password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    const passwordHash = await hashPassword(password);
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(users)
        .set({ passwordHash, role: 'super_admin', modifiedAt: new Date() })
        .where(eq(users.id, existing[0].id));
      console.log(`Updated existing Super Admin: ${email}`);
    } else {
      await db.insert(users).values({
        name,
        email,
        passwordHash,
        provider: 'local',
        role: 'super_admin',
      });
      console.log(`Created Super Admin: ${email}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

The script is idempotent: running it twice resets the password rather than failing on the unique email constraint.

- [ ] **Step 2: Add the npm script**

In `apps/web/package.json`, add to `scripts`, after `"db:studio"`:

```json
    "db:seed:admin": "node --env-file=.env scripts/seed-super-admin.ts"
```

Remember to add a comma to the end of the `"db:studio"` line.

Node 24 (see `.nvmrc`) runs TypeScript directly by stripping types, so no
build step or loader flag is needed. If the command fails with a syntax error
on the first `import type`, the Node version is too old — check with
`node --version` and switch to 24 via `nvm use`.

- [ ] **Step 3: Run the seed**

Make sure `apps/web/.env` exists with `DATABASE_URL`, `SUPER_ADMIN_EMAIL`, and `SUPER_ADMIN_PASSWORD` set, and that the database is running and migrated.

Run: `npm run db:seed:admin`
Expected: `Created Super Admin: <email>`.

Run it a second time.
Expected: `Updated existing Super Admin: <email>` — proving idempotence.

- [ ] **Step 4: Verify login end to end**

Start the dev server: `npm run dev`

In another terminal, using the same credentials from `.env`:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<SUPER_ADMIN_EMAIL>","password":"<SUPER_ADMIN_PASSWORD>"}'
```

Expected: JSON with a `token` and `user.role` of `"super_admin"`.

Then verify a wrong password is rejected:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<SUPER_ADMIN_EMAIL>","password":"definitely-wrong"}'
```

Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/scripts/seed-super-admin.ts apps/web/package.json
git commit -m "feat(auth): add Super Admin seed script"
```

---

### Task 10: Document the module

**Files:**
- Modify: `apps/web/server/services/README.md`

- [ ] **Step 1: Append the module notes**

Add to the end of `apps/web/server/services/README.md`:

```markdown
## Module 1 — Auth & RBAC

| File | Responsibility |
| --- | --- |
| `password.ts` | scrypt hashing; pure, no DB |
| `token.ts` | JWT sign/verify; pure, no DB |
| `google-oauth.ts` | Google token + userinfo exchange |
| `user.service.ts` | The only module that reads or writes `users` |

Guards live in `server/utils/auth.ts`:

- `requireAuth(event)` — valid bearer token, else 401
- `requireRole(event, ...roles)` — 403 when the role does not match
- `requireMosqueOwner(event, mosqueId)` — checks `mosques.admin_user_id`;
  `super_admin` bypasses. **Never gate mosque access on role alone.**

Super Admins are created only by `npm run db:seed:admin`. Public users are
created only by the Google OAuth callback, always as `public_user`. There is
no public email/password registration.
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/services/README.md
git commit -m "docs(auth): document the auth module layout and guards"
```

---

## Definition of Done

- [ ] `npm test` passes from `apps/web/` (18 tests across 5 files)
- [ ] `npm run typecheck` reports no errors
- [ ] `npm run lint` reports no errors
- [ ] `npm run db:seed:admin` is idempotent across two consecutive runs
- [ ] `POST /api/auth/login` returns a token for the seeded admin and 401 for a wrong password
- [ ] `GET /api/auth/google` redirects to `accounts.google.com` (verify with `curl -sI`)

Google OAuth callback cannot be fully verified without real Google credentials. If they are unavailable, note it in the handoff rather than marking it verified.

## Out of Scope

These belong to later modules and must not be built here: mosque registration and approval (Module 3), the `upgradeToMosqueAdmin` **call site** (Module 3 — this plan only provides the function), search (Module 4), Person CRUD (Module 5), Friday assignments (Module 6), audit logging (Module 7), and every mobile screen.
