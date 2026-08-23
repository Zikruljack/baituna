# Module 2: Region Reference Implementation Plan

> **For agentic workers:** Execute tasks in order. Do not build web or Flutter UI. Mark a checkbox only after the stated verification passes.

**Goal:** Provide immutable, public Province/City reference data for Aceh so Mosque Registration can validate that an active City belongs to an active Province.

**Architecture:** PostgreSQL and Drizzle stay the source of truth. A generated migration adds Region uniqueness constraints. A static TypeScript dataset feeds an idempotent transaction-based seed script. Nitro handlers under `server/api/provinces/` remain thin; `region.service.ts` owns active-row queries.

**Tech stack:** Nuxt 4 / Nitro, TypeScript strict, Drizzle ORM + PostgreSQL, Zod 4, Vitest 4, Node 24 native TypeScript execution.

**Spec:** `docs/superpowers/specs/2026-08-23-module-2-region-reference.md`. Background: `docs/baituna-prd.md` §3/§6, `docs/baituna-erd.md` §6.1–§6.3, and Module 1 Auth/RBAC.

## Global Constraints

- Do not add a role, Region write endpoint, UI, mobile code, or entity.
- Do not touch `mukims` or `mosques.mukim_id`.
- Read queries filter `isNull(table.deletedAt)`; `active` is generated and never written.
- Route handlers parse input, call a service, and shape HTTP responses only.
- TypeScript stays strict: no `any` and no unsafe non-null assertion.
- Generate migrations with `npm run db:generate`; never hand-write a migration.
- Commands run from `apps/web/`, except stated Docker commands.
- Do not commit unless separately authorized.

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `drizzle/schema.ts` | Region unique constraints | 1 |
| `drizzle/0002_*.sql` + `drizzle/meta/` | Generated migration | 1 |
| `scripts/data/aceh-regions.ts` | Canonical Aceh dataset | 2 |
| `scripts/data/aceh-regions.test.ts` | Dataset guardrail | 2 |
| `scripts/seed-regions.ts` | Idempotent transaction seed | 3 |
| `package.json` | `db:seed:regions` script | 3 |
| `server/services/region.service.ts` | Active Region queries | 4 |
| `server/services/region.service.test.ts` | Service unit tests | 4 |
| `server/api/provinces/index.get.ts` | List provinces route | 5 |
| `server/api/provinces/[id]/cities.get.ts` | List cities route | 5 |
| `server/utils/openapi.ts` | API contract entries | 6 |
| `server/services/README.md` | Service boundary documentation | 6 |
| `../docs/superpowers/plans/README.md` | Plan status after completion | 7 |

## Task 1: Add Region uniqueness constraints and migration

- [x] Make `provinces.name` unique in `drizzle/schema.ts`.
- [x] Change `cities` to callback `pgTable` form and add a named unique constraint on `(provinceId, name)`. Preserve its FK and audit fields.
- [x] Run `npm run db:generate`.
- [x] Inspect `0002_*.sql`. It may add only the two Region unique constraints. Stop if it drops a table, column, FK, enum, index, or generated column.
- [x] With Docker PostgreSQL healthy, run `npm run db:migrate`.
- [x] Query `pg_constraint` and `pg_get_constraintdef` to verify both constraints.

Expected: duplicate Province names and duplicate City names within one Province are rejected by PostgreSQL; existing data remains intact.

## Task 2: Define and test the Aceh dataset

- [x] Create `scripts/data/aceh-regions.test.ts` first.
- [x] Assert exactly 23 unique names; assert the five cities `Banda Aceh`, `Langsa`, `Lhokseumawe`, `Sabang`, and `Subulussalam` are present.
- [x] Run `npm test -- aceh-regions` and confirm the expected missing-module failure.
- [x] Create `scripts/data/aceh-regions.ts`, exporting `ACEH_PROVINCE = 'Aceh'` and the 23 canonical names from the spec as a readonly array.
- [x] Run `npm test -- aceh-regions` and confirm it passes.

Expected: count and spelling cannot silently drift. API sorting remains service responsibility, not dataset ordering.

## Task 3: Add an idempotent Region seed script

- [x] Create `scripts/seed-regions.ts` using `Pool`, `drizzle`, schema, and the canonical dataset. Relative imports must end in `.ts` for Node 24 native execution.
- [x] Fail clearly before opening a pool when `DATABASE_URL` is absent.
- [x] In `db.transaction`, insert or restore Province Aceh, then insert or restore every City with the constraints from Task 1 as conflict targets.
- [x] Update only canonical reference fields and audit timestamps. Do not delete rows, write `active`, or create Mukim rows.
- [x] Report created, updated, and restored counts without printing secrets.
- [x] Add `"db:seed:regions": "node --env-file=.env scripts/seed-regions.ts"` to `package.json`.
- [x] Run the seed twice against Docker PostgreSQL. Verify first-run and second-run counts are 1 active Province and 23 active City, with stable IDs.

Expected: a fresh environment and a redeployment receive complete reference data without destructive reset.

## Task 4: Build and test the Region service

- [x] Create `server/services/region.service.test.ts` first. Use a minimal typed fake Drizzle client, as in `user.service.test.ts`; no live database is required.
- [x] Test `listActiveProvinces`, `findActiveProvince`, and `listActiveCities` return selected public fields and use active/scoped/sorted query chains.
- [x] Run `npm test -- region.service` and confirm the expected missing-module failure.
- [x] Implement `server/services/region.service.ts` with `asc`, `eq`, and `isNull`.
- [x] Export `RegionDatabase`, `RegionOption`, `CityOption`, `listActiveProvinces`, `findActiveProvince`, and `listActiveCities` as defined in the spec.
- [x] Run `npm test -- region.service` and confirm it passes.

Expected: Region data access and active-row rules have one reusable, testable home.

## Task 5: Add public Nitro endpoints

- [x] Create `server/api/provinces/index.get.ts`; call `listActiveProvinces` and return `{ data }`.
- [x] Create `server/api/provinces/[id]/cities.get.ts`; validate `id` through the shared UUID schema, map absent/soft-deleted Province to `404 Province not found`, then return `{ data }` from `listActiveCities`.
- [x] Keep `createError` and parameter parsing in routes, but do not duplicate database queries, active checks, or sorting.
- [x] Start Nuxt with Docker PostgreSQL and smoke-test the success, valid-missing UUID, and malformed UUID cases in the spec.

Expected: clients receive a stable public API before Registration consumes Region data.

## Task 6: Publish contract and documentation

- [x] Add `/provinces` and `/provinces/{id}/cities` to `server/utils/openapi.ts`, including public access, UUID parameter, and `200`/`400`/`404` behavior.
- [x] Add Module 2 notes to `server/services/README.md`: read-only Region service, `db:seed:regions`, soft-delete filtering, and no Mukim use.
- [x] Inspect `/api/openapi.json` and confirm both paths exist.

## Task 7: Final verification and handoff

- [x] Run `npm test`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `git diff --check`.
- [x] Re-run `npm run db:migrate` and `npm run db:seed:regions`; record their idempotence.
- [x] Update the Module 2 status in `docs/superpowers/plans/README.md` to `complete` only after every check above passes.

## Definition of Done

- One active Province (`Aceh`) and 23 active City rows exist after any number of seed runs.
- PostgreSQL protects the required Region uniqueness.
- Public endpoints obey documented data, order, and error contracts.
- No Mukim, UI, mobile, registration, search, audit, or role behavior is added.
- Tests, typecheck, lint, migration, seed idempotence, OpenAPI inspection, and diff check pass.
