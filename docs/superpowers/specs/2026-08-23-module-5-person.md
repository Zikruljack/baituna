# Baituna — Modul 5: Person (Backend)

Tanggal: 2026-08-23
Status: siap diimplementasikan
Scope: CRUD penuh untuk master data Khatib/Imam/Muazzin per masjid. Tidak mencakup web atau Flutter.

Dokumen ini menjabarkan `docs/superpowers/specs/2026-08-23-baituna-modules-design.md` §2.2 dan §3.5 menjadi kontrak yang detail dan siap diimplementasikan. Keputusan bersama lintas modul ada di dokumen itu dan di `baituna-erd.md`; dokumen ini hanya menambah detail spesifik Modul 5.

## Tujuan

Menyediakan data Person yang reusable per masjid sehingga riwayat penugasan Jumat (Modul 6) bisa dilihat per orang, bukan per nama yang diketik ulang tiap minggu.

## Batasan

Termasuk:

- `GET /mosques/:id/people` — publik, daftar Person aktif.
- `POST /mosques/:id/people` — Mosque Admin.
- `PATCH /mosques/:id/people/:personId` — Mosque Admin.
- `DELETE /mosques/:id/people/:personId` — Mosque Admin, soft delete.

Tidak termasuk:

- Auto-create Person inline saat membuat Friday Assignment. Modul 6 hanya menerima `person_id` yang sudah ada, tidak pernah nama bebas — ini eksplisit demi mencegah duplikasi yang merusak tujuan "riwayat per orang".
- Perpindahan Person antar masjid. `people.mosque_id` diset saat create dan tidak pernah diubah oleh update.
- Endpoint baca lintas-masjid (mis. "semua Person milik Super Admin") — di luar scope MVP.

## Kontrak Data dan Aturan

**Kepemilikan per-mosque, bukan per-role.** Semua endpoint tulis memakai `requireMosqueOwner` (Modul 1) — Mosque Admin hanya bisa mengelola Person milik masjid yang dimilikinya sendiri.

**Delete adalah soft delete.** `DELETE` mengeset `deletedAt`/`deletedBy`, tidak pernah menghapus baris. Person yang sudah soft-delete tetap harus bisa di-resolve dengan benar kalau direferensikan oleh Friday Assignment lama (`khatibPersonId` dst. tidak memfilter `deletedAt`) — otomatis benar karena FK tidak difilter, tapi endpoint list (`GET .../people`) wajib mengecualikan baris yang soft-delete.

**Mismatch mosque = 404, bukan 403.** Kalau `personId` yang diminta ternyata milik masjid lain (bukan `:id` di URL), response tetap `404 Person not found` — bukan `403` — supaya keberadaan Person di masjid lain tidak bocor. Pengecekan `mosqueId` menyatu dalam query `WHERE` yang sama dengan pengecekan "ada tidaknya", bukan pengecekan terpisah setelah fetch by id saja.

## API

### `GET /mosques/:id/people`

Publik, tanpa auth. `:id` wajib UUID. Respons `200`:

```json
[{ "id": "uuid", "name": "Ustadz Fulan", "phone": "0812345" }]
```

Hanya Person aktif (`deletedAt IS NULL`), diurutkan `name` ascending.

### `POST /mosques/:id/people`

Auth: pemilik masjid. Body: `{ "name": "string, 1-200 karakter", "phone": "string maks 30 karakter atau null, opsional, default null" }`. Respons `201`: `PersonSummary` yang baru dibuat.

Error: `403` bukan pemilik masjid tersebut.

### `PATCH /mosques/:id/people/:personId`

Auth: pemilik masjid. Body: subset opsional `{ name?, phone? }`, minimal satu field. Respons `200`: `PersonSummary` terbaru.

Error: `403` bukan pemilik; `404` Person tidak ditemukan, sudah soft-delete, atau milik masjid lain (ketiganya identik).

### `DELETE /mosques/:id/people/:personId`

Auth: pemilik masjid. Respons `200`: `{ "id": "uuid" }`.

Error: `403` bukan pemilik; `404` sama seperti PATCH, termasuk kasus sudah dihapus sebelumnya (delete dua kali ditolak `404`, bukan idempoten diam-diam).

## Arsitektur

File baru: `apps/web/server/services/person.service.ts`.

```ts
type Database = NodePgDatabase<typeof schema>;
interface PersonSummary { id: string; name: string; phone: string | null }

function listActivePeople(db: Database, mosqueId: string): Promise<PersonSummary[]>;
function createPerson(db: Database, mosqueId: string, input: { name: string; phone: string | null }, actorId: string): Promise<PersonSummary>;
function updatePerson(
  db: Database, mosqueId: string, personId: string,
  updates: Partial<{ name: string; phone: string | null }>,
  actorId: string,
): Promise<PersonSummary>;
function deletePerson(db: Database, mosqueId: string, personId: string, actorId: string): Promise<{ id: string }>;
```

`createPerson`, `updatePerson`, `deletePerson` masing-masing membungkus tulisnya dalam `db.transaction()` dan memanggil `withAudit` (Modul 7) di dalamnya — pola yang sama persis dengan `mosque.service.ts` `createMosque`.

Route bertingkat di bawah direktori `mosques/[id]/` yang sudah ada dari Modul 3, menambah subdirektori baru `people/` — tidak ada file yang bentrok dengan file Modul 3 atau Modul 4 di direktori yang sama.

## Kualitas dan Keamanan

- `requireMosqueOwner(event, mosqueId)` untuk ketiga endpoint tulis; `GET` publik tanpa guard — sesuai tabel endpoint PRD §6 yang menandai `GET /mosques/:id/people` sebagai `Public`, berbeda dari tiga saudaranya.
- Input divalidasi Zod: `createPersonSchema`, `updatePersonSchema` (minimal satu field via `.refine`).
- Semua test butuh Postgres nyata (`describe.runIf(Boolean(process.env.DATABASE_URL))`) — CRUD Person tidak terpisahkan dari perilaku transaksional dan audit-writing, alasan yang sama seperti contoh kerja `createMosque` di Modul 7.
- Test eksplisit membuktikan: list mengecualikan soft-deleted; list tidak menampilkan Person masjid lain; update/delete Person lintas-masjid gagal (404); delete tidak benar-benar menghapus baris (masih bisa di-select langsung, hanya `deletedAt` terisi).

## Definition of Done

- Keempat endpoint mematuhi kontrak response dan status error di atas.
- `listActivePeople` terbukti mengecualikan baris soft-delete dan baris milik masjid lain.
- `updatePerson`/`deletePerson` terbukti mengembalikan `404` (bukan `403`) untuk Person milik masjid lain.
- `deletePerson` terbukti soft delete murni — baris tetap ada di database dengan `deletedAt`/`deletedBy` terisi.
- OpenAPI diperbarui untuk keempat path.
- Modul 6 (Friday Assignment) bisa mulai diimplementasikan setelah ini — plan Modul 6 mengasumsikan tabel `people` (bukan service ini) sudah cukup untuk validasi `person_id`, sehingga tidak hard-block pada urutan implementasi antara Modul 5 dan 6.
