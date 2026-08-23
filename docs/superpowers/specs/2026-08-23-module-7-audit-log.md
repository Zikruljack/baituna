# Baituna — Modul 7: Audit Log (Backend, Cross-Cutting)

Tanggal: 2026-08-23
Status: siap diimplementasikan
Scope: utility service yang dipanggil modul lain (3, 5, 6) pada setiap tulis. Tidak punya endpoint sendiri. Tidak mencakup web atau Flutter.

Dokumen ini menjabarkan `docs/superpowers/specs/2026-08-23-baituna-modules-design.md` §3.7 dan ERD §6.0 menjadi kontrak yang detail dan siap diimplementasikan. Keputusan bersama lintas modul (peran, aturan kepemilikan, soft delete) ada di dokumen itu dan di `baituna-erd.md`; dokumen ini hanya menambah detail spesifik Modul 7.

## Tujuan

Mengisi dua hal setiap kali sebuah baris di tabel bisnis dibuat, diubah, atau dihapus-lunak:

1. Kolom `history` (JSONB) milik baris itu sendiri — log diff append-only.
2. Tabel pusat `audit_logs` — satu baris per aksi, lintas semua tabel.

Modul ini bukan endpoint. Ia adalah lapisan yang dipanggil dari dalam transaksi service lain (Modul 3, 5, 6) tepat setelah tulis bisnisnya, sehingga penulisan bisnis dan penulisan audit sukses atau gagal bersama.

## Batasan

Termasuk:

- Fungsi pure `buildHistoryEntry` yang menghitung satu entri diff dari data lama/baru.
- Fungsi transaksional `withAudit` yang menulis `history` dan `audit_logs` dalam satu round-trip, memakai transaksi milik pemanggil.
- Satu contoh pemakaian nyata: `mosque.service.ts` `createMosque`, sebagai bukti kontrak transaksional benar-benar berjalan dan sebagai pola rujukan untuk Modul 3/5/6.
- Dokumentasi kontrak di `server/services/README.md` untuk penulis Modul 3/5/6.

Tidak termasuk:

- Postgres trigger function. ERD §6.0 menyebut trigger sebagai opsi, tetapi keputusan desain memilih application layer karena logic diff lebih mudah ditulis dan diuji di TypeScript. Konsekuensi yang diterima: raw query yang melewati service layer tidak akan teraudit.
- Endpoint HTTP untuk membaca `audit_logs`. Modul ini hanya menulis; expose baca (kalau dibutuhkan) adalah scope terpisah di luar MVP.
- Implementasi penuh Modul 3 (Registration & Approval) selain `createMosque`. Approve, reject, self-edit, dan my-submissions ada di plan Modul 3 sendiri.

## Kontrak Data

`history` per baris: array JSONB, default `'[]'`, append-only. Satu entri:

```json
{
  "action": "CREATE",
  "actorId": "uuid-atau-null",
  "at": "2026-08-23T10:00:00.000Z",
  "changes": {
    "name": { "old": null, "new": "Masjid A" },
    "status": { "old": null, "new": "pending" }
  }
}
```

Aturan pembentukan `changes`:

- `CREATE`: setiap field di `newData` dianggap berubah dari `null`.
- `DELETE`: setiap field di `oldData` dianggap berubah menjadi `null`. Perlu diingat: `DELETE` di sistem ini selalu soft delete (`UPDATE ... SET deleted_at = now()`), bukan `DELETE FROM` — nilai `action: 'DELETE'` menggambarkan niat bisnis, bukan jenis statement SQL yang dijalankan.
- `UPDATE`: hanya field yang nilainya benar-benar berbeda (dibandingkan lewat `JSON.stringify`) yang masuk `changes`. Field yang tidak berubah tidak muncul di objek `changes` sama sekali — bukan muncul dengan `old === new`.

`audit_logs` (sudah ada di `drizzle/schema.ts`, tidak perlu migration baru): `table_name`, `record_id`, `action` (enum `CREATE`/`UPDATE`/`DELETE`), `old_data` (JSONB nullable), `new_data` (JSONB nullable), `actor_id` (FK `users`, nullable untuk penulisan sistem).

## Arsitektur

File: `apps/web/server/services/audit.service.ts`. Tidak ada route.

```ts
type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

interface HistoryEntry {
  action: AuditAction;
  actorId: string | null;
  at: string;
  changes: Record<string, { old: unknown; new: unknown }>;
}

function buildHistoryEntry(
  action: AuditAction,
  actorId: string | null,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): HistoryEntry;

type Transaction = Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

type AuditableTable = PgTable & { id: { name: string }; history: { name: string } };

interface WithAuditParams<T extends AuditableTable> {
  table: T;
  tableName: string;       // nama tabel Postgres literal, mis. 'mosques'
  recordId: string;
  action: AuditAction;
  actorId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  currentHistory: unknown[]; // history milik baris SEBELUM entri ini ditambahkan
}

function withAudit<T extends AuditableTable>(tx: Transaction, params: WithAuditParams<T>): Promise<void>;
```

Poin desain penting:

- `withAudit` **tidak** membaca `history` saat ini dari database sendiri — pemanggil sudah punya baris di tangan (baru saja INSERT/UPDATE-nya) dan mengoper array yang sudah dibacanya lewat `currentHistory`. Ini menghindari satu `SELECT` ekstra per panggilan.
- `tableName` dioper eksplisit sebagai string, bukan diturunkan otomatis dari objek `table`. Drizzle 0.45 tidak punya API publik yang typed untuk membaca nama tabel SQL kembali dari referensi `PgTable` — mengandalkan detail internal berisiko rapuh di versi mendatang.
- `withAudit` wajib dipanggil dari dalam `db.transaction(async (tx) => ...)` milik pemanggil, tepat setelah tulis bisnisnya. Ia sendiri tidak pernah membuka transaksi baru.

Pola pemakaian (lihat `mosque.service.ts` `createMosque` untuk versi lengkap):

```ts
await db.transaction(async (tx) => {
  const [inserted] = await tx.insert(someTable).values({ ... }).returning();
  await withAudit(tx, {
    table: someTable,
    tableName: 'some_table_name',
    recordId: inserted.id,
    action: 'CREATE',
    actorId,
    oldData: null,
    newData: { ... },
    currentHistory: inserted.history as unknown[],
  });
  return inserted;
});
```

## Kualitas dan Keamanan

- Tidak ada role atau endpoint HTTP baru — modul ini tidak menambah permukaan serangan lewat network.
- `oldData`/`newData` tidak wajib memuat semua kolom — hanya field yang relevan ditampilkan di diff (skip kolom audit seperti `modifiedAt`). Pemanggil yang menentukan field mana yang masuk.
- Test `buildHistoryEntry` murni tanpa database (5 kasus: CREATE, UPDATE sebagian berubah, UPDATE tidak berubah, DELETE, actorId null). Test `withAudit` dan `createMosque` memakai `describe.runIf(Boolean(process.env.DATABASE_URL))` sehingga `npm test` tetap lulus tanpa Postgres, dan memverifikasi baris nyata (transaksi, rollback) saat `DATABASE_URL` tersedia.
- Trade-off yang diterima secara eksplisit: raw query yang bypass service layer tidak akan pernah teraudit. Ini bukan bug untuk di-workaround — ini konsekuensi dari memilih application layer di atas Postgres trigger.

## Definition of Done

- `buildHistoryEntry` dan `withAudit` diekspor dari `audit.service.ts` sesuai signature di atas.
- `mosque.service.ts` `createMosque` memanggil `withAudit` di dalam transaksi yang sama dengan `insert`, dan test membuktikan `history` bertambah 1 entri serta `audit_logs` bertambah 1 baris.
- `server/services/README.md` punya section "Module 7 — Audit Log" yang menjelaskan kontrak dan pola pemakaian untuk penulis Modul 3/5/6.
- Semua test lulus tanpa `DATABASE_URL` (bagian pure), dan lulus penuh saat `DATABASE_URL` tersedia (bagian transaksional).
- Tidak ada trigger Postgres, tidak ada endpoint baca `audit_logs`, tidak ada migration baru di luar yang sudah ada.
