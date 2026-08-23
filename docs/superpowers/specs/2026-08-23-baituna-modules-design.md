# Baituna — Desain Modul MVP

Tanggal: 2026-08-23
Status: draft, menunggu review

Dokumen ini memecah MVP Baituna menjadi modul-modul yang bisa dikerjakan
terpisah. Requirement produk ada di `docs/baituna-prd.md`, skema database di
`docs/baituna-erd.md`. Dokumen ini tidak menggantikan keduanya — ia menambahkan
lapisan keputusan modul dan mencatat penyimpangan dari ERD yang disepakati saat
brainstorming.

## 1. Ringkasan

Scaffold sudah selesai: monorepo, Nuxt 4 + Nitro, Drizzle dengan 8 entitas,
Flutter + Provider, Docker, CI. Yang belum ada adalah business logic. Dokumen
ini membaginya menjadi 7 modul backend, 5 modul mobile, dan 1 paket shared.

## 2. Keputusan Desain Baru

Lima keputusan diambil saat brainstorming karena PRD/ERD tidak menjawabnya.
Tiga di antaranya mengubah atau menambah sesuatu di luar ERD dan ditandai
eksplisit di bawah.

### 2.1 Autentikasi — Google OAuth + seed Super Admin

**MENGUBAH ERD.** PRD §6 hanya mencantumkan `POST /auth/login`, tanpa endpoint
registrasi. Tanpa jalur masuk untuk user baru, requirement §4.0 ("registrasi
masjid terbuka untuk user manapun yang sudah login, dan itu jalur satu-satunya
untuk jadi Mosque Admin") tidak bisa berjalan — hanya Super Admin yang punya
akun.

Keputusan: Public User masuk lewat Google OAuth. Super Admin dibuat lewat seed
script dengan email/password. Tidak ada registrasi email/password untuk publik.

Konsekuensi pada tabel `users` (di luar ERD §6.1, perlu persetujuan):

| Kolom | Perubahan | Alasan |
| --- | --- | --- |
| `password_hash` | `NOT NULL` → nullable | User OAuth tidak punya password |
| `provider` | kolom baru, enum `local`/`google` | Membedakan jalur login |
| `provider_id` | kolom baru, text nullable | Subject ID dari Google |

Constraint: unique `(provider, provider_id)` untuk mencegah satu akun Google
terhubung ke dua user. Kolom `email` tetap unique.

### 2.2 Person — CRUD penuh

ERD §6.3 menyebut Person "reusable per masjid, bisa dilihat histori penugasan
per orang", tapi PRD §6 tidak mencantumkan endpoint Person sama sekali.

Keputusan: Person dikelola lewat CRUD penuh di `/mosques/:id/people`. Endpoint
Friday Assignment hanya menerima `person_id`, tidak menerima nama bebas, dan
memvalidasi bahwa Person tersebut milik masjid yang sama. Penghapusan Person
adalah soft delete, sehingga assignment lama tetap terbaca di history.

Alasan menolak auto-create inline: nama yang diketik ulang tiap minggu
menghasilkan Person duplikat, dan itu merusak fitur "histori penugasan per
orang" yang jadi alasan Person dibuat sebagai entitas.

### 2.3 Mukim — tetap di schema, tidak dipakai

ERD §6.1 dan §6.3 menetapkan Mukim sebagai unit administratif khas Aceh.
Saat brainstorming disepakati Mukim tidak diperlukan.

Keputusan: tabel `mukims` dan kolom `mosques.mukim_id` **tetap ada di schema**
apa adanya (nullable, selalu NULL). Tidak ada endpoint, seed, filter, atau UI
yang menyentuhnya. `schema.ts` diberi komentar yang menjelaskan status ini
supaya kontributor tidak mengira ada fitur yang belum selesai.

Alasan tidak menghapus: nol perubahan migration, nol risiko, dan kalau ternyata
dibutuhkan nanti tinggal dipakai tanpa migrasi ulang.

### 2.4 Seed wilayah — Province + City saja

Keputusan: seed 1 Province (Aceh) dan 23 kabupaten/kota dari dataset wilayah
publik. Tidak menyeed provinsi lain (rollout awal hanya Aceh) dan tidak
menyeed Mukim (lihat §2.3).

### 2.5 Notifikasi status masjid — tanpa entitas baru

PRD §4.0 meminta notifikasi status "minimal lewat in-app", tapi ERD tidak punya
entitas Notification dan PRD §2 justru menempatkan notifikasi push di luar
cakupan MVP.

Keputusan: tidak ada entitas Notification. Pendaftar melihat status lewat
`GET /mosques/my-submissions`, yang menampilkan masjid yang pernah ia daftarkan
beserta status `pending`/`approved`/`rejected`. Status sudah ada di
`Mosque.status`, jadi ini nol entitas baru dan nol perubahan ERD.

## 3. Modul Backend (apps/web)

Setiap modul punya service layer sendiri di `server/services/`, terpisah dari
route handler di `server/api/`, sesuai struktur yang sudah discaffold.

### 3.1 Auth & RBAC

Tanggung jawab: identitas dan otorisasi untuk seluruh sistem.

- `POST /auth/login` — email/password, hanya untuk Super Admin hasil seed
- Google OAuth flow — redirect, callback, buat user baru dengan role
  `public_user` kalau `provider_id` belum dikenal
- JWT issue dan verify (sudah ada skeleton di `server/utils/auth.ts`)
- Guard `requireAuth` (sudah ada) dan `requireRole(role)` (belum ada)
- Seed script Super Admin

Dependensi: tidak ada. Modul 3, 5, 6 bergantung padanya.

### 3.2 Region Reference

Tanggung jawab: data wilayah untuk alamat masjid dan filter browse.

- `GET /provinces`, `GET /provinces/:id/cities` — publik, read-only
- Seed script Province + City Aceh

Tidak ada endpoint tulis: data wilayah tidak berubah lewat aplikasi di MVP.

### 3.3 Mosque Registration & Approval

Tanggung jawab: siklus hidup pendaftaran masjid dari submit sampai approve.

- `POST /mosques` — any authenticated user, status `pending`
- `GET /mosques/pending` — Super Admin
- `PATCH /mosques/:id/approve` — Super Admin; set status `approved`, set
  `admin_user_id` ke pendaftar, upgrade role pendaftar ke `mosque_admin`
- `PATCH /mosques/:id/reject` — Super Admin; set status `rejected`, role
  pendaftar tidak berubah
- `PATCH /mosques/:id` — Mosque Admin, hanya masjid miliknya, hanya setelah
  approved
- `GET /mosques/my-submissions` — user melihat status pendaftarannya (§2.5)

Satu user boleh mendaftarkan lebih dari satu masjid. Kalau masjid kedua
di-approve sementara role user sudah `mosque_admin`, role tidak berubah dan
`admin_user_id` masjid kedua tetap di-set ke user tersebut. Kepemilikan
ditentukan oleh `admin_user_id` per masjid, bukan oleh role saja — jadi semua
guard "masjid miliknya" harus mengecek `admin_user_id`, bukan cukup mengecek
role.

Soft duplicate check saat submit: cari masjid lain dengan nama mirip (fuzzy)
DAN jarak < 100m dari koordinat yang didaftarkan. Hasilnya peringatan di
response, bukan hard block. Flag ini ikut ditampilkan ke Super Admin saat review.

Approve dan role upgrade harus satu transaksi: kalau update role gagal, status
masjid tidak boleh ikut berubah.

Dependensi: modul 1 (identitas pendaftar), modul 7 (audit).

### 3.4 Mosque Search & Detail

Tanggung jawab: pencarian publik tanpa login.

- `GET /mosques/nearby?lat&lng&radius` — bounding box pre-filter di SQL, lalu
  Haversine presisi dan sorting di kandidat yang lolos
- `GET /mosques/search?q=` — pencarian nama/alamat
- `GET /mosques/:id` — detail

Hanya masjid `approved` yang muncul di ketiga endpoint. Rate limit 60
request/menit per IP di Nitro middleware.

Dependensi: tidak ada. Bisa dikerjakan paralel dengan modul 1.

### 3.5 Person

Tanggung jawab: master data Khatib/Imam/Muazzin per masjid (§2.2).

- `GET /mosques/:id/people` — daftar Person aktif
- `POST /mosques/:id/people` — Mosque Admin
- `PATCH /mosques/:id/people/:personId` — Mosque Admin
- `DELETE /mosques/:id/people/:personId` — soft delete

Semua endpoint tulis dibatasi ke Mosque Admin pemilik masjid tersebut.

Dependensi: modul 1, modul 7.

### 3.6 Friday Assignment

Tanggung jawab: penugasan Jumat dan riwayatnya.

- `POST /mosques/:id/friday-schedule` — Mosque Admin
- `GET /mosques/:id/friday-schedule/current` — publik
- `GET /mosques/:id/friday-schedule/history` — publik, paginated

Aturan yang harus ditegakkan di service layer:

- Satu entri = satu masjid + satu tanggal Jumat spesifik; unique
  `(mosque_id, assignment_date)` sudah ada di DB
- `assignment_date` wajib jatuh di hari Jumat
- Entri yang tanggalnya sudah lewat read-only. Endpoint update
  (`PATCH /mosques/:id/friday-schedule/:assignmentId`) disediakan untuk
  mengoreksi entri Jumat yang belum lewat, dan menolak dengan 403 kalau
  `assignment_date` sudah lewat
- `current` mengembalikan `{ has_assignment: false, assignment_date: <Jumat
  berikutnya> }` kalau belum ada entri, bukan error
- Perhitungan "Jumat ini/berikutnya" pakai Asia/Jakarta (WIB) secara konsisten;
  transisi tengah malam WIB setelah tanggal Jumat berjalan
- `person_id` yang dikirim harus milik masjid yang sama

Dependensi: modul 5 (Person), modul 1, modul 7.

### 3.7 Audit Log (cross-cutting)

Tanggung jawab: mengisi `history` JSONB per baris dan menulis ke tabel
`audit_logs`. Bukan modul dengan endpoint — ini utility yang dipanggil modul 3,
5, dan 6 pada setiap CREATE/UPDATE/DELETE.

ERD §6.0 menyebut dua opsi implementasi: application layer atau Postgres
trigger. Dipilih **application layer**, sesuai struktur service yang sudah
discaffold, karena logic diff lebih mudah ditulis dan diuji di TypeScript.
Konsekuensi yang harus diterima: raw query yang melewati service layer tidak
akan teraudit.

## 4. Modul Mobile (apps/mobile)

Flutter + Provider, mengikuti struktur folder yang sudah discaffold
(`screens/`, `providers/`, `services/`, `models/`).

| Modul | Cakupan |
| --- | --- |
| Auth | Google sign-in, simpan token di flutter_secure_storage, auth state di Provider |
| Mosque Search | Izin lokasi, daftar nearby, search by keyword, cache hasil terakhir di Hive |
| Mosque Detail & Friday Schedule | Detail masjid, jadwal Jumat ini, riwayat |
| Mosque Registration | Form pendaftaran, tampilan peringatan duplikat, daftar my-submissions |
| Mosque Admin | Kelola data masjid sendiri, kelola Person, input assignment |

Web juga harus responsive (PRD §5) — mayoritas Public User diperkirakan akses
lewat browser mobile, bukan hanya lewat app Flutter.

## 5. packages/shared

Tipe kontrak hasil generate dari OpenAPI spec, dipakai sebagai tipe
request/response di web dan sebagai referensi model di mobile.

## 6. Urutan Pengerjaan yang Disarankan

Berdasarkan dependensi di §3:

1. Modul 1 (Auth & RBAC) dan modul 4 (Search) — bisa paralel, keduanya tidak
   punya dependensi
2. Modul 2 (Region) dan modul 7 (Audit) — dibutuhkan modul berikutnya
3. Modul 3 (Registration & Approval)
4. Modul 5 (Person), lalu modul 6 (Friday Assignment)
5. Modul mobile mengikuti modul backend yang sudah jadi

Urutan ini belum disepakati dan bisa berubah.

## 7. Testing

Sesuai baseline PRD §5:

- Unit test wajib untuk service layer kritis: approval flow dan role upgrade
  (modul 3), perhitungan jadwal Jumat dan aturan read-only (modul 6)
- E2E test minimal untuk 2 flow inti: cari masjid terdekat, submit & approve
  pendaftaran masjid

## 8. Yang Perlu Persetujuan

Dua hal berada di luar dokumen final dan menunggu persetujuan sebelum
implementasi dimulai. Scaffold prompt melarang penambahan di luar ERD/PRD tanpa
konfirmasi eksplisit, jadi keduanya belum dieksekusi.

1. **Perubahan tabel `users`** (§2.1) — `password_hash` jadi nullable, tambah
   kolom `provider` dan `provider_id`. Di luar ERD §6.1. Memblokir modul 1.
2. **Endpoint tambahan di luar PRD §6** — `PATCH /mosques/:id/friday-schedule/:assignmentId`
   (§3.6), `GET /mosques/my-submissions` (§3.3), CRUD Person (§3.5), dan
   `GET /provinces` + `GET /provinces/:id/cities` (§3.2). Semuanya turunan dari
   keputusan §2, tidak menambah entitas baru.
