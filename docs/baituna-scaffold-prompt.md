# Prompt untuk Agentic Code — Scaffold Baituna MVP

Copy-paste seluruh isi di bawah ini sebagai prompt awal ke Agentic Code, di root folder kosong tempat repo Baituna akan dibuat. Taruh `baituna-prd.md` dan `baituna-erd.md` di root folder yang sama sebelum mulai.

---

## Konteks

Kamu akan scaffold **Baituna**, platform open source manajemen masjid (MVP). Baca dulu dua dokumen ini secara penuh sebelum melakukan apapun:

- `baituna-prd.md` — requirement produk, user stories, RBAC, endpoint API
- `baituna-erd.md` — skema database, base audit fields pattern, keputusan desain final

Semua keputusan arsitektur di kedua dokumen itu **final** — jangan diinterpretasi ulang atau diganti tanpa konfirmasi eksplisit ke saya.

## Scope Task Ini: SCAFFOLDING SAJA

Task ini adalah membangun **fondasi/struktur project**, bukan implementasi penuh semua business logic. Target keluaran:

1. **Struktur monorepo**: `apps/web`, `apps/mobile`, `packages/shared`, `docs`, `docker`, `.github`
2. **apps/web** — inisialisasi Nuxt 4 + Nitro server API + TypeScript, dengan:
   - Drizzle ORM terhubung ke PostgreSQL, `apps/web/drizzle/schema.ts` berisi **semua entitas** dari `baituna-erd.md` §6.1 (Province, City, Mukim, User, Mosque, Person, FridayAssignment) + entitas **AuditLog** dari §6.0, termasuk field base audit (`created_at`, `created_by`, `modified_at`, `modified_by`, `deleted_at`, `deleted_by`, `history` JSONB). Kolom `active` (generated column `deleted_at IS NULL`) harus ditetapkan lewat migration SQL Drizzle agar ekspresinya tetap dikelola PostgreSQL.
   - Setup Zod untuk validasi request
   - Setup JWT auth skeleton (belum perlu semua endpoint jadi, cukup middleware auth + struktur folder untuk service layer)
   - Setup OpenAPI/Swagger skeleton
   - Buat struktur folder untuk service layer yang jelas terpisah dari route handler (supaya nanti gampang ditambahkan logic diff-based history di application layer sesuai catatan di `baituna-erd.md` §6.0)
3. **apps/mobile** — inisialisasi project Flutter dengan Provider (state management — **jangan** pakai Riverpod/Bloc/GetX), Dio, Go Router, Hive, flutter_secure_storage. Struktur folder standar (screens, providers, services, models). Belum perlu UI jadi, cukup skeleton + 1 contoh screen kosong untuk memastikan setup jalan.
4. **packages/shared** — struktur untuk tipe/kontrak yang dipakai bareng web & mobile (misal hasil generate dari OpenAPI spec)
5. **docker/** — docker-compose untuk PostgreSQL lokal + service web, siap `docker compose up` untuk dev
6. **.github/** — GitHub Actions CI skeleton (lint + build check minimal, belum perlu deploy), template issue & PR
7. Root: `LICENSE` (Apache-2.0), `README.md` (ringkas: apa itu Baituna, cara jalankan lokal, struktur folder), `.editorconfig`, conventional commit setup (commitlint/husky kalau relevan)

## Batasan Keras — Jangan Lakukan Ini

- **Jangan** implementasi business logic penuh (approval flow, role upgrade, Haversine search, dll.) — itu task terpisah setelah scaffolding ini selesai
- **Jangan** menambahkan fitur/entitas di luar yang tercantum di `baituna-erd.md` — kalau menurutmu ada yang kurang, laporkan ke saya, jangan langsung ditambahkan sendiri
- **Jangan** ubah keputusan yang sudah final (contoh: RBAC 3 role, UUID sebagai PK, Haversine+bounding box bukan PostGIS, Provider bukan Riverpod) — kalau ada alasan teknis kuat untuk beda pendapat, stop dan tanya saya dulu, jangan langsung eksekusi versi kamu

## Sebelum Mulai

Tampilkan dulu rencana singkat (struktur folder yang akan dibuat + urutan langkah), tunggu saya konfirmasi, baru eksekusi.
