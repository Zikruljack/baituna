# Baituna — PRD (MVP)

> ERD & skema database ada di dokumen terpisah: `baituna-erd.md`

## 1. Ringkasan Produk

**Baituna** adalah platform open source untuk ekosistem manajemen masjid dan community engagement. MVP dibatasi ketat pada dua kemampuan inti:

1. Pencarian masjid terdekat (berbasis lokasi)
2. Jadwal Khatib / Imam / Muazzin shalat Jumat per masjid, dengan riwayat (history) yang tidak boleh tertimpa

Lisensi: Apache-2.0. Status: proyek hobi, bukan target komersial.

## 2. Tujuan & Batasan MVP

**Tujuan MVP**

- Pengguna publik bisa menemukan masjid terdekat dari lokasinya
- Pengguna publik bisa melihat siapa yang bertugas sebagai Khatib/Imam/Muazzin Jumat ini, tanpa login
- Admin masjid bisa mengelola data masjidnya dan menetapkan petugas Jumat
- Mosque Admin bisa mendaftarkan masjid baru sendiri (self-registration, status pending), diverifikasi Super Admin — bukan cuma Super Admin yang bisa input data masjid
- RBAC MVP disederhanakan menjadi 3 peran saja: Super Admin, Mosque Admin, Public User (Province Admin/City Admin ditunda ke fase berikutnya)

**Di luar cakupan MVP** (kandidat fase berikutnya)

- Manajemen donasi/keuangan masjid
- Manajemen jamaah/keanggotaan
- Jadwal kegiatan selain Jumat (kajian, TPA, dll.)
- Notifikasi push
- Review/rating masjid oleh publik

## 3. Peran Pengguna (RBAC)

| Peran        | Cakupan  | Kemampuan utama di MVP                                                                                                                               |
| ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Super Admin  | Global   | Kelola seluruh data, approve/reject pendaftaran masjid baru                                                                                          |
| Mosque Admin | 1 masjid | CRUD data masjid miliknya (setelah approved), CRUD jadwal Khatib/Imam/Muazzin                                                                        |
| Public User  | —        | Cari masjid, lihat jadwal Jumat tanpa login; kalau sudah login, bisa daftarkan masjid baru (jalur satu-satunya untuk jadi Mosque Admin — lihat §4.0) |

Catatan: Province Admin dan City Admin **tidak** masuk MVP — ditunda ke fase berikutnya. Struktur data Province/City tetap dipakai (untuk alamat masjid & filter wilayah), tapi tanpa peran admin di level itu.

_Revisi 2026-08-23: entitas **Mukim** ada di schema tapi **tidak dipakai di MVP** — tidak diseed, tidak difilter, tidak ada UI. Lihat `baituna-erd.md` §6.1._

## 4. User Stories & Requirement Fungsional

### 4.0 Registrasi & Verifikasi Masjid

- Sebagai Public User (siapapun yang sudah login, role apapun), saya ingin mendaftarkan masjid baru yang belum ada di sistem.
- Sebagai Super Admin, saya ingin meninjau dan approve/reject pendaftaran masjid baru, agar data tidak duplikat atau spam.

Functional requirements:

- `Mosque.status` (enum: `pending`, `approved`, `rejected`); hanya masjid `approved` yang muncul di pencarian publik
- Pendaftaran masjid terbuka untuk **user manapun yang sudah login**, tidak harus sudah punya role `mosque_admin` — ini jalur satu-satunya untuk mendapatkan role tersebut
- Saat masjid **approved**: role user pendaftar otomatis di-upgrade ke `mosque_admin`, dan `Mosque.admin_user_id` di-set ke user tersebut. Saat **rejected**: role user tidak berubah
- Saat submit, sistem cek duplikat lunak: cari masjid lain dengan nama mirip (fuzzy match) DAN jarak < 100m dari koordinat yang didaftarkan → tampilkan sebagai peringatan ke pendaftar, tapi tetap boleh submit (bukan hard block); Super Admin lihat flag ini saat review
- Notifikasi status (approved/rejected) ke pendaftar lewat in-app. _Revisi 2026-08-23: "in-app" diimplementasikan sebagai `GET /mosques/my-submissions` (daftar masjid yang pernah didaftarkan user + statusnya), **tanpa** entitas Notification. Email di luar cakupan MVP._
- Satu user boleh mendaftarkan lebih dari satu masjid. Kepemilikan ditentukan `Mosque.admin_user_id` per masjid, bukan oleh role

### 4.1 Cari Masjid Terdekat

- Sebagai Public User, saya ingin mengizinkan akses lokasi agar melihat masjid terdekat diurutkan berdasarkan jarak.
- Sebagai Public User, saya ingin mencari masjid berdasarkan nama/alamat jika saya tidak ingin share lokasi.
- Sebagai Public User, saya ingin melihat detail masjid: nama, alamat, koordinat, foto (opsional), dan siapa admin/penanggung jawabnya.

Functional requirements:

- Endpoint pencarian berbasis radius (lat/lng + radius km), diurutkan by jarak
- Implementasi jarak: **Haversine + bounding box pre-filter** (bukan PostGIS) — filter kandidat dulu pakai `WHERE lat BETWEEN.. AND lng BETWEEN..` (kolom lat/lng ter-index biasa), baru hitung Haversine presisi & sorting di kandidat yang lolos
- Endpoint pencarian by keyword nama/alamat sebagai fallback
- Mobile: cache hasil pencarian terakhir secara lokal (Hive) untuk mode offline terbatas
- Web & mobile menggunakan API yang sama (kontrak OpenAPI)

### 4.2 Jadwal Khatib/Imam/Muazzin Jumat

- Sebagai Public User, saya ingin melihat siapa Khatib/Imam/Muazzin Jumat ini di masjid pilihan saya.
- Sebagai Mosque Admin, saya ingin menetapkan Khatib/Imam/Muazzin untuk Jumat mendatang.
- Sebagai Mosque Admin, saya ingin riwayat penugasan tersimpan — assignment Jumat yang sudah lewat tidak boleh diedit/ditimpa, hanya bisa ditambah entri baru untuk minggu berikutnya.

Functional requirements:

- Satu entri assignment = satu masjid + satu tanggal Jumat spesifik (bukan "current" yang di-overwrite)
- Entri assignment yang tanggalnya sudah lewat bersifat read-only di level API (tidak bisa PUT/PATCH, hanya bisa dibaca)
- Endpoint publik: "jadwal Jumat ini" (by mosque_id) dan "riwayat jadwal" (paginated)
- Empty state: jika belum ada entri untuk Jumat mendatang, endpoint `current` mengembalikan `{ has_assignment: false, assignment_date: <tanggal Jumat berikutnya> }`, bukan error atau data kosong tanpa konteks
- "Jumat ini/berikutnya" dihitung pakai timezone **Asia/Jakarta (WIB)** secara konsisten di server; transisi ke entri berikutnya terjadi tengah malam WIB (00:00) setelah tanggal Jumat berjalan

## 5. Non-Functional Requirements

- Rollout awal: Provinsi Aceh. Estimasi skala data: ~6.500 kampung, 1 mukim = 3–6 kampung (≈1.100–2.200 mukim), minimal 1 masjid per mukim → perkiraan realistis ribuan masjid (low-to-mid thousands). Skala ini masih aman untuk Haversine + bounding box index, tanpa perlu PostGIS di MVP
- Web: Nuxt 4 (Nitro server API), TypeScript, Drizzle ORM, PostgreSQL, Zod validasi, JWT auth, OpenAPI/Swagger, Docker
- Web harus mobile-friendly / responsive — mengingat mayoritas Public User kemungkinan akses lewat browser mobile, bukan hanya lewat app Flutter
- Mobile: Flutter, Provider (state management — bukan Riverpod/Bloc/GetX), Dio, Go Router, Hive, flutter_secure_storage, Google Maps/OSM
- Semua tabel: `id UUID`, `created_at`, `updated_at`, `deleted_at` (soft delete) — detail lengkap base audit fields ada di `baituna-erd.md` §6.0
- Rate limiting endpoint publik tanpa auth (`nearby`, `search`): 60 request/menit per IP, ditegakkan di level Nitro middleware atau reverse proxy (nginx)
- Baseline testing: unit test wajib untuk business logic di service layer (khususnya approval flow, role upgrade, dan perhitungan jadwal Jumat); e2e test minimal untuk 2 flow inti (cari masjid terdekat, submit & approve pendaftaran masjid)
- Struktur monorepo: `apps/web`, `apps/mobile`, `packages/shared`, `docs`, `docker`, `.github`
- Conventional commits, GitHub Actions CI, template issue/PR

## 6. Ringkasan Endpoint API

> Direvisi 2026-08-23. Endpoint bertanda ✚ ditambahkan setelah draft awal, sebagai konsekuensi keputusan di `superpowers/specs/2026-08-23-baituna-modules-design.md` §2 — tidak ada entitas baru yang ditambahkan.

| Method | Endpoint                                          | Akses                                            |
| ------ | ------------------------------------------------- | ------------------------------------------------ |
| GET    | /mosques/nearby?lat&lng&radius                    | Public                                           |
| GET    | /mosques/search?q=                                | Public                                           |
| GET    | /mosques/:id                                      | Public                                           |
| GET    | /mosques/:id/friday-schedule/current              | Public                                           |
| GET    | /mosques/:id/friday-schedule/history              | Public                                           |
| POST   | /mosques/:id/friday-schedule                      | Mosque Admin                                     |
| ✚ PATCH | /mosques/:id/friday-schedule/:assignmentId       | Mosque Admin (tolak 403 kalau tanggal sudah lewat) |
| ✚ GET  | /mosques/:id/people                               | Public                                           |
| ✚ POST | /mosques/:id/people                               | Mosque Admin                                     |
| ✚ PATCH | /mosques/:id/people/:personId                    | Mosque Admin                                     |
| ✚ DELETE | /mosques/:id/people/:personId                   | Mosque Admin (soft delete)                       |
| POST   | /mosques                                          | Any authenticated user (submit, status=pending)  |
| PATCH  | /mosques/:id/approve                              | Super Admin                                      |
| PATCH  | /mosques/:id/reject                               | Super Admin                                      |
| PATCH  | /mosques/:id                                      | Mosque Admin (masjid miliknya, setelah approved) |
| GET    | /mosques/pending                                  | Super Admin                                      |
| ✚ GET  | /mosques/my-submissions                           | Any authenticated user                           |
| ✚ GET  | /provinces                                        | Public                                           |
| ✚ GET  | /provinces/:id/cities                             | Public                                           |
| POST   | /auth/login                                       | Public (Super Admin hasil seed)                  |
| ✚ GET  | /auth/google + callback                           | Public (jalur masuk Public User)                 |

---

Dokumen ini final untuk MVP, siap jadi input agentic coding. Skema data lengkap: lihat `baituna-erd.md`. Pemecahan modul & alasan di balik revisi 2026-08-23: lihat `superpowers/specs/2026-08-23-baituna-modules-design.md`.
