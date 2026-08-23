# Baituna — Design System (Web)

Tanggal: 2026-08-23
Status: draft, menunggu review

Dokumen ini mendefinisikan sistem desain untuk `apps/web` — warna, tipografi,
spacing/layout, dan stack komponen. Ini bukan spec fitur; ia mendefinisikan
fondasi visual yang dipakai semua halaman publik dan admin. Requirement
produk ada di `docs/baituna-prd.md`, pemecahan modul di
`docs/superpowers/specs/2026-08-23-baituna-modules-design.md`.

## 1. Ringkasan

`apps/web` saat ini punya satu halaman kosong (`pages/index.vue`) tanpa
Tailwind, tanpa komponen, tanpa design token. Dokumen ini menetapkan:

1. Palet warna (light + dark), diverifikasi kontras WCAG AA
2. Sistem tipografi (skala, pasangan font, aturan pakai)
3. Stack komponen: **shadcn-vue** di atas Tailwind CSS v4 dan Reka UI
4. Spacing dan layout grid mengikuti konvensi standar Tailwind/shadcn — tidak
   ada skala kustom

Keputusan warna dan tipografi diambil lewat brainstorming interaktif dengan
perbandingan visual langsung (bukan swatch lepas), memakai konten Baituna
sungguhan (nama masjid Aceh, jadwal Jumat, antrean verifikasi).

## 2. Palet Warna

### 2.1 Sumber

Tiga warna inti diberikan oleh pemilik produk: Emerald `#0F5132` (primary),
Bronze `#C9A227` (secondary), Maroon `#7B1830` (destructive/alert). Dua
keputusan diambil di atasnya:

- **Netral krem, bukan abu-abu.** Off-white netral (`#F8F9FA`) dicoba dan
  ditolak — ia membuang kehangatan yang jadi alasan arah ini dipilih di
  awal, dan membuat bronze terlihat seperti tempelan di atas dasar yang
  suhunya berbeda. Netral final adalah krem hangat.
- **Bronze adalah warna aksen, bukan warna teks.** `#C9A227` di atas dasar
  terang mencapai kontras 2,4:1 terhadap putih — jauh di bawah ambang WCAG AA
  (4,5:1 untuk teks). Bronze dipakai untuk garis, badge, ikon; teks yang
  butuh nuansa bronze memakai turunan gelapnya, `#6B5312` (6,7:1, lolos AA).

### 2.2 Verifikasi Kontras

Semua rasio di bawah dihitung dengan formula kontras WCAG (relative
luminance), bukan diperkirakan. Skrip verifikasi ada di §7.

Dua warna gagal pada percobaan pertama dan diganti sebelum masuk dokumen ini:

| Token | Draf awal | Hasil uji | Final | Hasil uji final |
| --- | --- | --- | --- | --- |
| `--muted-foreground` (light) | `#6F6A5E` | 4,9:1 (marjinal) | `#655F53` | 5,8:1 |
| `--destructive` (dark) | `#C4536C` | 4,1:1 (gagal) | `#D2647C` | 5,0:1 |

### 2.3 Token — Light Mode

| Token | Hex | Kontras vs ground | Peran |
| --- | --- | --- | --- |
| `--background` | `#F7F4EE` | — | Dasar halaman |
| `--card` | `#FFFDF9` | — | Dasar kartu/panel |
| `--foreground` | `#1F1D18` | 15,3:1 | Teks utama |
| `--muted-foreground` | `#655F53` | 5,8:1 | Teks sekunder, keterangan |
| `--border` | `#E4DDCE` | — | Garis, pemisah |
| `--border-strong` | `#D2C8B3` | — | Garis tombol outline |
| `--primary` | `#0F5132` | 9,2:1 vs card | Tombol utama, link, identitas |
| `--primary-foreground` | `#FFFDF9` | — | Teks di atas primary |
| `--primary-soft` (accent bg) | `#DAE8DF` | — | Latar badge "disetujui" |
| `--secondary` | `#C9A227` | 2,4:1 — **aksen saja** | Garis kartu, badge, ikon |
| `--secondary-foreground` | `#6B5312` | 6,7:1 | Teks label bronze |
| `--secondary-soft` | `#F3E7C6` | — | Latar badge "pending" |
| `--destructive` | `#7B1830` | 10,3:1 vs card | Tolak, hapus, error, pengeluaran |
| `--destructive-foreground` | `#FFFDF9` | — | Teks di atas destructive |
| `--destructive-soft` | `#F0DADF` | — | Latar badge "duplikat" |

### 2.4 Token — Dark Mode

Dark mode **dirancang sebagai set terpisah**, bukan hasil membalik light
mode. Dua alasan konkret:

- Krem yang dibalik langsung menghasilkan cokelat kusam, bukan dasar gelap
  yang enak dipakai lama.
- `--primary` `#0F5132` di atas dasar gelap hanya mencapai 1,9:1 — praktis
  tidak terbaca. Dark mode memakai turunan yang lebih terang.

| Token | Hex | Kontras vs ground | Catatan |
| --- | --- | --- | --- |
| `--background` | `#1A1712` | — | Cokelat sangat gelap, bukan abu-abu — menjaga kehangatan krem tetap terasa |
| `--card` | `#221E18` | — | |
| `--foreground` | `#EFEAE0` | 14,9:1 | |
| `--muted-foreground` | `#A29A8B` | 6,4:1 | |
| `--border` | `#332E26` | — | |
| `--border-strong` | `#453E33` | — | |
| `--primary` | `#2E9E68` | 5,3:1 | Dinaikkan dari `#0F5132`; merek tetap `#0F5132` di light mode |
| `--primary-foreground` | `#0B1710` | — | |
| `--primary-soft` | `#1B3A2A` | — | |
| `--secondary` | `#D8B14A` | 2,4:1 — **aksen saja** | Dinaikkan dari `#C9A227`, masih bukan warna teks |
| `--secondary-foreground` | `#E3C169` | 10,3:1 | |
| `--secondary-soft` | `#3A2F16` | — | |
| `--destructive` | `#D2647C` | 5,0:1 | Dilembutkan dari `#7B1830` — versi pekat hampir hitam di atas dasar gelap |
| `--destructive-foreground` | `#1A0A0F` | — | |
| `--destructive-soft` | `#3B1C25` | — | |

### 2.5 Aturan Pakai (berlaku kedua tema)

| Warna | Dipakai untuk | Jangan dipakai untuk |
| --- | --- | --- |
| Primary (emerald) | Tombol utama, link, status "disetujui", identitas merek | Latar blok besar — terlalu pekat, bikin halaman berat |
| Secondary (bronze) | Garis aksen kartu, badge "pending", label "Jumat ini", ikon | Teks di atas terang, tombol berteks putih (gagal kontras) |
| Secondary-foreground | Teks yang perlu nuansa bronze (label, badge pending) | — |
| Destructive (maroon) | Tolak, hapus, peringatan duplikat, angka pengeluaran | Apa pun yang bukan kesalahan/uang keluar — jangan jadi dekorasi |

Lima warna cukup untuk MVP karena tiap warna punya satu tugas. Menambah
warna baru butuh alasan yang tidak bisa dipenuhi kombinasi di atas.

## 3. Tipografi

### 3.1 Keputusan

- **Murni Latin.** Tidak ada elemen Arab di UI — semua field nama (masjid,
  orang) bertipe `text` biasa di ERD. Tidak perlu font Arab.
- **Satu keluarga font, dua peran.** Inter Tight untuk heading, Inter untuk
  body/data. Alasan menolak dua keluarga berbeda: kehangatan sudah dibawa
  warna, huruf tidak perlu ikut "berbicara" — dan satu super-family lebih
  ringan (satu font vendor) dan otomatis serasi.
- **Grotesque, bukan serif.** Serif elegan (Fraunces/Lora) dipertimbangkan
  untuk kesan institusional, tapi ditolak: serif di ukuran kecil (badge,
  tabel admin padat) gampang terasa berat dan kurang tegas. Grotesque modern
  aman di semua ukuran, dari nama masjid besar sampai badge kecil.

### 3.2 Skala

| Peran | Font | Size / Weight | Letter-spacing | Contoh pakai |
| --- | --- | --- | --- | --- |
| Judul halaman | Inter Tight | 34px / 700 | -0.02em | Nama masjid di halaman detail |
| Judul seksi | Inter Tight | 24px / 650 | -0.015em | "Jadwal Jumat Ini" |
| Judul kartu | Inter Tight | 18px / 620 | -0.01em | "Antrean Pendaftaran" |
| Isi | Inter | 15px / 400 | normal | Alamat, deskripsi, paragraf |
| Label field | Inter | 13px / 500 | normal | "Khatib", "Status" |
| Eyebrow | Inter | 11px / 600 | 0.07em, kapital | "Jumat Ini · 29 Agustus 2026" |
| Data/angka | Inter | 13px / 500 | -0.005em, tabular-nums | Jarak, koordinat, jumlah pending |

### 3.3 Aturan Implementasi

- Hanya 6 berkas font perlu di-load: `Inter+Tight:wght@500;600;650;700` dan
  `Inter:wght@400;500;600`, dari Google Fonts.
- Data numerik (jarak, koordinat, tanggal, jumlah) selalu memakai
  `font-variant-numeric: tabular-nums` — bukan font monospace terpisah. Inter
  punya tabular figures bawaan, jadi tetap satu keluarga font di seluruh
  aplikasi.
- Judul kartu (nama masjid) memakai `text-wrap: balance` — nama masjid Aceh
  sering panjang (mis. "Masjid Jamik Al-Furqan Lambaro"), dan tanpa ini nama
  dua-baris bisa terpotong dengan satu kata sendirian di baris kedua.

## 4. Stack Komponen

### 4.1 Keputusan

**shadcn-vue** di atas **Tailwind CSS v4** dan **Reka UI** (fork Radix untuk
Vue). Bukan shadcn/ui React — itu tidak kompatibel dengan Nuxt/Vue. Filosofi
sama: komponen di-copy ke repo (lewat CLI `shadcn-vue`), bukan dependency
npm — jadi kode komponen ada di `apps/web/components/ui/` dan bisa diedit
bebas.

### 4.2 Spacing & Layout Grid

Mengikuti skala default Tailwind tanpa kustomisasi:

- Skala spacing: kelipatan `0.25rem` (Tailwind default) — `gap-2`, `p-4`,
  `space-y-6`, dst.
- Container: `max-w-7xl` untuk halaman lebar (daftar masjid, admin), `max-w-2xl`
  untuk form dan halaman baca (detail masjid, riwayat jadwal).
- Grid kartu masjid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, `gap-4`.
- Breakpoint: default Tailwind (`sm` 640px, `md` 768px, `lg` 1024px, `xl`
  1280px). Web harus responsive (PRD §5) — breakpoint `sm`/`md` menentukan
  transisi dari tampilan mobile ke desktop.
- Radius: `--radius: 0.625rem` (shadcn-vue default), dipakai lewat token
  `rounded-lg`/`rounded-md` bawaan, tidak didefinisikan ulang.

Tidak ada keputusan kustom di area ini — kalau kebutuhan spacing/layout
tertentu muncul saat implementasi modul, ikuti pola shadcn-vue yang sudah
berlaku di komponen sekitarnya.

### 4.3 Komponen yang Dipakai per Modul

Daftar ini menghubungkan modul dari `2026-08-23-baituna-modules-design.md`
ke komponen shadcn-vue standar yang relevan. Bukan daftar tertutup — modul
lain boleh menambah komponen standar lain saat diperlukan.

| Modul | Komponen shadcn-vue |
| --- | --- |
| Auth & RBAC | `button`, `input`, `label`, `card`, `alert` (pesan error login) |
| Mosque Search & Detail | `input` (search), `card`, `badge`, `skeleton` (loading), `separator` |
| Mosque Registration & Approval | `form`, `input`, `textarea`, `select`, `dialog` (konfirmasi approve/reject), `table`, `badge`, `alert` (peringatan duplikat) |
| Person | `table`, `dialog`, `form`, `input`, `dropdown-menu` (aksi edit/hapus) |
| Friday Assignment | `select` (pilih Person), `calendar` atau `input type=date`, `table`, `badge` |
| Layout umum (semua halaman) | `navigation-menu` atau custom header, `sonner` (toast notifikasi), `avatar` (profil user) |

### 4.4 Instalasi

Urutan setup, dieksekusi di implementation plan:

1. Tailwind CSS v4 + plugin Vite Nuxt (`@tailwindcss/vite`)
2. `shadcn-vue` CLI init — menghasilkan `components.json`, `app/assets/css/tailwind.css`
   dengan token dari §2.3–2.4, dan util `cn()` di `lib/utils.ts`
3. Komponen dasar via CLI: `button`, `input`, `label`, `card`, `badge`,
   `alert`, `separator`, `skeleton`, `table`, `dialog`, `form`, `select`,
   `dropdown-menu`, `sonner`, `avatar`
4. Google Fonts (§3.3) ditautkan di `nuxt.config.ts` via `app.head.link`,
   bukan `@import` di CSS — konsisten dengan cara Nuxt 4 mengelola head tags

## 5. Yang Tidak Diputuskan di Sini

- **Komponen kalender Friday Assignment** — apakah pakai `calendar` shadcn-vue
  penuh atau `input type="date"` sederhana. PRD tidak mensyaratkan date
  picker visual; keputusan ini didelegasikan ke implementation plan Modul 6
  saat halaman itu benar-benar dibangun, karena kebutuhannya baru jelas dari
  interaksi sungguhan.
- **Ikon** — belum ada keputusan pustaka ikon (lucide-vue-next adalah default
  shadcn-vue, kemungkinan besar dipakai apa adanya, tapi belum dikonfirmasi
  eksplisit ke pemilik produk).
- **Halaman error/empty state kustom** (404, empty state pencarian masjid
  kosong) — polanya mengikuti komponen standar yang sama, dirancang saat
  modul terkait dibangun, bukan di sini.

## 6. Status Persetujuan

Palet warna dan tipografi disetujui lewat brainstorming interaktif pada
2026-08-23, termasuk dua revisi warna di §2.2 setelah verifikasi kontras.
Stack komponen (shadcn-vue) dan spacing/layout (standar Tailwind) mengikuti
instruksi eksplisit pemilik produk — tidak ada kustomisasi yang perlu
persetujuan tambahan.

## 7. Verifikasi Kontras — Reproduksi

Skrip berikut mereproduksi tabel di §2.3–2.4 memakai formula kontras WCAG
2.x (relative luminance, sRGB):

```javascript
const lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contrastRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
```

Ambang: 4,5:1 untuk teks normal (WCAG AA), 3:1 untuk teks besar (≥24px atau
≥19px bold) dan elemen UI non-teks. `--secondary` sengaja di bawah ambang
karena dipakai hanya sebagai warna isian (border, badge background), tidak
pernah sebagai warna teks — lihat §2.5.
