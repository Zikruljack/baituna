# Baituna — Modul 3: Mosque Registration & Approval (Backend)

Tanggal: 2026-08-23
Status: siap diimplementasikan
Scope: siklus hidup pendaftaran masjid dari submit sampai approve/reject, self-edit setelah disetujui, dan tracking status pendaftaran sendiri. Tidak mencakup web atau Flutter.

Dokumen ini menjabarkan `docs/superpowers/specs/2026-08-23-baituna-modules-design.md` §2.1 (konsekuensi kepemilikan) dan §3.3 menjadi kontrak yang detail dan siap diimplementasikan. Keputusan bersama lintas modul (peran, aturan kepemilikan per-mosque, soft delete) ada di dokumen itu dan di `baituna-erd.md`/`baituna-prd.md`; dokumen ini hanya menambah detail spesifik Modul 3.

## Tujuan

Any authenticated user mendaftarkan masjid → Super Admin approve/reject → pendaftar yang di-approve otomatis jadi Mosque Admin masjid tersebut dan bisa mengedit datanya → siapapun bisa melihat status pendaftaran miliknya sendiri.

## Batasan

Termasuk:

- `POST /mosques` — submit, status awal `pending`, peringatan duplikat.
- `GET /mosques/pending` — daftar untuk Super Admin.
- `PATCH /mosques/:id/approve` — approve + assign ownership + upgrade role, satu transaksi.
- `PATCH /mosques/:id/reject` — reject, role pendaftar tidak berubah.
- `PATCH /mosques/:id` — self-edit oleh pemilik, hanya setelah `approved`.
- `GET /mosques/my-submissions` — daftar pendaftaran milik user yang login beserta statusnya.
- Deteksi duplikat fuzzy (nama mirip + jarak < 100m) sebagai peringatan, bukan blokir.

Tidak termasuk:

- Entitas Notification. §2.5 spec menetapkan `GET /mosques/my-submissions` sebagai pengganti notifikasi in-app — tidak ada tabel atau kolom baru.
- Validasi bahwa `cityId`/`provinceId` yang dikirim aktif dan saling terkait secara ketat lewat kode Modul 2 — plan ini hanya membutuhkan tabel `provinces`/`cities` ada di schema (sudah ada), bukan implementasi service Modul 2 selesai. Validasi FK-level (constraint database) sudah cukup untuk MVP; validasi bisnis "City ini benar-benar milik Province ini" adalah peningkatan yang bisa menyusul, tidak diblokir plan ini.
- Endpoint baca publik (`nearby`, `search`, detail) — itu Modul 4.

## Kontrak Data dan Aturan

**Kepemilikan per-mosque, bukan per-role.** Setiap pengecekan "ini masjid saya" wajib membandingkan `mosques.admin_user_id` dengan id pemanggil — pakai `requireMosqueOwner` (Modul 1), bukan `role === 'mosque_admin'` saja. Satu user boleh memiliki lebih dari satu masjid; approve masjid kedua untuk user yang sudah `mosque_admin` tidak boleh mengubah role atau gagal.

**Approve adalah satu transaksi.** Perubahan `status`, assignment `admin_user_id`, dan upgrade role harus sukses atau gagal bersama. Kalau upgrade role gagal, status masjid tidak boleh ikut berubah.

**Deteksi duplikat adalah peringatan, bukan blokir.** Kandidat duplikat (nama mirip via trigram similarity Postgres `pg_trgm`, DAN jarak < 100m, status apapun termasuk `pending` lain) dikembalikan di response `POST /mosques`, tidak pernah menggagalkan submit.

**Self-edit hanya setelah `approved`.** `PATCH /mosques/:id` menolak masjid `pending`/`rejected` dengan `409` — hanya aksi Super Admin (`approve`/`reject`) yang menyentuh masjid sebelum disetujui.

**Reject tidak mengubah role pendaftar.** Hanya `approveMosque` yang memanggil `upgradeToMosqueAdmin`.

## API

### `POST /mosques`

Auth: any authenticated user. Body:

```json
{
  "name": "Masjid Test",
  "address": "Jl. Test No. 1",
  "latitude": "5.5500000",
  "longitude": "95.3200000",
  "cityId": "uuid",
  "provinceId": "uuid"
}
```

Respons `201`:

```json
{
  "id": "uuid",
  "name": "Masjid Test",
  "status": "pending",
  "duplicateWarning": [
    { "id": "uuid", "name": "Masjid Serupa", "address": "Jl. X", "distanceMeters": 42, "nameSimilarity": 0.62 }
  ]
}
```

`duplicateWarning` array kosong jika tidak ada kandidat mirip.

### `GET /mosques/pending`

Auth: `super_admin`. Respons `200`: array `{ id, name, address, createdAt, submittedBy }`, diurutkan `createdAt` ascending (yang lama duluan).

### `PATCH /mosques/:id/approve`

Auth: `super_admin`. Respons `200`: `{ "id": "uuid", "status": "approved" }`.

Error: `404` masjid tidak ditemukan/soft-deleted; `409` masjid bukan `pending`; `422` masjid tidak punya `createdBy` (kasus data tidak konsisten, seharusnya tidak terjadi lewat alur normal).

### `PATCH /mosques/:id/reject`

Auth: `super_admin`. Respons `200`: `{ "id": "uuid", "status": "rejected" }`. Error sama seperti approve (404/409), tanpa 422.

### `PATCH /mosques/:id`

Auth: pemilik masjid (`requireMosqueOwner`). Body: subset opsional dari `{ name, address, latitude, longitude }`, minimal satu field. Respons `200`: `{ "id": "uuid" }`.

Error: `403` bukan pemilik; `404` tidak ditemukan; `409` status bukan `approved`.

### `GET /mosques/my-submissions`

Auth: any authenticated user. Respons `200`: array `{ id, name, status, createdAt }` untuk semua masjid yang `createdBy` = pemanggil, status apapun, diurutkan `createdAt` descending (terbaru duluan).

## Arsitektur

Semua fungsi baru masuk `apps/web/server/services/mosque.service.ts`, memperluas `createMosque` yang sudah ada (dibuat sebagai contoh kerja Modul 7):

```ts
interface DuplicateCandidate { id: string; name: string; address: string; distanceMeters: number; nameSimilarity: number }
function checkForDuplicate(db: Database, input: { name: string; latitude: string; longitude: string }): Promise<DuplicateCandidate[]>;

interface PendingMosqueSummary { id: string; name: string; address: string; createdAt: Date; submittedBy: string | null }
function listPendingMosques(db: Database): Promise<PendingMosqueSummary[]>;

function approveMosque(db: Database, mosqueId: string, actorId: string): Promise<{ id: string; status: 'approved' }>;
function rejectMosque(db: Database, mosqueId: string, actorId: string): Promise<{ id: string; status: 'rejected' }>;

function updateApprovedMosque(
  db: Database, mosqueId: string,
  updates: Partial<{ name: string; address: string; latitude: string; longitude: string }>,
  actorId: string,
): Promise<{ id: string }>;

interface MySubmission { id: string; name: string; status: 'pending' | 'approved' | 'rejected'; createdAt: Date }
function listMySubmissions(db: Database, userId: string): Promise<MySubmission[]>;
```

`checkForDuplicate` memakai PostgreSQL `pg_trgm` extension (`similarity()` function) dan formula Haversine SQL untuk jarak — bukan library npm baru. Extension diaktifkan lewat satu baris `CREATE EXTENSION IF NOT EXISTS pg_trgm;` yang ditambahkan manual ke migration generated (Drizzle tidak bisa generate statement `CREATE EXTENSION` dari schema builder).

`approveMosque`/`rejectMosque`/`updateApprovedMosque` semuanya membungkus tulisnya dalam `db.transaction()` dan memanggil `withAudit` (Modul 7) di dalamnya. `approveMosque` juga memanggil `upgradeToMosqueAdmin` (Modul 1, `user.service.ts`) dengan handle transaksi yang sama — kompatibilitas tipe `Transaction` vs `Database` perlu dikonfirmasi saat implementasi (keduanya adalah Drizzle handle atas schema yang sama, seharusnya type-check tanpa cast).

Route handler tetap tipis: `server/api/mosques/index.post.ts`, `pending.get.ts`, `[id]/approve.patch.ts`, `[id]/reject.patch.ts`, `[id]/index.patch.ts`, `my-submissions.get.ts` — semuanya hanya parse input, panggil service, bentuk response.

## Kualitas dan Keamanan

- `requireRole(event, 'super_admin')` untuk approve/reject/pending; `requireMosqueOwner(event, mosqueId)` untuk self-edit; `requireAuth(event)` untuk submit dan my-submissions.
- Input divalidasi Zod: `createMosqueSchema` (semua field wajib), `updateMosqueSchema` (semua opsional, minimal satu field via `.refine`).
- Test approval flow secara eksplisit membuktikan atomisitas: approve ke ID masjid yang tidak ada harus gagal tanpa menyentuh masjid lain; approve dua kali ke masjid yang sama setelah approve pertama harus ditolak `409`.
- Test approve juga membuktikan rule "role tidak regresi": `upgradeToMosqueAdmin` (Modul 1) hanya meng-upgrade user yang saat ini `public_user`, sehingga approve masjid kedua untuk user yang sudah `mosque_admin` adalah no-op yang aman, bukan error.
- Semua test butuh Postgres nyata (`describe.runIf(Boolean(process.env.DATABASE_URL))`) karena logic-nya tak terpisahkan dari perilaku transaksional dan audit-writing.

## Definition of Done

- Keenam endpoint mematuhi kontrak response dan status error di atas.
- `pg_trgm` extension aktif via migration; `checkForDuplicate` mengembalikan kandidat yang benar untuk kasus nama mirip + jarak dekat, dan array kosong untuk kasus tidak mirip.
- Approve terbukti atomik (test kegagalan tidak mengubah status) dan tidak pernah menurunkan role.
- Reject terbukti tidak pernah mengubah role pendaftar.
- Self-edit menolak masjid yang belum `approved`.
- OpenAPI diperbarui untuk keenam path (termasuk menambah `patch:` sebagai sibling `get:` yang sudah ada di `/mosques/{id}` dari Modul 4, bukan menimpanya).
- Tidak ada entitas baru, tidak ada perubahan skema `mukims`/`mosques.mukim_id`.
