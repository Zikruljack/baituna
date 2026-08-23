# Baituna — Modul 6: Friday Assignment (Backend)

Tanggal: 2026-08-23
Status: siap diimplementasikan
Scope: penugasan Khatib/Imam/Muazzin Jumat dan riwayatnya, dengan aturan read-only untuk entri yang tanggalnya sudah lewat. Tidak mencakup web atau Flutter.

Dokumen ini menjabarkan `docs/superpowers/specs/2026-08-23-baituna-modules-design.md` §3.6 menjadi kontrak yang detail dan siap diimplementasikan. Keputusan bersama lintas modul ada di dokumen itu dan di `baituna-erd.md`/`baituna-prd.md` §4.2; dokumen ini hanya menambah detail spesifik Modul 6.

## Tujuan

Mosque Admin menetapkan Khatib/Imam/Muazzin untuk Jumat mendatang; siapapun bisa melihat siapa petugas Jumat ini/berikutnya dan riwayat penugasan; entri yang tanggalnya sudah lewat tidak boleh diubah lagi — hanya bisa ditambah entri baru untuk minggu berikutnya.

## Batasan

Termasuk:

- `POST /mosques/:id/friday-schedule` — Mosque Admin, buat entri baru.
- `PATCH /mosques/:id/friday-schedule/:assignmentId` — Mosque Admin, hanya untuk entri yang tanggalnya belum lewat.
- `GET /mosques/:id/friday-schedule/current` — publik, "Jumat ini/berikutnya" dengan empty-state eksplisit.
- `GET /mosques/:id/friday-schedule/history` — publik, paginated.
- Perhitungan tanggal Jumat konsisten memakai timezone Asia/Jakarta (WIB).

Tidak termasuk:

- Library timezone (Luxon, date-fns-tz, dsb.). WIB adalah UTC+7 tetap tanpa DST sejak 1988 — offset konstan cukup dan lebih sederhana untuk diaudit ketimbang menambah dependency.
- Import `person.service.ts` (Modul 5) sebagai dependency kode. Modul ini membaca tabel `people` langsung lewat Drizzle untuk validasi `person_id`, sehingga tidak hard-block menunggu kode Modul 5 selesai di-merge — hanya butuh tabel `people` ada di schema, yang sudah ada.
- Mengizinkan `PATCH` mengubah `assignmentDate`. Mengoreksi tanggal berarti membuat entri baru, bukan memindahkan entri yang ada — `updateAssignmentSchema` sengaja tidak menerima field ini.

## Kontrak Data dan Aturan

**Satu entri = satu masjid + satu tanggal Jumat spesifik.** Constraint unique `(mosque_id, assignment_date)` sudah ada di `schema.ts`. Service layer wajib pre-check kombinasi ini dan mengembalikan `409` yang bersih, bukan membiarkan raw constraint violation bocor ke client.

**`assignmentDate` wajib hari Jumat.** Tanggal selain Jumat ditolak `422`.

**Entri dengan tanggal yang sudah lewat bersifat read-only permanen.** Tidak ada create, update, atau delete yang boleh menyasar tanggal sebelum "hari ini" di WIB. `PATCH` terhadap entri yang tanggalnya sudah lewat mengembalikan `403` — bukan `404` atau `422` — karena entri itu memang ada dan terlihat, hanya secara spesifik dilarang diubah.

**Perhitungan "hari ini" konsisten pakai Asia/Jakarta (WIB), dihitung di server.** Transisi ke Jumat berikutnya terjadi tepat 00:00 WIB setelah tanggal Jumat berjalan — bukan 00:00 UTC atau timezone klien.

**`current` tidak pernah 404 untuk empty-state.** Kalau belum ada entri untuk Jumat mendatang, response tetap `200` dengan bentuk `{ has_assignment: false, assignment_date: <tanggal Jumat berikutnya> }` — bentuk field ini (termasuk `assignment_date` snake_case khusus di cabang `false`) mengikuti contoh literal di PRD §4.2 apa adanya, bukan salah ketik yang perlu "diperbaiki" jadi `assignmentDate`.

**Setiap `person_id` yang dikirim harus milik masjid yang sama** dengan `:id` di URL. Person dari masjid lain ditolak `422`, dicek sebelum tulis apapun terjadi.

## API

### `POST /mosques/:id/friday-schedule`

Auth: pemilik masjid. Body:

```json
{
  "assignmentDate": "2099-01-02",
  "khatibPersonId": "uuid-atau-null",
  "imamPersonId": "uuid-atau-null",
  "muazzinPersonId": "uuid-atau-null"
}
```

Minimal satu dari tiga field person wajib non-null. Respons `201`: `AssignmentRecord` lengkap dengan `id`.

Error: `422` bukan hari Jumat, tanggal sudah lewat, atau ada `person_id` yang bukan milik masjid ini; `409` sudah ada entri untuk `(mosqueId, assignmentDate)` ini.

### `PATCH /mosques/:id/friday-schedule/:assignmentId`

Auth: pemilik masjid. Body: subset opsional `{ khatibPersonId?, imamPersonId?, muazzinPersonId? }`, minimal satu field, **tidak menerima `assignmentDate`**. Respons `200`: `AssignmentRecord` terbaru.

Error: `403` tanggal entri sudah lewat; `404` entri tidak ditemukan atau milik masjid lain; `422` ada `person_id` bukan milik masjid ini.

### `GET /mosques/:id/friday-schedule/current`

Publik. Respons `200`, salah satu dari dua bentuk:

```json
{ "has_assignment": true, "id": "uuid", "assignmentDate": "2099-02-06", "khatibPersonId": "uuid", "imamPersonId": null, "muazzinPersonId": null }
```

```json
{ "has_assignment": false, "assignment_date": "2026-08-28" }
```

### `GET /mosques/:id/friday-schedule/history`

Publik. Query: `page` (integer ≥1, default 1), `pageSize` (integer 1-100, default 20). Respons `200`:

```json
{
  "items": [{ "id": "uuid", "mosqueId": "uuid", "assignmentDate": "2099-03-13", "khatibPersonId": "uuid", "imamPersonId": null, "muazzinPersonId": null }],
  "page": 1,
  "pageSize": 20,
  "total": 5
}
```

Diurutkan `assignmentDate` descending (terbaru duluan).

## Arsitektur

File baru pertama: `apps/web/server/utils/wib-date.ts` — murni fungsi tanggal, tanpa akses database, supaya bisa diuji sangat exhaustive termasuk kasus batas tepat tengah malam WIB:

```ts
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function toWibDate(date: Date): Date; // shift Date supaya UTC getter-nya terbaca sebagai waktu WIB
function isFriday(isoDate: string): boolean; // isoDate format YYYY-MM-DD
function getCurrentOrNextFridayWib(now: Date): string; // YYYY-MM-DD
function isPastWib(isoDate: string, now: Date): boolean;
```

File kedua: `apps/web/server/services/friday-assignment.service.ts` (menggantikan stub kosong yang sudah ada):

```ts
type Database = NodePgDatabase<typeof schema>;

interface AssignmentInput { assignmentDate: string; khatibPersonId: string | null; imamPersonId: string | null; muazzinPersonId: string | null }
interface AssignmentRecord extends AssignmentInput { id: string; mosqueId: string }

function createAssignment(db: Database, mosqueId: string, input: AssignmentInput, actorId: string): Promise<AssignmentRecord>;
function updateAssignment(
  db: Database, mosqueId: string, assignmentId: string,
  updates: Partial<{ khatibPersonId: string | null; imamPersonId: string | null; muazzinPersonId: string | null }>,
  actorId: string,
): Promise<AssignmentRecord>;

type CurrentAssignment =
  | { has_assignment: true; id: string; assignmentDate: string; khatibPersonId: string | null; imamPersonId: string | null; muazzinPersonId: string | null }
  | { has_assignment: false; assignment_date: string };
function getCurrentAssignment(db: Database, mosqueId: string, now: Date): Promise<CurrentAssignment>;

interface PaginatedAssignments { items: AssignmentRecord[]; page: number; pageSize: number; total: number }
function listAssignmentHistory(db: Database, mosqueId: string, params: { page: number; pageSize: number }): Promise<PaginatedAssignments>;
```

`createAssignment` dan `updateAssignment` sama-sama memanggil helper internal `assertPersonIdsBelongToMosque` (tidak diekspor, dipakai ulang di dalam file yang sama) untuk validasi `person_id`, dan sama-sama membungkus tulisnya dalam `db.transaction()` + `withAudit` (Modul 7).

`getCurrentAssignment` menerima parameter `now: Date` secara eksplisit (bukan memanggil `new Date()` sendiri di dalam service) — route handler yang mengoper `new Date()` saat runtime, sementara test mengoper waktu tetap untuk hasil yang deterministik.

## Kualitas dan Keamanan

- `requireMosqueOwner(event, mosqueId)` untuk `POST` dan `PATCH`; `current` dan `history` publik tanpa guard, sesuai tabel endpoint PRD §6.
- Input divalidasi Zod: `createAssignmentSchema` (assignmentDate regex `YYYY-MM-DD`, minimal satu person id), `updateAssignmentSchema` (tanpa assignmentDate, minimal satu field), `historyQuerySchema` (page/pageSize dengan default dan batas).
- **Logic WIB adalah bagian paling berisiko di modul ini** — `wib-date.ts` diuji dengan 11 kasus untuk ±50 baris logic, termasuk kasus tepat pukul 00:00 WIB (bukan 00:00 UTC) sebagai titik paling rawan off-by-one.
- Test `createAssignment`/`updateAssignment` membuktikan: tanggal bukan Jumat ditolak; tanggal sudah lewat ditolak (masing-masing dengan status code berbeda: `422` untuk create, `403` untuk update terhadap entri yang tanggalnya sudah lewat saat pembuatan); `person_id` lintas masjid ditolak; duplikat `(mosque, date)` ditolak bersih tanpa membocorkan raw constraint error.
- Semua test butuh Postgres nyata (`describe.runIf(Boolean(process.env.DATABASE_URL))`), kecuali test `wib-date.ts` yang murni dan selalu jalan.

## Definition of Done

- Keempat endpoint mematuhi kontrak response dan aturan read-only di atas.
- `wib-date.ts` lulus 11 test termasuk kasus batas tepat 00:00 WIB.
- `createAssignment` menolak non-Jumat, tanggal lewat, person lintas-masjid, dan duplikat — masing-masing dengan status code yang benar.
- `updateAssignment` menolak entri yang tanggalnya sudah lewat dengan `403`, dan menolak entri milik masjid lain dengan `404`.
- `getCurrentAssignment` mengembalikan bentuk `has_assignment: false` yang persis sesuai PRD §4.2 saat tidak ada entri, dan `200` (bukan `404`) untuk kasus ini.
- `listAssignmentHistory` terbukti terurut descending dan pagination-nya bekerja.
- OpenAPI diperbarui untuk keempat path.
- Modul ini adalah modul backend terakhir dalam urutan dependensi — setelah ini, seluruh backend MVP (Modul 1-7) punya plan atau implementasi.
