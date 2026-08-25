# Baituna — Desain Ulang MVP: Registrasi Publik, Dashboard Admin, Jadwal Jumat Jamak

Tanggal: 2026-08-25
Status: draft, menunggu review

## 0. Latar Belakang

Spec sebelumnya (`docs/superpowers/specs/2026-08-25-baituna-web-ui-design.md`)
sudah diimplementasikan penuh (index.vue rombak, `/masjid/daftar`,
`/masjid/[id]`, `/masjid/pendaftaran-saya`, `/admin/pendaftaran`,
`/admin/masjid/[id]`), lalu ditolak oleh pemilik produk setelah dicoba
langsung — alur dan tampilannya "terasa salah" untuk MVP, meski desainnya
sempat disetujui di sesi brainstorming sebelumnya. Dua masalah konkret yang
diidentifikasi di sesi ini:

1. Halaman utama tampil kosong total kalau browser menolak izin lokasi,
   walau ada 474 masjid `approved` di database — section "Sorotan Jadwal
   Jumat" dan "Eksplorasi Masjid Terdekat" sepenuhnya bergantung pada
   geolocation tanpa fallback.
2. Tidak ada dashboard admin sama sekali setelah login — baik
   `super_admin` maupun `mosque_admin` mendarat kembali di landing page
   publik, bukan ruang kerja terpisah.

Diskusi lanjutan membuka tiga perubahan alur yang lebih mendasar daripada
sekadar memperbaiki dua bug di atas:

- Pendaftaran masjid berubah dari "user login dulu, lalu isi form" menjadi
  **form publik yang sekaligus membuat akun** — pendaftar tidak perlu
  attempt akun terpisah, dan begitu masjidnya disetujui, akun itu otomatis
  naik jadi `mosque_admin` untuk masjid tersebut (mekanisme promosi ini
  **sudah ada** di backend, lihat §1.3).
- Dashboard admin jadi ruang kerja terpisah (sidebar sendiri), bukan
  extend dari landing page.
- Penugasan Khatib/Imam/Muazzin per-Jumat, yang sebelumnya sengaja dibatasi
  ke satu tanggal read-only ("Jumat ini/berikutnya" saja, tanpa date
  picker sama sekali), sekarang perlu bisa mengisi banyak Jumat ke depan
  lewat kalender, dengan minimal validasi "Jumat terdekat ke depan harus
  terisi".

Dokumen ini menggantikan §2.4 (struktur rute), §4.2 (halaman registrasi),
dan keputusan "tidak ada date picker" di §3 dari spec lama untuk area yang
disebutkan di atas. Bagian spec lama yang **tidak** disinggung di sini
(lapisan tipe API §2.1, pola pemanggilan API §2.2 secara umum, halaman
`/masjid/[id]` publik §4.3, `/admin/pendaftaran` sebagai konsep §4.5) tetap
berlaku — dokumen ini adalah **delta**, bukan spec pengganti penuh.

## 1. Perubahan Skema Data

### 1.1 Kolom Baru: Waktu Shalat Jumat

Tabel `mosques` (`drizzle/schema.ts`) mendapat satu kolom baru:

```ts
fridayPrayerTime: text('friday_prayer_time'), // "HH:mm", nullable
```

Nullable karena masjid yang sudah ada belum punya nilai. Disimpan sebagai
`text` format `"HH:mm"` (bukan `time` Postgres) — konsisten dengan pola
`assignmentDate` yang disimpan sebagai string ISO di lapisan API, dan
menghindari kerumitan timezone untuk field yang secara semantik adalah
"jam lokal masjid", bukan timestamp. Validasi format (`^([01]\d|2[0-3]):
[0-5]\d$`) di `updateMosqueSchema`.

**Bukan API waktu shalat otomatis** (mis. Kemenag/Aladhan) — didiskusikan
eksplisit dan disepakati sebagai perbaikan pasca-MVP, dicatat di §5 sebagai
tidak diputuskan di sini.

Field ini **per-masjid**, bukan per-assignment — diedit sekali di halaman
kelola masjid, berlaku untuk semua Jumat ke depan sampai diubah lagi.

### 1.2 Migrasi

Migrasi Drizzle baru menambah kolom nullable — tidak butuh backfill, tidak
breaking untuk data lama.

### 1.3 Yang Sudah Ada dan Dipakai Ulang (Tidak Berubah)

Ditemukan saat eksplorasi kode bahwa backend Modul 3 **sudah**
mengimplementasikan promosi otomatis submitter jadi `mosque_admin` saat
approve:

```ts
// server/services/mosque.service.ts, approveMosque()
await upgradeToMosqueAdmin(tx, submitterId, actorId);
await tx.update(mosques).set({ status: 'approved', adminUserId: submitterId })...
```

`upgradeToMosqueAdmin` (`server/services/user.service.ts`) sudah menolak
menaikkan user yang bukan `public_user` (no-op untuk `super_admin`, dan
per §2.3 di bawah ini `mosque_admin` existing tidak akan pernah sampai
sini karena §2.2 mencegahnya submit request kedua). Tidak ada perubahan
dibutuhkan di `approveMosque`/`upgradeToMosqueAdmin` — bagian yang hilang
murni di titik masuk: `createMosque` mewajibkan `actorId` yang sudah
login, dan tidak ada jalur untuk membuat `actorId` itu on-the-fly dari
form publik. §2 di bawah menutup celah ini.

`friday_assignments` juga **tidak berubah skemanya** — constraint unique
`(mosqueId, assignmentDate)` sudah mendukung banyak baris per masjid
dengan tanggal berbeda; batasan "hanya satu tanggal aktif" yang ada
sekarang murni di lapisan UI lama (§3 di bawah menggantinya).

## 2. Alur Registrasi Masjid: Publik + Auto-Account

### 2.1 Endpoint `POST /mosques` — Kontrak Baru

**Auth: dihapus.** Endpoint ini sekarang publik (tidak ada
`requireAuth`/token di request). Body menambah dua field akun di atas
field masjid yang sudah ada:

```ts
{
  name: string;       // nama masjid (sudah ada)
  address: string;    // (sudah ada)
  latitude: string;   // (sudah ada)
  longitude: string;  // (sudah ada)
  cityId: string;      // (sudah ada)
  provinceId: string;  // (sudah ada)
  submitterName: string;  // BARU — nama pendaftar, jadi users.name
  email: string;           // BARU
  password: string;        // BARU
}
```

Validasi baru di `server/utils/validation.ts`:

```ts
const emailProviderSchema = z
  .string()
  .email()
  .refine((value) => {
    const domain = value.split('@')[1]?.toLowerCase();
    return KNOWN_EMAIL_DOMAINS.has(domain ?? '');
  }, 'Gunakan email dari penyedia yang dikenal (Gmail, Yahoo, Outlook, dll.)');

const passwordSchema = z.string().min(8).max(72);

const KNOWN_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.id', 'outlook.com', 'hotmail.com',
  'icloud.com', 'proton.me', 'protonmail.com',
]);
```

Daftar domain adalah constant yang bisa diperluas tanpa migrasi — bukan
tabel database. `submitterName` wajib (1-200 karakter, pola sama dengan
`createMosqueSchema.name`) karena `users.name` adalah kolom `notNull()`.

### 2.2 Service `createMosque` — Kontrak Baru

Transaksi tunggal, urutan:

1. Validasi domain email (di layer Zod, sebelum masuk service).
2. Cek `users` untuk email yang sama (termasuk yang soft-deleted?
   **tidak** — `findUserByEmail` yang sudah ada mengecualikan
   `deletedAt`, konsisten dengan pola lain di sistem). Kalau ditemukan →
   `409 Conflict`, pesan: `"Email sudah terdaftar. Masuk ke akun Anda
   lalu ajukan pendaftaran masjid dari sana."` — **tidak** menempelkan
   mosque baru ke akun existing, supaya invarian "1 akun mengelola
   maksimal 1 masjid" (§2.3) tidak bisa dilanggar lewat jalur registrasi
   publik.
3. `hashPassword(password)` (fungsi sudah ada, `server/services/
   password.ts`).
4. Insert `users`: `{ name: submitterName, email, passwordHash,
   provider: 'local', role: 'public_user' }`.
5. Insert `mosques` seperti alur lama, `createdBy` = id user baru.
6. `checkForDuplicate` (sudah ada) tetap jalan setelah commit, non-blocking,
   dikembalikan di response.
7. `signAuthToken({ sub: newUser.id, role: 'public_user' }, jwtSecret)` —
   dibuat di luar transaksi DB (tidak butuh DB), tapi sebelum response.

Response `201` baru:

```ts
{
  id: string;
  name: string;
  status: 'pending';
  duplicateWarning: DuplicateCandidate[];
  token: string;                                    // BARU
  user: { id: string; name: string; email: string; role: 'public_user' }; // BARU
}
```

Bentuk `token`/`user` sengaja identik dengan `AuthResponse` yang sudah
dipakai `useAuth().setSession()` — frontend memakai ulang fungsi itu tanpa
perlu tipe baru.

### 2.3 Invarian "1 Akun = 1 Masjid" — Ditegakkan di Mana

Diputuskan eksplisit: MVP ini **tidak** mendukung satu akun mengelola
banyak masjid. Ditegakkan di dua titik:

- **Registrasi publik (§2.2 langkah 2)**: email yang sudah terdaftar
  ditolak sebelum bisa membuat submission kedua.
- **Registrasi oleh user yang sudah login** — kasus ini **masih ada**:
  endpoint yang sama (`POST /mosques`, sekarang publik) tetap bisa
  dipanggil oleh browser yang membawa cookie token (token opsional,
  bukan diabaikan). Kalau request datang dengan token valid milik user
  yang **sudah** `mosque_admin` (mengelola masjid lain), tolak dengan
  `403`: `"Akun Anda sudah menjadi admin masjid lain. Satu akun hanya
  bisa mengelola satu masjid."` Kalau token valid tapi masih
  `public_user` (sudah pernah daftar tapi belum diapprove, atau memang
  belum pernah daftar), request diteruskan tapi field `email`/`password`
  di body **diabaikan** — service memakai `createdBy` dari token, bukan
  membuat user baru (mencegah kasus user submit form daftar kedua kalinya
  saat sudah login, yang akan menghasilkan mosque baru tapi email
  berbeda dari akun aktifnya, atau clash email).

Ini berarti `createMosque` punya dua mode input tergantung ada/tidaknya
token valid pada request — didokumentasikan sebagai keputusan sadar
(bukan cabang tersembunyi) supaya implementer tidak menghapusnya sebagai
"dead code" saat menulis endpoint.

### 2.4 Halaman `/masjid/daftar` — Kontrak Baru

`middleware: 'auth'` **dihapus** — halaman ini publik. Form (§4.2 spec
lama tetap berlaku untuk field masjid) menambah dua field baru: Email
(`input type="email"`), Kata Sandi (`input type="password"`, dengan teks
bantu "Minimal 8 karakter"). Field "Nama Pendaftar" (`submitterName`)
ditambah di atas form, sebelum field masjid.

**Kalau user membuka halaman ini dalam keadaan sudah login** (auth
token ada): form field Email/Kata Sandi/Nama Pendaftar **disembunyikan**
(bukan disabled — dihapus dari DOM), karena backend akan pakai identitas
dari token (§2.3). Alert kecil di atas form: `"Anda mendaftar sebagai
[nama user login]"`.

Setelah submit sukses:
- Kalau response membawa `token`/`user` baru (kasus publik, §2.2) →
  panggil `useAuth().setSession({ token, user })` untuk membuat sesi baru
  di browser.
- Kalau user sudah login sebelumnya (kasus §2.3 lanjutan) → tidak ada
  `setSession` (sesi sudah ada).
- Kedua kasus lanjut redirect ke `/masjid/pendaftaran-saya`, sama seperti
  spec lama.

`duplicateWarning` di response ditampilkan sama seperti spec lama (§4.2
lama, alert non-blocking).

## 3. Dashboard & Layout Admin

### 3.1 Layout Baru: `layouts/admin.vue`

Sidebar kiri tetap (logo Baituna kecil, menu navigasi vertikal sesuai
role — §3.2, footer sidebar berisi nama+role user aktif dan tombol
Keluar) + area konten kanan (`<slot />`, padding standar). Terpisah total
dari `AppHeader.vue` — tidak ada elemen bersama, karena tujuannya memang
terasa sebagai "ruang kerja" berbeda dari landing page publik (keputusan
eksplisit, bukan default framework).

Dipakai lewat `definePageMeta({ layout: 'admin' })` di setiap halaman
admin.

### 3.2 Menu Sidebar per Role

| Role | Menu |
| --- | --- |
| `super_admin` | Antrean Approval (`/admin/pendaftaran`) |
| `mosque_admin` | Ringkasan (`/dashboard`), Person (`/admin/masjid/[id]?tab=person`), Jadwal Jumat (`/admin/masjid/[id]?tab=jadwal`) |

Daftar menu `super_admin` sengaja pendek untuk MVP ini (YAGNI — hanya
satu tugas yang sudah ada endpoint-nya). Menambah item baru ("Semua
Masjid", "Semua User", dll.) didelegasikan ke saat kebutuhan itu muncul
konkret dengan endpoint pendukungnya, bukan diantisipasi di sini.

### 3.3 Redirect Setelah Login — Berdasar Role

`pages/login.vue` (dan callback Google OAuth `pages/auth/callback.vue`)
mengganti `await navigateTo('/')` yang sekarang unconditional menjadi:

```ts
const target =
  user.value?.role === 'super_admin' ? '/admin/pendaftaran' :
  user.value?.role === 'mosque_admin' ? '/dashboard' :
  redirectQuery.value ?? '/';
await navigateTo(target);
```

`redirectQuery` (dari `?redirect=` yang sudah dipakai `middleware/auth.ts`)
tetap dihormati untuk `public_user` — kasus "coba akses halaman auth-only,
dilempar ke login, lalu balik ke halaman asal" tidak berubah. Untuk
`super_admin`/`mosque_admin`, redirect ke dashboard mereka selalu
menang atas `?redirect=` — rasionalnya: admin yang baru login hampir
selalu ingin melihat ruang kerja mereka, bukan halaman publik acak yang
kebetulan memicu prompt login.

### 3.4 Halaman Baru: `/dashboard` (Mosque Admin)

`definePageMeta({ middleware: ['auth', 'require-role'], requiredRoles:
['mosque_admin'], layout: 'admin' })`. `super_admin` **tidak** diarahkan
ke sini (§3.3) — kalau `super_admin` membuka `/dashboard` manual, halaman
tetap menampilkan (role cocok dengan `requireMosqueOwner`-style check di
bawah), tapi ini bukan jalur normal.

Data: `GET /mosques` difilter `adminUserId = user.id` (endpoint baru
sederhana **atau**, lebih murah, tambahkan `GET /mosques/my-mosque` yang
mengembalikan satu record — mosque_admin per definisi §2.3 hanya pernah
punya nol atau satu masjid terkait). Pilihan: `GET /mosques/my-mosque`,
karena bentuk responnya (satu objek atau `null`, bukan array) langsung
mencerminakan invarian 1:1 dan menghindari halaman harus menangani "array
kosong vs array banyak" yang menurut §2.3 tidak akan pernah terjadi.

Konten:
- Kalau `my-mosque` mengembalikan `null` (kasus race: user baru saja
  register tapi belum diapprove, sehingga belum resmi `mosque_admin` —
  seharusnya tidak tercapai karena middleware role sudah menyaring
  `public_user`, tapi dijaga untuk konsistensi) → redirect ke `/masjid/
  pendaftaran-saya`.
- Kartu ringkasan (grid 2 kolom): "Jumlah Pengurus Terdaftar" (`count`
  dari `GET /mosques/:id/people`), "Status Jumat Depan" (badge:
  "Terisi"/"Belum Diisi" dari `GET /mosques/:id/friday-schedule/current`
  `has_assignment`).
- Dua tombol shortcut besar: "Kelola Person" → `/admin/masjid/[id]?
  tab=person`, "Kelola Jadwal Jumat" → `/admin/masjid/[id]?tab=jadwal`.

### 3.5 `/admin/masjid/[id]` — Dibungkus Layout Admin

Perubahan dari spec lama: `definePageMeta` menambah `layout: 'admin'`.
Tab dikontrol lewat query param `?tab=person|jadwal` (bukan hanya state
lokal `tabs` tanpa URL) supaya shortcut dari `/dashboard` (§3.4) bisa
langsung membuka tab yang benar. Sisanya (dua tab Person + Jadwal Jumat,
pengecekan kepemilikan `adminUserId === user.id`) mengikuti spec lama
§4.6, kecuali tab Jadwal Jumat yang dirombak di §4 berikut.

### 3.6 `/admin/pendaftaran` — Dibungkus Layout Admin

Sama seperti §3.5: tambah `layout: 'admin'` di `definePageMeta`. Konten
tabel approval tidak berubah dari spec lama §4.5.

## 4. Jadwal Jumat: Dari Read-Only Tunggal ke Kalender Multi-Tanggal

### 4.1 Kenapa Berubah

Spec lama (§3) sengaja menghilangkan semua date picker karena backend
"hanya pernah punya satu tanggal yang bisa dibuat" — ini benar untuk
`getCurrentAssignment` (selalu mengacu ke satu tanggal terdekat), tapi
**salah dibaca** sebagai batasan `createAssignment`/`updateAssignment`,
yang sebenarnya menerima `assignmentDate` apa pun asal Jumat dan bukan
masa lalu (`isFriday`, `isPastWib` di `server/utils/wib-date.ts`), dan
constraint unique DB hanya mencegah dua assignment di tanggal yang sama
per masjid — tidak ada batasan "hanya boleh satu assignment aktif".
Kebutuhan mengisi beberapa Jumat ke depan sekaligus sudah bisa dilayani
backend tanpa perubahan; hanya UI lama yang membatasi diri lebih ketat
dari kontraknya.

### 4.2 Komponen Baru: `calendar` (shadcn-vue)

Sudah diantisipasi sebagai opsi di design system asli (§4.3:
"`calendar` atau `input type=date`"). Ditambahkan ke
`components/ui/calendar/`.

### 4.3 Tab "Jadwal Jumat" — Struktur Baru

Menggantikan §4.6 bagian "Tab Jadwal Jumat" dari spec lama:

**Baris atas — Info Waktu Shalat**: teks read-only "Shalat Jumat dimulai
pukul **[fridayPrayerTime atau 'Belum diatur']**" + tombol pensil kecil
yang membuka `dialog` dengan satu `input type="time"` → `PATCH /mosques/
:id` dengan body `{ fridayPrayerTime }` (field baru di
`updateMosqueSchema`, §1.1). Terpisah total secara UI dari kalender di
bawahnya — mengedit ini tidak menyentuh assignment mana pun.

**Kalender**: komponen `calendar` dikonfigurasi `disabled` untuk semua
tanggal yang bukan hari Jumat (`date.getDay() !== 5`) dan semua tanggal
sebelum hari ini (WIB). Setiap sel tanggal Jumat yang **punya**
assignment (dicek dari `GET .../friday-schedule/history` dengan
`pageSize` besar cukup untuk mengambil semua assignment ke depan yang
relevan — riwayat sudah paginated tapi rentang "beberapa bulan ke depan"
kecil, jadi satu halaman besar cukup, bukan perlu endpoint baru) diberi
dot indicator hijau kecil di bawah angka tanggal.

**Banner peringatan** di atas kalender: kalau assignment untuk
`getCurrentOrNextFridayWib(now)` (port client-side yang sudah dipakai di
spec lama untuk index.vue, dipakai ulang di sini) tidak ada di data
history/current → tampil `alert` variant warning: "Jadwal Jumat depan
([tanggal]) belum diisi." Klik banner scroll+select tanggal itu di
kalender (kemudahan, bukan navigasi terpisah).

**Klik tanggal Jumat di kalender** → panel form di bawah kalender
(bukan dialog terpisah — form dan kalender terlihat bersamaan supaya
admin bisa lihat konteks minggu-minggu sekitarnya sambil mengisi):
- Kalau tanggal itu sudah punya assignment (dari data yang sama dipakai
  dot indicator) → mode edit, 3 `select` Person prefilled →
  `PATCH .../friday-schedule/:assignmentId`. Tanggal ditampilkan
  read-only (sesuai aturan lama: `assignmentDate` tidak bisa diubah
  setelah dibuat).
- Kalau belum → mode create, 3 `select` Person kosong → `POST .../
  friday-schedule` dengan `assignmentDate` dari tanggal yang diklik.
- Response `403` (tanggal sudah lewat — race condition lintas tengah
  malam WIB, sama seperti spec lama) → alert, form disabled, kalender
  otomatis menandai ulang tanggal itu sebagai disabled (refetch state
  "hari ini" WIB).

Submit sukses (create maupun update) → refetch data assignment (untuk
update dot indicator kalender dan banner peringatan), tidak optimistic
update manual (dot indicator butuh data konsisten dengan kalender, lebih
aman refetch daripada mengelola state kalender secara manual).

**Riwayat** (tabel di bawah form, paginated) — tidak berubah dari spec
lama, tetap menampilkan assignment yang tanggalnya sudah lewat.

### 4.4 Tidak Ada Validasi Blocking untuk "Minimal 1 Jumat Terisi"

Diputuskan eksplisit: banner peringatan (§4.3) adalah **nudge**, bukan
hard block. Tidak ada endpoint atau state yang mencegah admin
meninggalkan halaman tanpa mengisi Jumat depan — MVP ini tidak
menambahkan mekanisme enforcement (reminder email, cron job, dsb.);
kalau dibutuhkan nanti itu perubahan terpisah, dicatat di §5.

## 5. Yang Tidak Diputuskan di Sini

- **API waktu shalat otomatis** (Kemenag/Aladhan) menggantikan input
  manual `fridayPrayerTime` — didiskusikan, disepakati sebagai perbaikan
  pasca-MVP, tidak dirancang di sini.
- **Reminder/enforcement** kalau Jumat depan belum diisi (email,
  notifikasi, cron) — di luar cakupan, §4.4.
- **Satu akun mengelola banyak masjid** — eksplisit ditolak untuk MVP ini
  (§2.3); kalau dibutuhkan nanti, ini perubahan skema (`admin_user_id` di
  `mosques` perlu jadi tabel junction), bukan penambahan kecil.
- **Reset password / lupa password** untuk akun yang dibuat lewat alur
  registrasi masjid — belum ada mekanisme ini di sistem sama sekali
  (di luar scope dokumen ini, berlaku juga untuk akun Google/local yang
  sudah ada).
- **Fallback index.vue saat geolocation ditolak** (masalah #1 di §0) —
  diakui sebagai bug nyata yang perlu diperbaiki, tapi perbaikannya
  (mis. fallback ke daftar masjid terbaru/nearby-tanpa-lokasi) adalah
  perubahan lokal ke `index.vue` yang tidak bergantung pada apa pun di
  dokumen ini — didelegasikan ke implementation plan sebagai task
  terpisah dari tiga perubahan besar di atas, bukan diabaikan.

## 6. Status Persetujuan

Semua bagian (§1 skema, §2 alur registrasi, §3 dashboard & layout, §4
kalender jadwal Jumat) dipresentasikan section-by-section dan disetujui
pemilik produk pada 2026-08-25 dalam sesi brainstorming ini.
