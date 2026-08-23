# Service layer

Route handlers should only parse HTTP input, call a service, and serialize the
result. Business rules, authorization decisions, and Drizzle operations belong in
services. This boundary is intentionally reserved for the future diff-based
audit-history implementation described in `docs/baituna-erd.md`.

The MVP workflows themselves are not implemented in this scaffold.

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

## Module 7 — Audit Log

`audit.service.ts` is not a route module. It exposes `withAudit`, called
from inside another service's own `db.transaction()` block, right after
the business write it audits:

```typescript
await db.transaction(async (tx) => {
  const [inserted] = await tx.insert(someTable).values({ ... }).returning();
  if (!inserted) throw new Error('...');

  await withAudit(tx, {
    table: someTable,
    tableName: 'some_table_name', // must match the Postgres table name
    recordId: inserted.id,
    action: 'CREATE', // or 'UPDATE' / 'DELETE'
    actorId, // the caller's user id, or null for system writes
    oldData: null, // the row's prior field values, or null on CREATE
    newData: { ... }, // only the fields relevant to this change
    currentHistory: inserted.history as unknown[],
  });

  return inserted;
});
```

Rules:

- `DELETE` in this system is always a soft delete (`UPDATE ... SET
  deleted_at = now()`), never `DELETE FROM`. Pass `action: 'DELETE'` and
  `newData: null` for it, matching `createMosque` in `mosque.service.ts`
  for the `CREATE` shape.
- `oldData`/`newData` don't need every column — only the fields worth
  showing in a history diff (skip audit columns like `modifiedAt`).
- Raw queries that bypass a service never get audited. This is an
  accepted trade-off (ERD §6.0), not a bug to work around.

See `mosque.service.ts` `createMosque` for a complete worked example.

## Module 2 — Region Reference

`region.service.ts` is the read-only boundary for public Province and City
queries. It filters soft-deleted rows, scopes Cities to their Province, and
sorts names alphabetically. Reference data is seeded with `npm run
db:seed:regions`; the seed is idempotent and restores canonical Aceh rows that
were soft-deleted. It never reads or writes Mukim data.
