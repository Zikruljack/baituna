# Architecture

Baituna is a monorepo with a Nuxt 4 web application, Nitro API, PostgreSQL via
Drizzle ORM, and a Flutter mobile client. Both clients consume the same OpenAPI API
contract. The current repository is a scaffold: routes and service boundaries
exist, while MVP business workflows are intentionally deferred.

## Web API boundaries

Nitro handlers own HTTP concerns only. Zod validates request data and services
will own business rules, Drizzle access, authorization decisions, and audit
history extensions. Public search endpoints are designated for a future
60-requests-per-minute IP rate limiter.

## Persistence

Every model includes soft-delete and audit fields. `active` is a PostgreSQL
stored generated column based on `deleted_at`; its SQL lives in the initial
Drizzle migration so PostgreSQL remains the source of truth for that expression.

## Mobile

The Flutter skeleton uses Provider for state, Dio for HTTP, Go Router for
navigation, Hive for cached search data, and flutter_secure_storage for tokens.
