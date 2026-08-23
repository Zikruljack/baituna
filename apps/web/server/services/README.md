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

## Module 2 — Region Reference

`region.service.ts` is the read-only boundary for public Province and City
queries. It filters soft-deleted rows, scopes Cities to their Province, and
sorts names alphabetically. Reference data is seeded with `npm run
db:seed:regions`; the seed is idempotent and restores canonical Aceh rows that
were soft-deleted. It never reads or writes Mukim data.
