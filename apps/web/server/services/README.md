# Service layer

Route handlers should only parse HTTP input, call a service, and serialize the
result. Business rules, authorization decisions, and Drizzle operations belong in
services. This boundary is intentionally reserved for the future diff-based
audit-history implementation described in `docs/baituna-erd.md`.

The MVP workflows themselves are not implemented in this scaffold.
