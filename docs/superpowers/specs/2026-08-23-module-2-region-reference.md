# Baituna — Modul 2: Region Reference (Backend)

Tanggal: 2026-08-23  
Status: siap diimplementasikan  
Scope: backend API, database, seed, OpenAPI, dan test. Tidak mencakup web atau Flutter.

## Tujuan

Menyediakan referensi wilayah Aceh yang stabil untuk validasi alamat masjid pada modul berikutnya. Modul ini hanya membaca data: aplikasi MVP tidak boleh membuat, mengubah, atau menghapus Province maupun City lewat HTTP.

Modul ini menjadi sumber kebenaran untuk `mosques.province_id` dan `mosques.city_id`. Modul Registration & Approval wajib menolak pasangan wilayah yang tidak aktif atau tidak saling terkait.

## Batasan

Termasuk:

- Seed satu Province: `Aceh`.
- Seed 23 kabupaten/kota Aceh.
- `GET /api/provinces` dan `GET /api/provinces/:id/cities`.
- Constraint database, service layer, OpenAPI, unit test, dan verifikasi seed idempoten.

Tidak termasuk:

- Endpoint tulis Region, UI, Flutter, filter pencarian masjid, atau import data wilayah lain.
- Mukim: tabel dan relasinya tetap tidak disentuh pada MVP.
- Audit log aplikasi: Modul 7 menangani audit workflow bisnis. Seed reference data tidak menciptakan actor dan tidak menjadi alasan membangun Modul 7 lebih awal.

## Data Canonical

Seed menyimpan nama tanpa awalan `Kabupaten` atau `Kota`.

| Kelompok | Nama |
| --- | --- |
| Kabupaten (18) | Aceh Barat, Aceh Barat Daya, Aceh Besar, Aceh Jaya, Aceh Selatan, Aceh Singkil, Aceh Tamiang, Aceh Tengah, Aceh Tenggara, Aceh Timur, Aceh Utara, Bener Meriah, Bireuen, Gayo Lues, Nagan Raya, Pidie, Pidie Jaya, Simeulue |
| Kota (5) | Banda Aceh, Langsa, Lhokseumawe, Sabang, Subulussalam |

Endpoint menampilkan data alfabetis. Jenis kabupaten/kota tidak diperlukan pada MVP dan tidak ditambahkan ke schema.

## Kontrak Data dan Database

`provinces.name` unik secara global. `cities` unik pada pasangan `(province_id, name)`. Kedua constraint dibuat melalui migration Drizzle yang dihasilkan dari schema; migration tidak ditulis manual.

Pembacaan publik hanya mengembalikan `deleted_at IS NULL`. Seed tidak menghapus atau menimpa wilayah lain. Jika Region Aceh canonical pernah soft-delete, seed memulihkannya ke aktif.

Seed berjalan dalam satu transaksi dan idempoten:

- Run pertama membuat satu Province dan 23 City.
- Run berikutnya mempertahankan ID, memperbarui nama canonical bila diperlukan, dan memulihkan row canonical yang soft-delete.
- Seed tidak hard-delete atau menghapus City tambahan dari database.

## API

### `GET /api/provinces`

Publik tanpa autentikasi. Respons `200`:

```json
{ "data": [{ "id": "uuid", "name": "Aceh" }] }
```

Data diurutkan `name ASC`. Pagination tidak diperlukan karena MVP hanya memiliki satu Province; array dipertahankan untuk kompatibilitas wilayah lain kelak.

### `GET /api/provinces/:id/cities`

Publik tanpa autentikasi. `id` wajib UUID. Respons `200`:

```json
{ "data": [{ "id": "uuid", "name": "Banda Aceh", "provinceId": "uuid" }] }
```

City diurutkan `name ASC`. Province tidak ada atau soft-delete memberi `404 Province not found`; Province aktif tanpa City memberi `200` dengan `data: []`; UUID tidak valid memberi `400` dari validasi input.

## Arsitektur

Route hanya memvalidasi parameter, memanggil service, dan membentuk respons HTTP. Query serta aturan active-region berada di `apps/web/server/services/region.service.ts`.

Service mengekspor minimal:

```ts
type RegionDatabase = NodePgDatabase<typeof schema>;
type RegionOption = { id: string; name: string };
type CityOption = RegionOption & { provinceId: string };

listActiveProvinces(db: RegionDatabase): Promise<RegionOption[]>;
findActiveProvince(db: RegionDatabase, provinceId: string): Promise<RegionOption | null>;
listActiveCities(db: RegionDatabase, provinceId: string): Promise<CityOption[]>;
```

Route `/cities` memanggil `findActiveProvince` lebih dahulu agar `404` dapat dibedakan dari Province aktif tanpa City. `active` adalah generated column; service dan seed tidak boleh menulisnya.

Dataset berada pada konstanta TypeScript agar jumlah dan ejaannya diuji. Karena seed dijalankan Node 24 tanpa transpiler, import relatif dalam `seed-regions.ts` memakai ekstensi `.ts`, seperti seed Super Admin.

## Kualitas dan Keamanan

- Tidak ada role baru dan tidak ada guard auth untuk endpoint publik ini.
- Semua input URL divalidasi Zod; tidak ada interpolasi SQL.
- Test unit service/dataset tidak membutuhkan PostgreSQL; verifikasi seed nyata memakai Docker PostgreSQL lokal.
- OpenAPI memuat kedua endpoint, parameter UUID, serta respons `200`, `400`, dan `404` agar web/mobile kelak memakai kontrak yang sama.

## Definition of Done

- Migration generated hanya menambah unique constraints Region yang diperlukan.
- `npm run db:seed:regions` dua kali tetap menghasilkan 1 Province dan 23 City aktif.
- Kedua endpoint mematuhi kontrak, urutan, dan status error di atas.
- Unit test service/dataset, typecheck, lint, migration, seed idempotence, dan `git diff --check` lulus.
- Tidak ada route/UI/seed yang menyentuh `mukims` atau `mosques.mukim_id`.
