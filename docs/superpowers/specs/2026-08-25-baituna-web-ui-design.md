# Baituna — Desain UI Web (Modul 2, 3, 4, 5, 6)

Tanggal: 2026-08-25
Status: draft, menunggu review

Dokumen ini mendefinisikan halaman, navigasi, dan integrasi API untuk frontend
`apps/web` yang mengkonsumsi backend Modul 2 (Region), Modul 3 (Mosque
Registration & Approval), Modul 4 (Mosque Search & Detail), Modul 5 (Person),
dan Modul 6 (Friday Assignment) — kelimanya sudah punya kontrak backend
selesai atau hampir selesai (Modul 4 sedang diimplementasikan paralel oleh
agent lain, kontraknya sudah stabil di
`docs/superpowers/specs/2026-08-23-module-4-mosque-search.md`).

Modul 1 (Auth) dan sistem desain sudah diimplementasikan
(`docs/superpowers/plans/2026-08-24-auth-frontend.md`,
`docs/superpowers/specs/2026-08-23-baituna-design-system.md`) dan tidak
diulang di sini — dokumen ini hanya menambah lapisan halaman/komponen di
atas fondasi yang sudah ada, dan diasumsikan konsisten dengan
`components/AppHeader.vue`, `composables/useAuth.ts`, `composables/useApi.ts`
yang sudah berjalan.

Dokumen ini adalah spec gabungan; setiap modul mendapat implementation plan
sendiri (`docs/superpowers/plans/2026-08-25-ui-module-{2,3,4,5,6}-*.md`) yang
merujuk balik ke sini untuk konvensi bersama.

## 1. Temuan Awal — `pages/index.vue` Saat Ini

`index.vue` saat ini adalah mockup statis penuh: enam objek masjid
hardcoded di `<script setup>`, termasuk field `capacity` ("24.000 Jamaah")
dan `cash` ("Rp 248.500.000" — "Saldo Kas Terbuka"). **Kedua field ini tidak
ada di skema database manapun** — tidak di `mosques` table, tidak di modul
manapun yang sudah dispesifikasikan. Dialog "Ajukan Pendaftaran Masjid" di
section CTA hanya menampilkan `toast.success(...)` — tidak memanggil
endpoint apa pun.

Keputusan (disetujui pemilik produk 2026-08-25): `index.vue` dirombak untuk
memakai data nyata dari API, bukan dihapus dan diganti halaman terpisah.
Struktur section yang sudah ada (`#jadwal-jumat`, `#masjid`, `#daftar-masjid`,
dituju dari anchor link di `AppHeader.vue`) **dipertahankan** — hanya isi
datanya yang diganti dari array hardcoded menjadi panggilan API, dan dua
field finansial/kapasitas yang tak berdasar dihapus total. Lihat §4.1 untuk
rincian per section.

## 2. Arsitektur Bersama

### 2.1 Lapisan Tipe API

Backend (`apps/web/server/utils/openapi.ts`) hanya berisi `summary` dan
`description` teks, tanpa `components.schemas` — sama seperti yang dicatat
di plan auth-frontend, `openapi-typescript` tidak berguna di sini. Tipe
response/request untuk kelima modul ini **ditulis tangan**, mengikuti pola
`apps/web/lib/auth-types.ts`.

File baru: `apps/web/types/api.ts` (direktori `apps/web/types/` sudah ada,
kosong). Berisi semua interface response/request untuk Modul 2, 3, 4, 5, 6
di satu tempat, supaya satu perubahan kontrak backend hanya butuh satu
lokasi frontend untuk disinkronkan. Setiap interface diberi komentar satu
baris yang menunjuk ke file spec module asalnya (pola yang sama dengan
`auth-types.ts`).

Bentuk data yang **wajib** diikuti persis (diambil dari spec backend, bukan
diasumsikan):

- `Person` — `{ id: string; name: string; phone: string | null }` (Modul 5)
- `FridayAssignment` — `{ id: string; mosqueId: string; assignmentDate: string; khatibPersonId: string | null; imamPersonId: string | null; muazzinPersonId: string | null }` (Modul 6)
- `CurrentFridayAssignment` — union: `{ has_assignment: true; id: string; assignmentDate: string; khatibPersonId: string | null; imamPersonId: string | null; muazzinPersonId: string | null }` **atau** `{ has_assignment: false; assignment_date: string }`. **Perhatikan penamaan tidak konsisten yang disengaja**: cabang `true` pakai `assignmentDate` (camelCase), cabang `false` pakai `assignment_date` (snake_case) — ini bukan bug, melainkan kontrak literal dari PRD §4.2 yang sudah dicatat eksplisit di plan Modul 6 sebagai "jangan diperbaiki". Kode frontend yang membaca union ini harus narrow lewat `has_assignment` sebelum mengakses field tanggal.
- `MosqueSummary` — `{ id: string; name: string; address: string; latitude: number; longitude: number; photoUrl: string | null; distanceKm?: number }` (Modul 4; `distanceKm` hanya ada dari endpoint `nearby`)
- `MosqueDetail` — `{ id: string; name: string; address: string; latitude: number; longitude: number; photoUrl: string | null; cityId: string; provinceId: string; status: 'approved'; adminUserId: string | null }` (Modul 4)
- `PendingMosque` — `{ id: string; name: string; address: string; createdAt: string; submittedBy: string | null }` (Modul 3, bentuk `PendingMosqueSummary` di service, `createdAt` jadi string ISO lewat JSON)
- `MySubmission` — `{ id: string; name: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string }` (Modul 3, diverifikasi langsung dari `MySubmission` interface di `mosque.service.ts` — spec Modul 3 sendiri tidak mencantumkan field lengkap endpoint ini)
- `RegionOption` — `{ id: string; name: string }`, `CityOption` — `RegionOption & { provinceId: string }` (Modul 2); **respons dibungkus** `{ data: RegionOption[] }` / `{ data: CityOption[] }`, bukan array telanjang — ini berbeda dari kebanyakan endpoint lain di sistem ini dan gampang salah tebak.

### 2.2 Lapisan Pemanggilan API

Pakai `useApi` yang sudah ada (`apps/web/composables/useApi.ts`, wrapper
`useFetch` yang menempel bearer token otomatis). Tidak ada composable baru
untuk fetching dasar — endpoint publik dan endpoint terproteksi memakai
composable yang sama; header `Authorization` otomatis kosong kalau tidak
ada token, dan server menolaknya kalau endpoint memang butuh auth.

Untuk endpoint yang butuh path dinamis (`/api/mosques/:id/people`, dst.),
url dibentuk lewat computed string atau arrow function sesuai signature
`useApi(url: string | (() => string), opts?)` yang sudah ada — tidak perlu
mengubah `useApi.ts`.

Composable baru per modul, mengikuti pola satu composable per domain data
(bukan satu composable-mega untuk semua modul):

| Modul | Composable baru | Tanggung jawab |
| --- | --- | --- |
| 2 | `composables/useRegions.ts` | `listProvinces()`, `listCities(provinceId)` — dipakai form registrasi Modul 3 |
| 3 | `composables/useMosqueRegistration.ts` | submit pendaftaran, list pending (admin), approve/reject, my-submissions |
| 4 | `composables/useMosqueSearch.ts` | nearby (dengan geolocation browser), search by keyword, detail by id |
| 5 | `composables/usePeople.ts` | CRUD Person per masjid |
| 6 | `composables/useFridayAssignment.ts` | current, history, create, update |

Setiap composable mengembalikan fungsi async yang membungkus `$fetch`
langsung (bukan `useApi`/`useFetch` reaktif) untuk aksi tulis (submit,
approve, create, update, delete) — pola yang sama dengan `login()` di
`useAuth.ts` — dan `useApi`/`useFetch` untuk pembacaan yang perlu reaktivitas
otomatis terhadap perubahan parameter (misalnya `radius` di pencarian
nearby). Aksi tulis melempar error `$fetch` apa adanya; halaman yang
memanggilnya bertanggung jawab menangkap dan menampilkan lewat `toast.error`
(pola `vue-sonner` yang sudah dipakai di `index.vue`).

### 2.3 Role Gating

Tiga peran: `super_admin`, `mosque_admin`, `public_user` (dari
`lib/auth-types.ts` `UserRole`, sudah ada). Halaman admin memakai dua
lapisan proteksi:

1. **Middleware halaman** — `middleware/auth.ts` yang sudah ada (redirect ke
   `/login` kalau tidak ada token) dipakai untuk semua halaman yang butuh
   login. Halaman baru: `middleware/require-role.ts` — factory
   `defineNuxtRouteMiddleware` yang menerima daftar role lewat
   `definePageMeta({ middleware: ['auth', 'require-role'] })` dan
   `definePageMeta({ requiredRoles: ['super_admin'] })`; redirect ke `/`
   dengan toast error kalau role tidak cocok. Satu file middleware baru,
   dipakai lintas semua halaman admin di Modul 3, 5, 6 — bukan diulang per
   modul.
2. **Kepemilikan per-masjid** — backend sudah menegakkan `requireMosqueOwner`
   di setiap endpoint tulis Modul 5/6 dan `PATCH /mosques/:id` Modul 3;
   frontend **tidak boleh** mengandalkan role saja untuk menampilkan tombol
   aksi "kelola masjid ini" — halaman admin masjid mengecek
   `mosque.adminUserId === user.id` (dari `MosqueDetail`, Modul 4) sebelum
   menampilkan link ke panel kelola, meniru aturan backend yang sama persis.
   `super_admin` selalu lolos kedua sisi (backend maupun UI gate) tanpa
   perlu jadi `adminUserId`.

### 2.4 Struktur Rute

```
/                                    (index.vue — dirombak, §4.1)
/masjid/[id]                         (Modul 4 — detail masjid publik)
/masjid/daftar                       (Modul 3 — form pendaftaran, auth required)
/masjid/pendaftaran-saya             (Modul 3 — my-submissions, auth required)
/admin/pendaftaran                   (Modul 3 — antrean approval, super_admin only)
/admin/masjid/[id]                   (Modul 5 + 6 — panel kelola masjid: Person + Jadwal Jumat, mosque_admin/super_admin only)
```

Pencarian (nearby + keyword) **tidak** dapat rute sendiri — ia hidup di
section `#masjid` pada `index.vue`, konsisten dengan struktur single-page
yang sudah ada di `AppHeader.vue`. `/masjid/[id]` tetap rute terpisah karena
detail masjid butuh URL yang bisa dibagikan (SEO, share link) — beda
kebutuhan dari listing.

`/admin/masjid/[id]` menggabungkan Modul 5 (Person) dan Modul 6 (Friday
Assignment) di satu halaman dengan tab, bukan dua rute terpisah — kedua
modul selalu dipakai bersamaan oleh Mosque Admin yang sama untuk masjid yang
sama (assignment butuh Person yang sudah ada), jadi memisahkan rute hanya
menambah navigasi tanpa manfaat.

## 3. Komponen shadcn-vue — Tambahan yang Dibutuhkan

Terinstal saat ini: `alert`, `avatar`, `badge`, `button`, `card`, `dialog`,
`dropdown-menu`, `input`, `label`, `select`, `separator`, `skeleton`,
`sonner`, `table`. Desain ini butuh tambahan yang belum ada:

| Komponen | Dibutuhkan oleh | Alasan |
| --- | --- | --- |
| `form` | Modul 3 (registrasi, edit masjid), Modul 5 (form Person) | Validasi Zod terintegrasi dengan pesan error per-field |
| `textarea` | Modul 3 | Alamat masjid bisa panjang, `input` satu baris tidak cukup |
| `pagination` | Modul 6 (riwayat assignment) | `GET .../history` sudah paginated di backend (`page`/`pageSize`/`total`) |
| `tabs` | `/admin/masjid/[id]` (§2.4) | Memisahkan sub-panel Person dan Jadwal Jumat di satu halaman |

**Date picker untuk Modul 6 (assignment Jumat)**: didelegasikan di spec
desain sistem (§5) ke saat implementasi. Keputusan di sini: **tidak ada
input tanggal sama sekali** — bukan `calendar` shadcn-vue, bukan juga
`input type="date"` atau `select` multi-pilihan. Backend hanya pernah
punya satu tanggal yang bisa dibuat dalam satu waktu: hasil
`getCurrentOrNextFridayWib(now)` (Jumat ini kalau hari ini Jumat, kalau
tidak Jumat berikutnya) — tidak ada endpoint untuk memilih Jumat lain di
luar itu, dan `assignmentDate` tidak bisa diubah setelah dibuat. UI
menghitung tanggal itu di client (port pure-JS dari
`getCurrentOrNextFridayWib` di `server/utils/wib-date.ts`, tanpa
server-only API) dan menampilkannya sebagai **teks read-only**, bukan
kontrol input apa pun — ini menghindari state "tanggal dipilih lalu
ditolak backend" sekaligus tidak menyiratkan pilihan yang sebenarnya tidak
ada.

Lokasi input peta/koordinat untuk form registrasi masjid (Modul 3):
**tidak** pakai peta interaktif (Leaflet/Mapbox) di MVP ini — dua input
number biasa untuk latitude/longitude, dengan tombol "Gunakan Lokasi Saya
Sekarang" yang memanggil `navigator.geolocation.getCurrentPosition` browser
dan mengisi otomatis. Alasan: menambah dependency peta adalah keputusan
yang lebih besar dari cakupan lima modul UI ini dan tidak diminta PRD;
geolocation browser sudah cukup akurat untuk kasus "DKM mendaftar dari
lokasi masjidnya sendiri".

## 4. Halaman per Modul

### 4.1 `index.vue` — Rombak (Modul 4 + 6, terintegrasi)

**Section `#jadwal-jumat` ("Sorotan Jadwal Shalat Jumat")**: sekarang
menampilkan Jumat ini/berikutnya dari **satu masjid unggulan** — didefinisikan
sebagai masjid pertama dari hasil `GET /mosques/nearby` memakai lokasi
browser (fallback: masjid pertama dari `GET /mosques/search?q=` kosong-ish
tidak valid karena `q` wajib min 1 karakter, jadi fallback sebenarnya adalah
menyembunyikan section ini kalau geolocation ditolak dan tidak ada masjid
default — bukan memaksa mock data). Data assignment dari
`GET /mosques/:id/friday-schedule/current`; kalau `has_assignment: false`,
section menampilkan card kosong dengan pesan "Belum ada jadwal untuk Jumat
[assignment_date]" alih-alih menyembunyikan section — ini konsisten dengan
kontrak backend yang sengaja tidak 404 di keadaan kosong (§2.1 di atas).

Field `khatibTitle`, `imamTitle` (gelar/keterangan tambahan), `topic` (tema
khutbah), `facilities`, `capacity`, `cash` yang ada di mock **dihapus semua**
— tidak ada satu pun di skema `friday_assignments` atau `mosques`. Yang
tersisa dari `FridayAssignment` hanyalah nama Person untuk
khatib/imam/muazzin (diresolusi dari `khatibPersonId` dkk. lewat
`GET /mosques/:id/people` — cocokkan id ke nama di client, karena endpoint
assignment sendiri hanya mengembalikan id, bukan nama Person).

**Section `#masjid` ("Eksplorasi Masjid Terdekat")**: search bar hero
terhubung ke `GET /mosques/search?q=` (submit on enter/klik "Cari"), chip
filter wilayah lama (`locations` hardcoded: Baiturrahman, Lueng Bata, dst.)
**dihapus** — Modul 4 tidak mendukung filter Province/City (dicatat eksplisit
sebagai out-of-scope di spec Modul 4 §Batasan). Sebagai gantinya, kalau
query kosong dan browser memberi izin lokasi, section ini otomatis memanggil
`GET /mosques/nearby` dan menampilkan hasil terurut jarak; kalau lokasi
ditolak/tidak tersedia dan query kosong, tampilkan empty state yang mengajak
mengetik nama masjid. Card masjid kehilangan field `capacity`/`cash`; badge
jarak (`distanceKm`) hanya muncul kalau data berasal dari `nearby`
(`distanceKm` optional di tipe). Tombol "Lihat Profil" mengarah ke
`/masjid/[id]` (rute baru, §4.3), tombol "Rute" tetap membuka Google Maps
via `latitude`/`longitude` (link `https://www.google.com/maps?q=lat,lng`),
bukan sekadar toast.

**Section `#daftar-masjid`**: Dialog registrasi inline diganti tombol yang
mengarah ke halaman penuh `/masjid/daftar` (§4.2) — form registrasi dengan
enam field plus validasi tidak muat nyaman di dialog, dan halaman terpisah
memudahkan menampilkan `duplicateWarning` dari response `201` sebagai daftar,
bukan cuma toast singkat. Kalau user belum login, tombol ini mengarah ke
`/login?redirect=/masjid/daftar` (pola redirect yang sudah ada di
`middleware/auth.ts`).

Section `#transparansi` (stat counter "240+ Masjid", "Rp 1,8M+ Kas") —
**dihapus seluruhnya**. Tidak ada satupun angka di sana yang berasal dari
data nyata atau modul manapun; ini murni dekorasi marketing tanpa sumber
data, dan mempertahankannya berarti mempertahankan klaim finansial palsu di
halaman publik.

### 4.2 `/masjid/daftar` — Registrasi Masjid (Modul 2 + 3)

Halaman baru, auth required (`middleware: 'auth'`, semua role boleh — PRD
§4.0: registrasi terbuka untuk "user manapun yang sudah login").

Form (`form` + `input` + `textarea` + `select` shadcn-vue):

- Nama masjid (`input`, wajib, 1-200 karakter — batas persis dari
  `createMosqueSchema` di `server/utils/validation.ts`)
- Alamat (`textarea`, wajib, 1-500 karakter)
- Province (`select`, dari `useRegions().listProvinces()`) → City (`select`,
  terisi ulang dari `useRegions().listCities(provinceId)` setiap Province
  berubah, disabled sampai Province dipilih)
- Latitude/Longitude (dua `input type="number"` step halus + tombol "Gunakan
  Lokasi Saya Sekarang", §3) — dikirim ke backend sebagai **string**
  ber-regex `^-?\d{1,3}\.\d{1,7}$` (lihat `latitudeSchema`/`longitudeSchema`
  di `validation.ts`), bukan number; form men-format nilai geolocation
  (yang berupa float presisi tinggi) ke maksimal 7 desimal sebelum submit.

Submit memanggil `POST /mosques` lewat `useMosqueRegistration().submit()`.
Response `201` membawa `duplicateWarning` (array, bisa kosong) — kalau tidak
kosong, halaman menampilkan `alert` (variant warning/secondary,
`--secondary-soft` per design system) berisi daftar masjid serupa yang
ditemukan (nama, alamat, jarak, similarity), **bukan blocking** — pendaftaran
tetap berhasil dan tersimpan dengan status `pending`; alert ini murni
informasi supaya pendaftar tahu ada kemungkinan duplikat, sesuai keputusan
"soft duplicate check" di §3.3 modul design doc. Setelah submit sukses,
redirect ke `/masjid/pendaftaran-saya`.

### 4.3 `/masjid/[id]` — Detail Masjid (Modul 4 + 6)

Halaman baru, publik (tanpa middleware). Data dari
`GET /mosques/:id` (Modul 4) — `404` dari backend (masjid tidak ada, belum
approved, atau soft-deleted, ketiganya identik) dirender sebagai halaman
"Masjid tidak ditemukan" standar, bukan dibedakan.

Konten: nama, alamat, koordinat (link Google Maps), lalu dua tab (`tabs`):

- **Jadwal Jumat** — `GET /mosques/:id/friday-schedule/current` untuk
  banner utama, `GET /mosques/:id/friday-schedule/history` (paginated,
  `pagination` shadcn-vue) di bawahnya untuk riwayat. Nama Person
  diresolusi sama seperti §4.1 lewat `GET /mosques/:id/people`.
- **Tentang** — alamat lengkap, link rute, dan (kalau `user.id ===
  mosque.adminUserId` atau `role === 'super_admin'`, §2.3) tombol "Kelola
  Masjid Ini" ke `/admin/masjid/[id]`.

### 4.4 `/masjid/pendaftaran-saya` — Status Pendaftaran Saya (Modul 3)

Halaman baru, auth required, semua role. Data dari
`GET /mosques/my-submissions`. Tabel (`table` shadcn-vue) dengan kolom nama
masjid, tanggal daftar, status (`badge` — `approved` pakai varian
sukses/primary-soft, `pending` pakai varian secondary-soft, `rejected`
pakai varian destructive-soft, tiga varian yang sudah didefinisikan di
design system §2.3). Baris `approved` punya link ke `/masjid/[id]`; baris
lain tidak (belum ada halaman publik untuk masjid yang belum disetujui,
sesuai aturan visibility Modul 4). Empty state kalau user belum pernah
mendaftar sama sekali, dengan CTA ke `/masjid/daftar`.

### 4.5 `/admin/pendaftaran` — Antrean Approval (Modul 3, Super Admin)

Halaman baru, `middleware: ['auth', 'require-role']`,
`requiredRoles: ['super_admin']`. Data dari `GET /mosques/pending`
(diurutkan terlama dulu, sesuai kontrak backend).

Tabel dengan kolom nama, alamat, tanggal submit, pendaftar. Setiap baris
punya dua tombol: **Setujui** dan **Tolak**, masing-masing membuka `dialog`
konfirmasi (mengikuti daftar komponen §4.3 di design system spec:
"`dialog` (konfirmasi approve/reject)"). Dialog Setujui memanggil
`PATCH /mosques/:id/approve`; dialog Tolak memanggil
`PATCH /mosques/:id/reject`. Kedua aksi menghapus baris dari tabel secara
optimis setelah sukses (tidak perlu refetch penuh) dan menampilkan toast
konfirmasi. Kalau masjid punya `duplicateWarning` yang tersimpan saat
submit — **catatan implementasi**: `GET /mosques/pending` per spec Modul 3
tidak mencantumkan field duplicateWarning dalam response `PendingMosqueSummary`
(hanya `id`, `name`, `address`, `createdAt`, `submittedBy`); jadi dialog
approve/reject **tidak** menampilkan riwayat duplicate check — ini
keterbatasan kontrak backend saat ini, dicatat di sini supaya implementer
plan Modul 3 tidak mencoba menambah field yang tidak ada.

### 4.6 `/admin/masjid/[id]` — Panel Kelola Masjid (Modul 5 + 6, Mosque Admin/Super Admin)

Halaman baru, `middleware: ['auth', 'require-role']`,
`requiredRoles: ['mosque_admin', 'super_admin']` di level middleware untuk
menolak `public_user` lebih awal; **kepemilikan spesifik** (`adminUserId`)
dicek di level halaman (§2.3) setelah data masjid dimuat via
`GET /mosques/:id` — kalau bukan pemilik dan bukan `super_admin`, redirect
ke `/masjid/[id]` dengan toast "Anda bukan pengelola masjid ini". Ini dua
lapis karena role saja tidak cukup (backend juga menegakkan
`requireMosqueOwner`, bukan cuma role).

Dua tab (`tabs`):

**Tab Person** (Modul 5):
- Tabel Person aktif (`GET /mosques/:id/people`), kolom nama + telepon.
- Tombol "Tambah Person" buka `dialog` berisi `form` (nama wajib, telepon
  opsional) → `POST /mosques/:id/people`.
- Aksi per baris via `dropdown-menu` (Edit, Hapus) — konsisten dengan daftar
  komponen di design system §4.3 ("`dropdown-menu` (aksi edit/hapus)").
  Edit buka `dialog` serupa form tambah, prefilled → `PATCH
  .../people/:personId`. Hapus buka `dialog` konfirmasi sederhana →
  `DELETE .../people/:personId`; baris hilang dari tabel setelah sukses
  (soft delete di backend, tapi UI memperlakukannya sebagai hilang permanen
  dari daftar aktif — tidak ada UI untuk melihat Person yang sudah dihapus
  di MVP ini, backend tidak menyediakan endpoint untuk itu).

**Tab Jadwal Jumat** (Modul 6):
- Card assignment saat ini (`GET .../friday-schedule/current`), tiga select
  Person (Khatib/Imam/Muazzin, masing-masing nullable, opsi dari daftar
  Person tab sebelah — **membaca data yang sama**, jadi tab Jadwal Jumat
  mem-fetch ulang `GET /mosques/:id/people` sendiri, bukan berbagi state
  reaktif lintas-tab, supaya tab bisa dibuka independen tanpa urutan
  ketergantungan).
- Kalau `has_assignment: false`: form "Buat Jadwal untuk Jumat
  [assignment_date]" langsung terisi tanggal itu (read-only, karena
  `assignmentDate` tidak bisa diubah setelah dibuat per spec Modul 6) →
  `POST /mosques/:id/friday-schedule`.
- Kalau `has_assignment: true`: form yang sama tapi mode edit (tanggal
  ditampilkan read-only, tiga select bisa diubah) →
  `PATCH .../friday-schedule/:assignmentId`. Response `403` (tanggal sudah
  lewat — bisa terjadi kalau admin membuka halaman ini persis melewati
  tengah malam WIB) ditangkap dan ditampilkan sebagai alert "Jadwal ini
  sudah lewat dan tidak bisa diubah", form disabled.
- Riwayat (`GET .../friday-schedule/history`, paginated) di bawah form,
  tabel read-only: tanggal, nama Khatib/Imam/Muazzin (diresolusi dari id).

## 5. Yang Tidak Diputuskan di Sini

- **Foto masjid** (`photoUrl` di `MosqueSummary`/`MosqueDetail`) — field ini
  ada di kontrak backend tapi tidak ada endpoint upload di modul manapun
  yang sudah dispesifikasikan (Modul 3 `createMosqueSchema` tidak punya
  field foto). UI menampilkan `photoUrl` kalau ada (selalu `null` untuk
  MVP ini), dengan placeholder ikon `Building2` kalau `null` — tidak ada
  form upload dibangun di lima plan implementasi modul ini.
- **Notifikasi real-time** status approval — di luar cakupan sesuai §2.5
  modul design doc; `/masjid/pendaftaran-saya` adalah satu-satunya cara
  pendaftar tahu statusnya, harus dicek manual (refresh halaman), tidak ada
  polling atau websocket.
- **Halaman 404/error kustom** — didelegasikan ke masing-masing plan modul
  saat momen itu muncul secara konkret (pola yang sama seperti didelegasikan
  di design system spec §5), bukan diputuskan menyeluruh di sini.

## 6. Status Persetujuan

Keputusan merombak `index.vue` (bukan membiarkannya sebagai mockup terpisah)
dan menghapus field finansial/kapasitas tanpa sumber data disetujui pemilik
produk pada 2026-08-25. Struktur rute (§2.4), pemisahan composable per
modul (§2.2), dan keputusan date-picker/peta (§3) adalah keputusan desain
teknis dalam dokumen ini — belum direview eksplisit oleh pemilik produk,
menunggu review spec ini sebelum lanjut ke penulisan plan implementasi.
