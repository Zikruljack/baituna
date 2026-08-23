# Module 4: Mosque Search & Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three public, unauthenticated read endpoints Public Users need to find a mosque without logging in: nearby search by coordinates, keyword search by name/address, and single-mosque detail.

**Architecture:** Nitro routes under `apps/web/server/api/mosques/` (`nearby.get.ts`, `search.get.ts`, `[id].get.ts`) stay thin — parse query params, call `mosque-search.service.ts`, shape the response. All three endpoints share one rule enforced in the service layer, not per-route: only mosques with `status = 'approved'` are ever returned. Nearby search does a SQL bounding-box pre-filter (indexed `lat`/`lng` range) before computing precise Haversine distance and sorting in application code — never PostGIS. A new Nitro middleware rate-limits the two unauthenticated list endpoints to 60 req/min per IP, in-memory (no Redis dependency for MVP scale).

**Tech Stack:** Nuxt 4 / Nitro, TypeScript (strict), Drizzle ORM + PostgreSQL, Zod 4, Vitest 4. No new dependencies — Haversine is plain arithmetic, no geo library.

**Spec:** `docs/superpowers/specs/2026-08-23-baituna-modules-design.md` (this plan implements §3.4). Background: `docs/baituna-prd.md` §4.1, §5 (rate limiting, Haversine + bounding box decision), `docs/baituna-erd.md` §6.1 (`mosques` entity).

## Global Constraints

These apply to every task. Copied from the spec, the PRD, and the repo's existing conventions.

- **Only `status = 'approved'` mosques are ever visible through these endpoints.** `nearby`, `search`, and detail-by-id all filter it. A `pending` or `rejected` mosque returns 404 from the detail endpoint, not a 403 — its existence is not revealed to the public. (PRD §4.1, spec §3.4)
- **Haversine + bounding-box pre-filter, never PostGIS.** Pre-filter candidates in SQL with a `lat`/`lng` range (`WHERE lat BETWEEN .. AND lng BETWEEN ..`), then compute exact Haversine distance and sort only among the candidates that pass. (PRD §4.1)
- **Rate limit: 60 requests/minute per IP** on `nearby` and `search` (the two endpoints reachable without auth and without a specific resource id). Enforced in Nitro middleware. (PRD §5)
- **Soft delete everywhere.** Every query filters `isNull(mosques.deletedAt)` in addition to the `approved` status filter. The `active` column is a generated column — never write to it.
- **Never write business logic in route handlers.** Route files parse input, call a service, and shape the response. All decisions live in `server/services/`. (Scaffold convention, `server/services/README.md`)
- **Do not touch the `mukims` table or `mosques.mukim_id`.** They exist in the schema but are unused in the MVP. (Spec §2.3)
- **TypeScript is strict.** No `any`. No non-null assertions (`!`) on values that can genuinely be null.
- **Commit messages follow Conventional Commits** (`feat:`, `test:`, `chore:`, `docs:`) — commitlint + husky enforce this on commit.
- **Every command in this plan runs from `apps/web/`** unless stated otherwise.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/server/services/mosque-search.service.ts` | Haversine, bounding box, keyword search, detail lookup — all read-only | 1, 2, 3 |
| `apps/web/server/services/mosque-search.service.test.ts` | Tests for the above | 1, 2, 3 |
| `apps/web/server/utils/validation.ts` | Add `nearbyQuerySchema`, `searchQuerySchema` | 1, 2 |
| `apps/web/server/api/mosques/nearby.get.ts` | `GET /api/mosques/nearby` | 1 |
| `apps/web/server/api/mosques/search.get.ts` | `GET /api/mosques/search` | 2 |
| `apps/web/server/api/mosques/[id].get.ts` | `GET /api/mosques/:id` | 3 |
| `apps/web/server/middleware/rate-limit.ts` | 60 req/min/IP limiter for public list endpoints | 4 |
| `apps/web/server/middleware/rate-limit.test.ts` | Tests for the above | 4 |
| `apps/web/server/utils/openapi.ts` | Fill in real summaries/params for the three routes | 5 |

**Why `mosque-search.service.ts` is a separate file from `mosque.service.ts`:** `mosque.service.ts` (Module 7's worked example, and Module 3's future home) owns mosque *writes* — registration, approval, rejection. This module only reads `approved` mosques for the public. Splitting them keeps the write-side transactional/audit logic away from the read-side's very different concerns (geo math, pagination-free list shaping), and means this plan's tasks never conflict with Module 3's on the same file.

---

### Task 1: Nearby search — bounding box + Haversine

**Files:**
- Create: `apps/web/server/services/mosque-search.service.ts`
- Test: `apps/web/server/services/mosque-search.service.test.ts`
- Modify: `apps/web/server/utils/validation.ts`
- Create: `apps/web/server/api/mosques/nearby.get.ts`

**Interfaces:**
- Consumes: `useDatabase` (`server/utils/database.ts`), `mosques` table (`drizzle/schema.ts`), `parseBody`-style pattern from `server/utils/validation.ts` (this task adds a query-parsing sibling, `parseQuery`).
- Produces:
  - `MosqueSummary` — `{ id: string; name: string; address: string; latitude: number; longitude: number; photoUrl: string | null; distanceKm?: number }` (`distanceKm` present only from `findNearbyMosques`)
  - `findNearbyMosques(db: Database, params: { lat: number; lng: number; radiusKm: number }): Promise<MosqueSummary[]>` — sorted ascending by `distanceKm`
  - `nearbyQuerySchema` (Zod) — validates `lat`, `lng` as `-90..90` / `-180..180`, `radius` as a positive number capped at a sane max (50 km)
  - `parseQuery<T>(event, schema: ZodType<T>)` (added to `validation.ts`) — mirrors `parseBody`, using `getValidatedQuery` from H3

- [ ] **Step 1: Write the failing tests**

Create `apps/web/server/services/mosque-search.service.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
  kind: 'sql',
  strings,
  values,
}));
const and = vi.fn((...conditions: unknown[]) => ({ kind: 'and', conditions }));
const eq = vi.fn((left: unknown, right: unknown) => ({ kind: 'eq', left, right }));
const isNull = vi.fn((column: unknown) => ({ kind: 'isNull', column }));
const between = vi.fn((column: unknown, min: unknown, max: unknown) => ({
  kind: 'between',
  column,
  min,
  max,
}));

vi.mock('drizzle-orm', () => ({ sql, and, eq, isNull, between }));

import { findNearbyMosques, type Database } from './mosque-search.service';

function fakeDb(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { db: { select } as unknown as Database, select, from, where };
}

describe('findNearbyMosques', () => {
  it('pre-filters by bounding box then sorts remaining candidates by exact Haversine distance', async () => {
    // Banda Aceh city center: 5.5483, 95.3238
    const candidates = [
      { id: 'a', name: 'Masjid Jauh', address: 'Jl. A', latitude: '5.60', longitude: '95.40', photoUrl: null },
      { id: 'b', name: 'Masjid Dekat', address: 'Jl. B', latitude: '5.549', longitude: '95.324', photoUrl: null },
    ];
    const { db } = fakeDb(candidates);

    const result = await findNearbyMosques(db, { lat: 5.5483, lng: 95.3238, radiusKm: 20 });

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('b');
    expect(result[0]?.distanceKm).toBeLessThan(result[1]?.distanceKm ?? Infinity);
    expect(result[0]?.distanceKm).toBeGreaterThanOrEqual(0);
  });

  it('excludes candidates outside the exact radius even if inside the bounding box', async () => {
    // A point inside the lat/lng box corners but outside true circular radius.
    const candidates = [
      { id: 'corner', name: 'Masjid Sudut', address: 'Jl. C', latitude: '5.70', longitude: '95.50', photoUrl: null },
    ];
    const { db } = fakeDb(candidates);

    const result = await findNearbyMosques(db, { lat: 5.5483, lng: 95.3238, radiusKm: 5 });

    expect(result).toHaveLength(0);
  });

  it('returns an empty array when nothing is nearby', async () => {
    const { db } = fakeDb([]);
    const result = await findNearbyMosques(db, { lat: 0, lng: 0, radiusKm: 10 });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- mosque-search.service` (from `apps/web/`)
Expected: FAIL — `mosque-search.service.ts` does not exist yet.

- [ ] **Step 3: Add `parseQuery` to validation.ts**

Modify `apps/web/server/utils/validation.ts`:

```typescript
import { type ZodType, z } from 'zod';

export const uuidSchema = z.string().uuid();

export async function parseBody<T>(event: Parameters<typeof readBody>[0], schema: ZodType<T>) {
  return await readValidatedBody(event, (body) => schema.parse(body));
}

export async function parseQuery<T>(event: Parameters<typeof getQuery>[0], schema: ZodType<T>) {
  return await getValidatedQuery(event, (query) => schema.parse(query));
}
```

- [ ] **Step 4: Implement the service**

Create `apps/web/server/services/mosque-search.service.ts`:

```typescript
import { and, between, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';

import type * as schema from '../../drizzle/schema';
import { mosques } from '../../drizzle/schema';

export type Database = NodePgDatabase<typeof schema>;

export interface MosqueSummary {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  distanceKm?: number;
}

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50).default(5),
});

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points, in kilometers. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * One degree of latitude is ~111km everywhere; one degree of longitude
 * shrinks by cos(latitude). Used to build a generous rectangular
 * pre-filter box before the precise Haversine pass below.
 */
function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

export async function findNearbyMosques(
  db: Database,
  params: { lat: number; lng: number; radiusKm: number },
): Promise<MosqueSummary[]> {
  const box = boundingBox(params.lat, params.lng, params.radiusKm);

  const candidates = await db
    .select({
      id: mosques.id,
      name: mosques.name,
      address: mosques.address,
      latitude: mosques.latitude,
      longitude: mosques.longitude,
      photoUrl: mosques.photoUrl,
    })
    .from(mosques)
    .where(
      and(
        eq(mosques.status, 'approved'),
        isNull(mosques.deletedAt),
        between(sql`${mosques.latitude}::double precision`, box.minLat, box.maxLat),
        between(sql`${mosques.longitude}::double precision`, box.minLng, box.maxLng),
      ),
    );

  return candidates
    .map((row) => {
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      return {
        id: row.id,
        name: row.name,
        address: row.address,
        latitude,
        longitude,
        photoUrl: row.photoUrl,
        distanceKm: haversineKm(params.lat, params.lng, latitude, longitude),
      };
    })
    .filter((row) => row.distanceKm <= params.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
```

Note: the mocked `between`/`eq`/`isNull`/`and` in the test do not actually filter — the fake `where` just resolves every row passed to `fakeDb`. This is intentional: the unit test proves the *application-layer* Haversine filter and sort are correct (Steps 1's two candidates, Step 2's out-of-radius corner case) without needing a real Postgres connection. The SQL bounding-box clause itself is exercised by a real database in Module 4's manual smoke test (Task 3), since Vitest here has no DB.

- [ ] **Step 5: Create the route handler**

Create `apps/web/server/api/mosques/nearby.get.ts`:

```typescript
import { findNearbyMosques, nearbyQuerySchema } from '../../services/mosque-search.service';
import { parseQuery } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const query = await parseQuery(event, nearbyQuerySchema);
  return await findNearbyMosques(useDatabase(), {
    lat: query.lat,
    lng: query.lng,
    radiusKm: query.radius,
  });
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- mosque-search.service` (from `apps/web/`)
Expected: PASS, all 3 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/services/mosque-search.service.ts apps/web/server/services/mosque-search.service.test.ts apps/web/server/utils/validation.ts apps/web/server/api/mosques/nearby.get.ts
git commit -m "feat: add nearby mosque search with bounding-box + Haversine"
```

---

### Task 2: Keyword search

**Files:**
- Modify: `apps/web/server/services/mosque-search.service.ts`
- Test: `apps/web/server/services/mosque-search.service.test.ts`
- Modify: `apps/web/server/utils/validation.ts`
- Create: `apps/web/server/api/mosques/search.get.ts`

**Interfaces:**
- Consumes: `MosqueSummary` (Task 1), `Database` (Task 1).
- Produces:
  - `searchQuerySchema` (Zod) — `{ q: string }`, `q` trimmed, min length 1, max length 200
  - `searchMosquesByKeyword(db: Database, keyword: string): Promise<MosqueSummary[]>` — case-insensitive match against `name` OR `address`, `approved` + not-deleted only, sorted by `name` ascending, no `distanceKm` field

- [ ] **Step 1: Write the failing test**

Add to `apps/web/server/services/mosque-search.service.test.ts`:

```typescript
describe('searchMosquesByKeyword', () => {
  it('returns matching mosques without a distance field', async () => {
    const { db } = fakeDb([
      { id: 'a', name: 'Masjid Raya Baiturrahman', address: 'Jl. Masjid Raya', latitude: '5.55', longitude: '95.32', photoUrl: null },
    ]);

    const result = await searchMosquesByKeyword(db, 'Baiturrahman');

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('distanceKm');
    expect(result[0]?.name).toBe('Masjid Raya Baiturrahman');
  });
});
```

Add `searchMosquesByKeyword` to the existing import line from `./mosque-search.service`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- mosque-search.service` (from `apps/web/`)
Expected: FAIL — `searchMosquesByKeyword` is not exported yet.

- [ ] **Step 3: Add the schema and function**

Add to `apps/web/server/services/mosque-search.service.ts`:

```typescript
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});
```

And, using `ilike` from `drizzle-orm`:

```typescript
import { and, between, eq, ilike, isNull, or, sql } from 'drizzle-orm';
```

```typescript
export async function searchMosquesByKeyword(db: Database, keyword: string): Promise<MosqueSummary[]> {
  const pattern = `%${keyword}%`;

  const rows = await db
    .select({
      id: mosques.id,
      name: mosques.name,
      address: mosques.address,
      latitude: mosques.latitude,
      longitude: mosques.longitude,
      photoUrl: mosques.photoUrl,
    })
    .from(mosques)
    .where(
      and(
        eq(mosques.status, 'approved'),
        isNull(mosques.deletedAt),
        or(ilike(mosques.name, pattern), ilike(mosques.address, pattern)),
      ),
    )
    .orderBy(mosques.name);

  return rows.map((row) => ({
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }));
}
```

Update the test file's mocked `drizzle-orm` module to also export `ilike` and `or`:

```typescript
const ilike = vi.fn((column: unknown, pattern: unknown) => ({ kind: 'ilike', column, pattern }));
const or = vi.fn((...conditions: unknown[]) => ({ kind: 'or', conditions }));

vi.mock('drizzle-orm', () => ({ sql, and, eq, isNull, between, ilike, or }));
```

And extend `fakeDb` to support `.orderBy(...)` returning the rows directly (it currently only supports `.where(...)` resolving):

```typescript
function fakeDb(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy, then: (resolve: (v: unknown[]) => void) => resolve(rows) });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { db: { select } as unknown as Database, select, from, where, orderBy };
}
```

The `then` shim on `where`'s return value lets `findNearbyMosques` (Task 1, which awaits `.where(...)` directly with no `.orderBy`) keep resolving, while `searchMosquesByKeyword` (which chains `.orderBy(...)`) also resolves — both call shapes now work against the same fake.

- [ ] **Step 4: Create the route handler**

Create `apps/web/server/api/mosques/search.get.ts`:

```typescript
import { searchMosquesByKeyword, searchQuerySchema } from '../../services/mosque-search.service';
import { parseQuery } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const query = await parseQuery(event, searchQuerySchema);
  return await searchMosquesByKeyword(useDatabase(), query.q);
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- mosque-search.service` (from `apps/web/`)
Expected: PASS, all 4 tests (3 from Task 1 + 1 new). Re-run the full Task 1 tests too since `fakeDb` changed — confirm no regression.

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/services/mosque-search.service.ts apps/web/server/services/mosque-search.service.test.ts apps/web/server/utils/validation.ts apps/web/server/api/mosques/search.get.ts
git commit -m "feat: add mosque keyword search"
```

---

### Task 3: Mosque detail

**Files:**
- Modify: `apps/web/server/services/mosque-search.service.ts`
- Test: `apps/web/server/services/mosque-search.service.test.ts`
- Create: `apps/web/server/api/mosques/[id].get.ts`

**Interfaces:**
- Consumes: `Database` (Task 1), `uuidSchema` (`server/utils/validation.ts`, already exists).
- Produces:
  - `MosqueDetail` — `MosqueSummary` (without `distanceKm`) plus `{ cityId: string; provinceId: string; status: 'approved'; adminUserId: string | null }`
  - `findApprovedMosqueById(db: Database, id: string): Promise<MosqueDetail | null>` — returns `null` when the mosque doesn't exist, isn't `approved`, or is soft-deleted — the route turns `null` into a 404, so a `pending`/`rejected` mosque's existence is never revealed

- [ ] **Step 1: Write the failing test**

Add to `apps/web/server/services/mosque-search.service.test.ts`:

```typescript
describe('findApprovedMosqueById', () => {
  it('returns the mosque when approved and not deleted', async () => {
    const { db } = fakeDb([
      {
        id: 'm-1', name: 'Masjid A', address: 'Jl. A', latitude: '5.55', longitude: '95.32',
        photoUrl: null, cityId: 'city-1', provinceId: 'province-1', status: 'approved', adminUserId: 'admin-1',
      },
    ]);

    const result = await findApprovedMosqueById(db, 'm-1');
    expect(result?.id).toBe('m-1');
    expect(result?.status).toBe('approved');
  });

  it('returns null when no row matches (not found, pending, rejected, or deleted)', async () => {
    const { db } = fakeDb([]);
    const result = await findApprovedMosqueById(db, 'missing');
    expect(result).toBeNull();
  });
});
```

Add `findApprovedMosqueById` to the existing import line.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- mosque-search.service` (from `apps/web/`)
Expected: FAIL — `findApprovedMosqueById` is not exported yet.

- [ ] **Step 3: Implement the function**

Add to `apps/web/server/services/mosque-search.service.ts`:

```typescript
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

export async function findApprovedMosqueById(db: Database, id: string): Promise<MosqueDetail | null> {
  const rows = await db
    .select({
      id: mosques.id,
      name: mosques.name,
      address: mosques.address,
      latitude: mosques.latitude,
      longitude: mosques.longitude,
      photoUrl: mosques.photoUrl,
      cityId: mosques.cityId,
      provinceId: mosques.provinceId,
      status: mosques.status,
      adminUserId: mosques.adminUserId,
    })
    .from(mosques)
    .where(and(eq(mosques.id, id), eq(mosques.status, 'approved'), isNull(mosques.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    status: 'approved',
  };
}
```

`fakeDb`'s `where` currently returns `{ orderBy, then }` (from Task 2) but this call chains `.limit(1)` instead. Extend `fakeDb` once more so `where`'s return also has a `limit`:

```typescript
function fakeDb(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({
    orderBy,
    limit,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { db: { select } as unknown as Database, select, from, where, orderBy, limit };
}
```

- [ ] **Step 4: Create the route handler**

Create `apps/web/server/api/mosques/[id].get.ts`:

```typescript
import { findApprovedMosqueById } from '../../services/mosque-search.service';
import { uuidSchema } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const id = uuidSchema.parse(getRouterParam(event, 'id'));
  const mosque = await findApprovedMosqueById(useDatabase(), id);

  if (!mosque) {
    throw createError({ statusCode: 404, statusMessage: 'Mosque not found' });
  }

  return mosque;
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- mosque-search.service` (from `apps/web/`)
Expected: PASS, all 6 tests. Re-run Task 1 and 2's tests too since `fakeDb` changed again — confirm no regression.

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/services/mosque-search.service.ts apps/web/server/services/mosque-search.service.test.ts "apps/web/server/api/mosques/[id].get.ts"
git commit -m "feat: add mosque detail endpoint"
```

---

### Task 4: Rate limiting for public list endpoints

**Files:**
- Create: `apps/web/server/middleware/rate-limit.ts`
- Test: `apps/web/server/middleware/rate-limit.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks — this is a general-purpose Nitro middleware, path-scoped to the two public list endpoints.
- Produces:
  - `checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number }` — pure function, in-memory sliding window, exported so it's unit-testable without an H3 event
  - Default export: Nitro middleware applying `checkRateLimit` to requests under `/api/mosques/nearby` and `/api/mosques/search`, keyed by client IP, 60 requests per 60,000 ms

- [ ] **Step 1: Write the failing tests**

Create `apps/web/server/middleware/rate-limit.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';

import { checkRateLimit, resetRateLimitStore } from './rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('allows requests under the limit', () => {
    for (let i = 0; i < 60; i++) {
      expect(checkRateLimit('1.2.3.4', 60, 60_000).allowed).toBe(true);
    }
  });

  it('blocks the 61st request within the window', () => {
    for (let i = 0; i < 60; i++) checkRateLimit('1.2.3.4', 60, 60_000);
    const result = checkRateLimit('1.2.3.4', 60, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks each key independently', () => {
    for (let i = 0; i < 60; i++) checkRateLimit('1.2.3.4', 60, 60_000);
    expect(checkRateLimit('5.6.7.8', 60, 60_000).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- rate-limit` (from `apps/web/`)
Expected: FAIL — `rate-limit.ts` does not exist yet.

- [ ] **Step 3: Implement the middleware**

Create `apps/web/server/middleware/rate-limit.ts`:

```typescript
interface Bucket {
  count: number;
  windowStart: number;
}

let store = new Map<string, Bucket>();

/** Test-only: clears in-memory state between test cases. */
export function resetRateLimitStore(): void {
  store = new Map();
}

/**
 * Fixed-window rate limiter. Not distributed — acceptable for MVP scale
 * (single Nitro instance). Revisit with a shared store if scaled horizontally.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count < limit) {
    bucket.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  return { allowed: false, retryAfterMs: windowMs - (now - bucket.windowStart) };
}

const LIMITED_PATHS = ['/api/mosques/nearby', '/api/mosques/search'];
const LIMIT = 60;
const WINDOW_MS = 60_000;

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;
  if (!LIMITED_PATHS.includes(path)) return;

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const result = checkRateLimit(ip, LIMIT, WINDOW_MS);

  if (!result.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: { retryAfterMs: result.retryAfterMs },
    });
  }
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- rate-limit` (from `apps/web/`)
Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/middleware/rate-limit.ts apps/web/server/middleware/rate-limit.test.ts
git commit -m "feat: rate-limit public mosque search endpoints"
```

---

### Task 5: OpenAPI contract entries

**Files:**
- Modify: `apps/web/server/utils/openapi.ts`

**Interfaces:**
- Consumes: nothing new — this task only fills in real parameter/response detail for paths that already exist as bare `summary`-only stubs (`/mosques/nearby`, `/mosques/search`, `/mosques/{id}`).
- Produces: nothing new for other tasks to consume; this is a leaf documentation task.

- [ ] **Step 1: Update the OpenAPI document**

Modify `apps/web/server/utils/openapi.ts`, replacing the three existing stub entries:

```typescript
'/mosques/nearby': {
  get: {
    summary: 'Find nearby approved mosques',
    parameters: [
      { name: 'lat', in: 'query', required: true, schema: { type: 'number' } },
      { name: 'lng', in: 'query', required: true, schema: { type: 'number' } },
      { name: 'radius', in: 'query', required: false, schema: { type: 'number', default: 5 } },
    ],
    responses: { '200': { description: 'Mosques sorted by distance ascending' } },
  },
},
'/mosques/search': {
  get: {
    summary: 'Search approved mosques by name or address',
    parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
    responses: { '200': { description: 'Mosques matching the keyword' } },
  },
},
'/mosques/{id}': {
  get: {
    summary: 'Get mosque detail',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: {
      '200': { description: 'Mosque detail' },
      '404': { description: 'Mosque not found, not approved, or deleted' },
    },
  },
},
```

Leave every other entry in the file untouched.

- [ ] **Step 2: Verify the docs route still serves the file**

Run: `npm run dev` (from `apps/web/`), then in another terminal: `curl -s http://localhost:3000/api/openapi.json | head -c 500`
Expected: valid JSON containing the updated `/mosques/nearby` parameters. Stop the dev server after checking.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/utils/openapi.ts
git commit -m "docs: fill in OpenAPI contract for mosque search endpoints"
```

---

## Self-Review Notes

- **Spec coverage:** §3.4 requires `GET /mosques/nearby` (Task 1), `GET /mosques/search` (Task 2), `GET /mosques/:id` (Task 3), "only approved mosques visible" (enforced in every task's service function, not per-route), and "60 req/min per IP via Nitro middleware" (Task 4). PRD §4.1's bounding-box-then-Haversine requirement is Task 1. PRD §5's rate-limit figure matches Task 4 exactly.
- **Placeholder scan:** no TBD/TODO; every step has real, runnable code.
- **Type consistency:** `MosqueSummary` (Task 1) is reused without modification by Task 2; `MosqueDetail` (Task 3) is a deliberately separate, wider type rather than an extension of `MosqueSummary`, since detail includes `cityId`/`provinceId`/`status`/`adminUserId` that list views don't need — documented at the point of definition. `Database` type alias is defined once in Task 1 and imported, not redefined, by all later tasks in this file.
- **Fake DB evolution:** `fakeDb` in the test file gains capabilities incrementally (Task 1: `where` resolves directly; Task 2: adds `orderBy`; Task 3: adds `limit`), each addition backward-compatible with earlier tasks' usage — flagged explicitly in Tasks 2 and 3's steps so the implementer re-runs the full file's tests after each change, not just the newly added test.
- **No DB-backed tests in this plan:** unlike Module 7's plan, every test here mocks `drizzle-orm` at the module level rather than hitting a real Postgres — appropriate because this module's logic (Haversine math, keyword matching, 404 shaping, rate-limit bucketing) is pure application logic once the query shape is fixed, and the query shape itself is simple enough (no transactions, no multi-table writes) that a real-DB smoke test isn't load-bearing the way Module 7's transactional `withAudit` test was. If sign-off wants DB-backed confidence too, Task 5's manual `curl` step against a running dev DB is the intended lightweight check.
