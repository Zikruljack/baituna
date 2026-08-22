# Baituna

Baituna is an Apache-2.0 open-source platform for mosque management and community
engagement. The MVP focuses on finding nearby mosques and publishing Friday
Khatib, Imam, and Muazzin assignments. The web backend uses Drizzle ORM with
PostgreSQL.

## Getting started

Prerequisites: Node.js 24+, npm 11+, Docker Compose, and Flutter (for the mobile
application).

```bash
cp apps/web/.env.example apps/web/.env
npm install
docker compose -f docker/docker-compose.yml up --build
```

The web application runs on `http://localhost:3000`; PostgreSQL is published on
`localhost:5432`. For application-only development, start PostgreSQL with Docker
then run `npm run dev` in another terminal.

To prepare the Flutter app:

```bash
cd apps/mobile
flutter pub get
flutter run
```

## Repository layout

```text
apps/web          Nuxt 4 application and Nitro API
apps/mobile       Flutter client
packages/shared   Shared API contracts and generated-code destination
docker            Local development containers
docs              Product and architecture documents
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the mandatory
[branch workflow](docs/BRANCHING.md). Every Issue is developed on a
`feature/**` branch and submitted to `dev` through a pull request. Follow
Conventional Commits and use the included issue and pull-request templates.
Security issues must be reported according to [SECURITY.md](SECURITY.md), not
filed as public issues.

## License

Licensed under the [Apache License 2.0](LICENSE).
