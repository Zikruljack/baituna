# Baituna — ERD (MVP)

> Requirement produk, user stories, dan endpoint API ada di dokumen terpisah: `baituna-prd.md`

## 6.0 Base Audit Fields (Standar Semua Tabel)

Diadaptasi dari pola BaseModel (PHP/CodeIgniter) yang sudah dipakai user di project lain, ditranslate ke idiom Postgres. Field berikut berlaku di **semua entitas** di bawah, menggantikan penyebutan generik `created_at, updated_at, deleted_at` di setiap entitas:

- `id` — UUID, PK (tetap UUID sesuai keputusan MVP, bukan bigint auto-increment)
- `created_at` — TIMESTAMPTZ
- `created_by` — FK ke User (atau text nama, tergantung kebutuhan)
- `modified_at` — TIMESTAMPTZ
- `modified_by` — FK ke User / text
- `deleted_at` — TIMESTAMPTZ (soft delete)
- `deleted_by` — FK ke User / text
- `active` — BOOLEAN, generated column: `GENERATED ALWAYS AS (deleted_at IS NULL) STORED`
- `history` — JSONB, default `'[]'::jsonb`; append-only log perubahan per baris (diisi oleh app-layer atau trigger, lihat catatan implementasi)

**Catatan implementasi (penting, bukan otomatis dari schema):**

- Drizzle tidak memiliki inheritance/mixin model; base audit fields didefinisikan secara konsisten untuk setiap tabel di `apps/web/drizzle/schema.ts`
- Kolom `active` (STORED generated column) tetap didefinisikan melalui migrasi SQL Drizzle agar PostgreSQL menjadi source of truth untuk ekspresi `deleted_at IS NULL`
- Logic diff-based `history` (yang di PHP dilakukan di `upsert()`) tidak otomatis ada di Postgres — perlu direplikasi di service/application layer atau melalui **Postgres trigger function** (DB-layer, tidak bisa dilewati raw query, tapi logic diff lebih rumit ditulis di SQL)
- Central audit log (equivalent `app_activity`): entitas baru **AuditLog** — `id (UUID)`, `table_name`, `record_id`, `action (CREATE/UPDATE/DELETE)`, `old_data (JSONB)`, `new_data (JSONB)`, `actor_id (FK User)`, `created_at`

## 6.1 Daftar Entitas

**Province**

- id (UUID, PK)
- name
- created_at, updated_at, deleted_at

**City**

- id (UUID, PK)
- province_id (FK → Province)
- name
- created_at, updated_at, deleted_at

**User**

- id (UUID, PK)
- name
- email (unique)
- password_hash (**nullable** — NULL untuk user yang masuk lewat OAuth)
- provider (enum: `local`, `google` — default `local`)
- provider_id (text, nullable — subject ID dari provider OAuth)
- role (enum: super_admin, mosque_admin, public_user)
- created_at, updated_at, deleted_at
- **Constraint**: unique (provider, provider_id) — mencegah satu akun Google terhubung ke dua user

_Catatan: `provider`/`provider_id` dan `password_hash` nullable ditambahkan setelah ERD awal, sebagai konsekuensi keputusan autentikasi di §6.3. Alasan lengkap ada di `docs/superpowers/specs/2026-08-23-baituna-modules-design.md` §2.1._

**Mukim** _(unit administratif khas Aceh, di antara City dan Mosque)_

> **STATUS: TIDAK DIPAKAI DI MVP.** Tabel ini dan kolom `Mosque.mukim_id` tetap ada di schema (selalu NULL), tapi tidak ada endpoint, seed data, filter, maupun UI yang menyentuhnya. Dipertahankan agar bisa dipakai tanpa migrasi ulang kalau nanti dibutuhkan. Jangan bangun fitur di atasnya tanpa konfirmasi eksplisit. Lihat design doc §2.3.

- id (UUID, PK)
- city_id (FK → City)
- name
- created_at, updated_at, deleted_at

**Mosque**

- id (UUID, PK)
- name
- address
- latitude, longitude
- city_id (FK → City)
- province_id (FK → Province)
- mukim_id (FK → Mukim, nullable — **selalu NULL di MVP**, lihat catatan entitas Mukim)
- status (enum: pending, approved, rejected — default pending)
- admin_user_id (FK → User, nullable — mosque admin penanggung jawab)
- photo_url (nullable)
- created_at, updated_at, deleted_at

**Person** _(entitas master untuk Khatib/Imam/Muazzin — final, bukan text field bebas)_

- id (UUID, PK)
- mosque_id (FK → Mosque)
- name
- phone (nullable)
- created_at, updated_at, deleted_at

**FridayAssignment**

- id (UUID, PK)
- mosque_id (FK → Mosque)
- assignment_date (date — tanggal Jumat spesifik)
- khatib_person_id (FK → Person, nullable)
- imam_person_id (FK → Person, nullable)
- muazzin_person_id (FK → Person, nullable)
- created_by (FK → User)
- created_at, updated_at, deleted_at
- **Constraint**: unique (mosque_id, assignment_date) — satu masjid hanya satu entri per tanggal Jumat; entri lama tidak boleh diedit setelah tanggalnya lewat (ditegakkan di application layer, bukan DB constraint). Ketiga peran nullable karena tidak semua masjid mencatat ketiganya formal tiap minggu (mis. imam merangkap khatib, muazzin tidak dicatat)

## 6.2 Relasi

```
Province (1) ──< (N) City
City     (1) ──< (N) Mukim         [tidak dipakai di MVP]
City     (1) ──< (N) Mosque
Province (1) ──< (N) Mosque
Mukim    (1) ──< (N) Mosque        [nullable, selalu NULL di MVP]
Mosque   (N) ──> (1) User          [admin_user_id, nullable]
Mosque   (1) ──< (N) Person
Mosque   (1) ──< (N) FridayAssignment
Person   (1) ──< (N) FridayAssignment  [sebagai khatib/imam/muazzin, opsional]
User     (1) ──< (N) FridayAssignment  [created_by]
```

## 6.3 Keputusan Desain — Final

- **Khatib/Imam/Muazzin**: entitas **Person** tersendiri, reusable per masjid, bisa dilihat histori penugasan per orang
- **Pencarian jarak**: Haversine + bounding box pre-filter (lat/lng ter-index). PostGIS ditunda sampai skala jadi nasional atau butuh fitur geospasial lanjutan (polygon wilayah, dll.)
- **RBAC MVP**: 3 peran saja — Super Admin, Mosque Admin, Public User. Province Admin/City Admin ditunda ke fase berikutnya
- **Pengisian data masjid**: self-registration terbuka untuk **user manapun yang login** (bukan cuma Mosque Admin) + approval Super Admin, dengan soft duplicate check (nama mirip + jarak <100m)
- **Role upgrade**: registrasi masjid adalah satu-satunya jalur untuk dapat role `mosque_admin` — otomatis upgrade saat masjid di-approve, `admin_user_id` di-set ke pendaftar
- **Unit administratif**: entitas **Mukim** ada di schema tapi **tidak dipakai di MVP** (revisi 2026-08-23) — tabel dan kolom `Mosque.mukim_id` dipertahankan agar bisa diaktifkan tanpa migrasi ulang, tapi tidak diseed dan tidak disentuh aplikasi. Pencarian sepenuhnya coordinate-primary
- **Autentikasi** (ditambahkan 2026-08-23): Public User masuk lewat **Google OAuth**; Super Admin dibuat lewat seed script dengan email/password. Tidak ada registrasi email/password untuk publik. Konsekuensi pada tabel User: `password_hash` jadi nullable, tambah kolom `provider` dan `provider_id`
- **Master Khatib/Imam/Muazzin** (ditambahkan 2026-08-23): Person dikelola lewat **CRUD penuh** di `/mosques/:id/people`; endpoint FridayAssignment hanya menerima `person_id` (bukan nama bebas) dan memvalidasi Person milik masjid yang sama. Soft delete, agar assignment lama tetap terbaca
- **Notifikasi status masjid** (ditambahkan 2026-08-23): tidak ada entitas Notification. Pendaftar melihat status lewat `GET /mosques/my-submissions`, memanfaatkan `Mosque.status` yang sudah ada
- **Kepemilikan masjid**: satu user boleh mendaftarkan lebih dari satu masjid. Kepemilikan ditentukan `Mosque.admin_user_id` per masjid, **bukan** oleh role — semua guard "masjid miliknya" harus mengecek `admin_user_id`, tidak cukup mengecek role
- **Timezone "Jumat ini"**: Asia/Jakarta (WIB), transisi tengah malam WIB; endpoint `current` mengembalikan `has_assignment: false` kalau belum ada entri
- **Khatib/Imam/Muazzin di FridayAssignment**: ketiganya nullable, tidak wajib diisi lengkap tiap minggu
- **Rate limiting**: 60 req/menit per IP untuk endpoint publik tanpa auth
- **Testing baseline**: unit test wajib untuk service layer kritis, e2e test minimal untuk 2 flow inti

---

## 6.4 Riwayat Revisi

| Tanggal | Perubahan |
| --- | --- |
| — | Versi awal, disusun sebagai input scaffolding |
| 2026-08-23 | User: `password_hash` nullable + kolom `provider`/`provider_id` (Google OAuth). Mukim: ditandai tidak dipakai di MVP. §6.3: tambah keputusan autentikasi, CRUD Person, notifikasi via `my-submissions`, dan aturan kepemilikan masjid |

---

Skema ini final untuk MVP. Requirement produk & endpoint API: lihat `baituna-prd.md`. Pemecahan modul, alasan di balik keputusan §6.3, dan daftar endpoint lengkap (termasuk yang di luar PRD §6): lihat `superpowers/specs/2026-08-23-baituna-modules-design.md`.
