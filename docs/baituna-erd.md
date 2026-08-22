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
- password_hash
- role (enum: super_admin, mosque_admin, public_user)
- created_at, updated_at, deleted_at

**Mukim** _(unit administratif khas Aceh, di antara City dan Mosque — untuk filter/browse tanpa bergantung GPS)_

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
- mukim_id (FK → Mukim, nullable — opsional, diisi kalau data mukim tersedia)
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
City     (1) ──< (N) Mukim
City     (1) ──< (N) Mosque
Province (1) ──< (N) Mosque
Mukim    (1) ──< (N) Mosque        [nullable]
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
- **Unit administratif**: tambah entitas **Mukim** (antara City dan Mosque, opsional/nullable) untuk mengakomodasi konteks Aceh; pencarian tetap coordinate-primary, Mukim untuk filter/browse fallback
- **Timezone "Jumat ini"**: Asia/Jakarta (WIB), transisi tengah malam WIB; endpoint `current` mengembalikan `has_assignment: false` kalau belum ada entri
- **Khatib/Imam/Muazzin di FridayAssignment**: ketiganya nullable, tidak wajib diisi lengkap tiap minggu
- **Rate limiting**: 60 req/menit per IP untuk endpoint publik tanpa auth
- **Testing baseline**: unit test wajib untuk service layer kritis, e2e test minimal untuk 2 flow inti

---

Skema ini final untuk MVP. Requirement produk & endpoint API: lihat `baituna-prd.md`.
