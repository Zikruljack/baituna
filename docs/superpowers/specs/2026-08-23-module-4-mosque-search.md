# Baituna — Modul 4: Mosque Search & Detail (Backend)

Tanggal: 2026-08-23
Status: siap diimplementasikan
Scope: tiga endpoint publik tanpa login, rate limiting, dan OpenAPI. Tidak mencakup web atau Flutter.

Dokumen ini menjabarkan `docs/superpowers/specs/2026-08-23-baituna-modules-design.md` §3.4 menjadi kontrak yang detail dan siap diimplementasikan. Keputusan bersama lintas modul ada di dokumen itu dan di `baituna-erd.md`/`baituna-prd.md`; dokumen ini hanya menambah detail spesifik Modul 4.

## Tujuan

Memungkinkan Public User menemukan masjid tanpa login: berdasarkan lokasi (radius), berdasarkan kata kunci nama/alamat, dan melihat detail satu masjid. Modul ini tidak punya dependensi ke modul lain — bisa dikerjakan paralel dengan modul manapun.

## Batasan

Termasuk:

- `GET /mosques/nearby?lat&lng&radius` — bounding box pre-filter + Haversine presisi.
- `GET /mosques/search?q=` — pencarian nama/alamat, case-insensitive.
- `GET /mosques/:id` — detail satu masjid.
- Rate limit 60 request/menit per IP untuk `nearby` dan `search` (Nitro middleware, in-memory).
- OpenAPI, unit test.

Tidak termasuk:

- PostGIS. Keputusan desain final (PRD §4.1) memilih Haversine + bounding box karena skala data MVP (low-to-mid thousands masjid) masih aman tanpa ekstensi geo khusus.
- Endpoint tulis apapun terhadap `mosques` — itu Modul 3.
- Filter berdasarkan Province/City (bisa jadi peningkatan di luar MVP; Region Reference/Modul 2 hanya dipakai untuk validasi alamat saat registrasi, bukan filter search di modul ini).
- Rate limiter terdistribusi (Redis dsb.) — in-memory single-instance cukup untuk skala MVP; didokumentasikan sebagai batasan yang disengaja, bukan kelalaian.

## Kontrak Data dan Aturan

**Hanya masjid `status = 'approved'` yang pernah terlihat lewat ketiga endpoint ini.** Masjid `pending` atau `rejected` pada endpoint detail mengembalikan `404`, bukan `403` — keberadaannya tidak boleh terungkap ke publik.

**Haversine + bounding box, bukan PostGIS:**
1. Pre-filter kandidat di SQL: `WHERE lat BETWEEN .. AND lng BETWEEN ..` memakai kolom `latitude`/`longitude` biasa (tanpa index geo khusus).
2. Hitung jarak Haversine presisi di application code hanya untuk kandidat yang lolos filter, lalu urutkan ascending berdasarkan jarak.
3. Buang kandidat yang lolos bounding box (kotak) tapi di luar radius lingkaran sebenarnya (sudut kotak lebih jauh dari radius).

Soft delete: setiap query menambahkan `isNull(mosques.deletedAt)` selain filter `status = 'approved'`.

## API

### `GET /mosques/nearby`

Publik. Query params: `lat` (number, -90..90, wajib), `lng` (number, -180..180, wajib), `radius` (number, positif, maks 50, default 5, opsional).

Respons `200`:

```json
[
  {
    "id": "uuid",
    "name": "Masjid Raya Baiturrahman",
    "address": "Jl. Masjid Raya No. 1",
    "latitude": 5.5483,
    "longitude": 95.3238,
    "photoUrl": null,
    "distanceKm": 0.42
  }
]
```

Diurutkan `distanceKm` ascending. Array kosong jika tidak ada masjid dalam radius — bukan error.

### `GET /mosques/search`

Publik. Query param: `q` (string, trim, 1-200 karakter, wajib).

Respons `200`: array `MosqueSummary` yang sama seperti `nearby`, **tanpa** field `distanceKm`, diurutkan `name` ascending. Pencarian `ILIKE '%q%'` pada `name` OR `address`.

### `GET /mosques/:id`

Publik. `:id` wajib UUID.

Respons `200`:

```json
{
  "id": "uuid",
  "name": "Masjid Raya Baiturrahman",
  "address": "Jl. Masjid Raya No. 1",
  "latitude": 5.5483,
  "longitude": 95.3238,
  "photoUrl": null,
  "cityId": "uuid",
  "provinceId": "uuid",
  "status": "approved",
  "adminUserId": "uuid-atau-null"
}
```

`404 Mosque not found` jika ID tidak ada, tidak `approved`, atau soft-deleted — ketiga kasus ini diperlakukan identik agar status sebenarnya tidak bocor ke publik.

### Rate limit (semua endpoint publik `nearby`/`search`)

60 request/menit per IP (`X-Forwarded-For` dihormati). Response saat melebihi limit: `429 Too many requests`, body `{ "retryAfterMs": <number> }`.

## Arsitektur

File baru: `apps/web/server/services/mosque-search.service.ts` — terpisah dari `mosque.service.ts` (Modul 3/7) karena modul ini murni baca (`approved` saja), sementara `mosque.service.ts` menangani tulis dan alur approval. Pemisahan ini juga menghindari konflik file antar-plan.

```ts
type Database = NodePgDatabase<typeof schema>;

interface MosqueSummary {
  id: string; name: string; address: string;
  latitude: number; longitude: number; photoUrl: string | null;
  distanceKm?: number; // hanya ada dari findNearbyMosques
}

interface MosqueDetail {
  id: string; name: string; address: string;
  latitude: number; longitude: number; photoUrl: string | null;
  cityId: string; provinceId: string; status: 'approved'; adminUserId: string | null;
}

function findNearbyMosques(db: Database, params: { lat: number; lng: number; radiusKm: number }): Promise<MosqueSummary[]>;
function searchMosquesByKeyword(db: Database, keyword: string): Promise<MosqueSummary[]>;
function findApprovedMosqueById(db: Database, id: string): Promise<MosqueDetail | null>;
```

Rate limiter: `apps/web/server/middleware/rate-limit.ts`, fungsi pure `checkRateLimit(key, limit, windowMs)` (fixed-window, `Map` in-memory) yang bisa diuji tanpa H3 event, dipanggil dari default-export middleware yang hanya aktif untuk path `/api/mosques/nearby` dan `/api/mosques/search`.

`server/utils/validation.ts` bertambah `parseQuery` (mirror `parseBody`, pakai `getValidatedQuery`) — dipakai lagi oleh Modul 6 untuk endpoint history-nya, jadi ditulis sekali di sini.

## Kualitas dan Keamanan

- Tidak ada role atau auth guard — ketiga endpoint memang publik by design.
- Semua input query divalidasi Zod (`nearbyQuerySchema`, `searchQuerySchema`) sebelum menyentuh service.
- Unit test memakai `vi.mock('drizzle-orm', ...)` — logic Haversine dan keyword matching diuji murni di application layer tanpa Postgres, karena bentuk query-nya sederhana (tidak ada transaksi, tidak ada multi-table write). Verifikasi bounding-box SQL dan rate limit end-to-end dilakukan manual lewat `curl` terhadap dev server, bukan test otomatis DB-backed — didokumentasikan sebagai keputusan sadar, bukan celah.
- OpenAPI memuat parameter dan response code (`200`, `404`) untuk ketiga endpoint.

## Definition of Done

- Ketiga endpoint mematuhi kontrak response dan aturan `approved`-only di atas.
- `findNearbyMosques` diverifikasi dengan test yang membuktikan filter bounding-box-lalu-radius bekerja (kandidat di sudut kotak tapi di luar radius harus dibuang).
- Rate limit 60/menit/IP aktif hanya untuk `nearby` dan `search`, teruji dengan `checkRateLimit`.
- OpenAPI diperbarui, `curl http://localhost:3000/api/openapi.json` mengembalikan JSON valid.
- Tidak ada endpoint tulis, tidak ada dependensi PostGIS, tidak ada dependensi npm baru.
