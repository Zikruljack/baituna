<script setup lang="ts">
import { ref, computed } from 'vue';
import { toast } from 'vue-sonner';
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Building2,
  Users,
  Compass,
  ShieldCheck,
  Coins,
  Filter,
  PlusCircle,
} from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';

// State
const searchQuery = ref('');
const selectedLocation = ref('Semua');

const locations = ['Semua', 'Baiturrahman', 'Lueng Bata', 'Kuta Alam', 'Ulee Kareng', 'Aceh Besar'];

const mosques = [
  {
    id: 1,
    name: 'Masjid Raya Baiturrahman',
    location: 'Baiturrahman, Banda Aceh',
    address: 'Jl. Moh. Jam No.1, Kp. Baru, Banda Aceh',
    distance: '0.8 km',
    capacity: '24.000 Jamaah',
    status: 'approved',
    verified: true,
    fridaySchedule: {
      date: 'Jumat, 29 Agustus 2026',
      time: '12:30 WIB',
      khatib: 'Prof. Dr. Tgk. H. Muslim Ibrahim, MA',
      khatibTitle: 'Guru Besar UIN Ar-Raniry',
      imam: 'Tgk. H. Jamhuri Ramli, SQ',
      muadzin: 'Ust. M. Rizal',
      topic: 'Menjaga Persaudaraan dan Ketenteraman Umat Menjelang Ramadhan',
    },
    facilities: ['Ramah Disabilitas', 'Parkir Luas', 'AC Penuh', 'Kubah Payung Elektrik'],
    cash: 'Rp 248.500.000',
  },
  {
    id: 2,
    name: 'Masjid Oman Al-Makmur',
    location: 'Kuta Alam, Banda Aceh',
    address: 'Jl. Teuku Nyak Arief, Bandar Baru, Lampriet',
    distance: '2.1 km',
    capacity: '4.500 Jamaah',
    status: 'approved',
    verified: true,
    fridaySchedule: {
      date: 'Jumat, 29 Agustus 2026',
      time: '12:30 WIB',
      khatib: 'Dr. Tgk. H. Syamsul Rijal, M.Ag',
      khatibTitle: 'Cendekiawan & Tokoh Dayah Aceh',
      imam: 'Ust. H. Munawir Darwis',
      muadzin: 'Ust. Fadhil',
      topic: 'Adab dan Keutamaan Menuntut Ilmu Syar\'i',
    },
    facilities: ['AC Penuh', 'Parkir Luas', 'Tempat Wudhu Bersih'],
    cash: 'Rp 86.400.000',
  },
  {
    id: 3,
    name: 'Masjid Jamik Lueng Bata',
    location: 'Lueng Bata, Banda Aceh',
    address: 'Jl. Tgk Chik Di Tiro, Lueng Bata, Banda Aceh',
    distance: '2.4 km',
    capacity: '3.000 Jamaah',
    status: 'approved',
    verified: true,
    fridaySchedule: {
      date: 'Jumat, 29 Agustus 2026',
      time: '12:30 WIB',
      khatib: 'Tgk. H. Faisal Ali',
      khatibTitle: 'Ketua MPU Aceh',
      imam: 'Tgk. M. Yusuf Lamteuba',
      muadzin: 'Ust. Syahril',
      topic: 'Pentingnya Menjaga Kesucian Harta dan Muamalah',
    },
    facilities: ['Parkir Luas', 'Tempat Wudhu Bersih'],
    cash: 'Rp 42.120.000',
  },
  {
    id: 4,
    name: 'Masjid Haji Keuchik Leumiek',
    location: 'Lueng Bata, Banda Aceh',
    address: 'Lamseupeung, Lueng Bata, Banda Aceh',
    distance: '3.2 km',
    capacity: '2.000 Jamaah',
    status: 'approved',
    verified: true,
    fridaySchedule: {
      date: 'Jumat, 29 Agustus 2026',
      time: '12:30 WIB',
      khatib: 'Dr. Tgk. H. M. Yasir, MA',
      khatibTitle: 'Dosen Pascasarjana UIN',
      imam: 'Ust. Zulkifli Harun',
      muadzin: 'Ust. Ridwan',
      topic: 'Meneladani Akhlak Generasi Salafus Shalih',
    },
    facilities: ['AC Penuh', 'Arsitektur Timur Tengah', 'Taman Nyaman'],
    cash: 'Rp 31.800.000',
  },
  {
    id: 5,
    name: 'Masjid Babussalam Lamteumen',
    location: 'Baiturrahman, Banda Aceh',
    address: 'Lamteumen Barat, Kec. Jaya Baru, Banda Aceh',
    distance: '3.8 km',
    capacity: '2.500 Jamaah',
    status: 'approved',
    verified: true,
    fridaySchedule: {
      date: 'Jumat, 29 Agustus 2026',
      time: '12:30 WIB',
      khatib: 'Tgk. H. Kamaruzzaman',
      khatibTitle: 'Pimpinan Dayah Darul Ulum',
      imam: 'Ust. Muhammad Rizki',
      muadzin: 'Ust. Ilham',
      topic: 'Membina Keluarga Sakinah dan Generasi Qur\'ani',
    },
    facilities: ['Parkir Luas', 'Tempat Wudhu Bersih'],
    cash: 'Rp 19.500.000',
  },
  {
    id: 6,
    name: 'Masjid Al-Furqan Lambaro',
    location: 'Aceh Besar',
    address: 'Jl. Soekarno-Hatta, Lambaro, Ingin Jaya, Aceh Besar',
    distance: '5.1 km',
    capacity: '3.500 Jamaah',
    status: 'approved',
    verified: true,
    fridaySchedule: {
      date: 'Jumat, 29 Agustus 2026',
      time: '12:30 WIB',
      khatib: 'Tgk. H. Masrul Aidi, Lc',
      khatibTitle: 'Pimpinan Pesantren Babul Maghfirah',
      imam: 'Tgk. Bukhari',
      muadzin: 'Ust. Naufal',
      topic: 'Tanggung Jawab Sosial Umat Islam di Era Modern',
    },
    facilities: ['Parkir Luas', 'Akses Mudah Jalur Provinsi'],
    cash: 'Rp 54.200.000',
  },
];

// Computed Filtered Mosques
const filteredMosques = computed(() => {
  return mosques.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      m.location.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      m.fridaySchedule.khatib.toLowerCase().includes(searchQuery.value.toLowerCase());

    const matchLocation =
      selectedLocation.value === 'Semua' ||
      m.location.toLowerCase().includes(selectedLocation.value.toLowerCase());

    return matchSearch && matchLocation;
  });
});

const featuredFriday = computed(() => mosques[0] ?? {
  id: 1,
  name: 'Masjid Raya Baiturrahman',
  location: 'Banda Aceh',
  address: 'Jl. Moh. Jam No.1, Banda Aceh',
  distance: '0.8 km',
  capacity: '24.000 Jamaah',
  status: 'approved',
  verified: true,
  fridaySchedule: {
    date: 'Jumat, 29 Agustus 2026',
    time: '12:30 WIB',
    khatib: 'Prof. Dr. Tgk. H. Muslim Ibrahim, MA',
    khatibTitle: 'Guru Besar UIN Ar-Raniry',
    imam: 'Tgk. H. Jamhuri Ramli, SQ',
    muadzin: 'Ust. M. Rizal',
    topic: 'Menjaga Persaudaraan dan Ketenteraman Umat',
  },
  facilities: ['Ramah Disabilitas', 'Parkir Luas', 'AC Penuh'],
  cash: 'Rp 248.500.000',
});
</script>

<template>
  <div class="min-h-screen bg-background text-foreground transition-colors flex flex-col justify-between">
    <!-- Header -->
    <AppHeader />

    <!-- HERO SECTION -->
    <section class="relative border-b border-border bg-gradient-to-b from-card/60 via-card/20 to-background py-16 sm:py-24">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-3xl text-center space-y-4">
          <div class="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 shadow-xs">
            <span class="size-2 rounded-full bg-primary animate-pulse" />
            <span class="text-xs font-semibold text-foreground">Informasi Terkini Masjid se-Aceh</span>
          </div>

          <h1 class="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-foreground text-balance">
            Pusat Informasi & Jadwal Ibadah Masjid Aceh
          </h1>

          <p class="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Temukan lokasi masjid terdekat, jadwal khatib shalat Jumat terverifikasi, laporan kas terbuka, dan penugasan DKM secara terpadu.
          </p>

          <!-- Interactive Search Bar -->
          <div class="pt-4 max-w-2xl mx-auto">
            <div class="relative flex items-center rounded-xl border border-border bg-card p-1.5 shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <div class="pl-3 pr-2 text-muted-foreground">
                <Search class="size-5" />
              </div>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Cari nama masjid, kecamatan, atau nama khatib..."
                class="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              >
              <Button size="sm" class="gap-1.5 shrink-0 px-4">
                <span>Cari</span>
              </Button>
            </div>

            <!-- Location Filter Chips -->
            <div class="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs">
              <span class="text-muted-foreground font-medium">Wilayah:</span>
              <button
                v-for="loc in locations"
                :key="loc"
                :class="[
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                  selectedLocation === loc
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                ]"
                @click="selectedLocation = loc"
              >
                {{ loc }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 1: FEATURED FRIDAY PRAYER (JADWAL JUMAT INI) -->
    <section id="jadwal-jumat" class="py-12 border-b border-border bg-card/30">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div class="flex items-center gap-2">
              <Badge variant="secondary" class="gap-1 font-semibold uppercase tracking-wider text-[10px]">
                <Calendar class="size-3" />
                <span>Jadwal Khutbah Jumat Terkini</span>
              </Badge>
              <span class="font-mono text-xs tabular-nums text-muted-foreground">29 Agustus 2026</span>
            </div>
            <h2 class="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Sorotan Jadwal Shalat Jumat
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">Diperbarui setiap Kamis oleh DKM Resmi</span>
          </div>
        </div>

        <!-- Featured Banner Card -->
        <Card class="border-border bg-card shadow-sm overflow-hidden">
          <div class="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
            <!-- Col 1 & 2: Mosque & Khatib Info -->
            <div class="p-6 lg:p-8 lg:col-span-2 space-y-6">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <Badge variant="approved">Verifikasi Resmi DKM</Badge>
                  <span class="font-mono text-xs tabular-nums text-muted-foreground">Jarak: 0.8 km</span>
                </div>
                <div class="flex items-center gap-1.5 text-xs text-secondary-foreground font-medium">
                  <Clock class="size-4" />
                  <span>Waktu Khutbah: 12:30 WIB</span>
                </div>
              </div>

              <div>
                <h3 class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {{ featuredFriday.name }}
                </h3>
                <p class="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin class="size-3.5 text-primary shrink-0" />
                  <span>{{ featuredFriday.address }}</span>
                </p>
              </div>

              <!-- Topic Banner -->
              <div class="rounded-xl border border-border/80 bg-background p-4 space-y-1.5">
                <span class="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
                  TEMA KHUTBAH JUMAT
                </span>
                <p class="text-sm sm:text-base font-semibold text-foreground leading-snug">
                  "{{ featuredFriday.fridaySchedule.topic }}"
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
                <div class="space-y-1">
                  <span class="text-muted-foreground font-medium">Khatib Utama:</span>
                  <div class="font-semibold text-foreground text-sm">{{ featuredFriday.fridaySchedule.khatib }}</div>
                  <div class="text-[11px] text-muted-foreground">{{ featuredFriday.fridaySchedule.khatibTitle }}</div>
                </div>
                <div class="space-y-1">
                  <span class="text-muted-foreground font-medium">Imam Shalat:</span>
                  <div class="font-semibold text-foreground text-sm">{{ featuredFriday.fridaySchedule.imam }}</div>
                  <div class="text-[11px] text-muted-foreground">Imam Rawatib Masjid Raya</div>
                </div>
                <div class="space-y-1">
                  <span class="text-muted-foreground font-medium">Muadzin:</span>
                  <div class="font-semibold text-foreground text-sm">{{ featuredFriday.fridaySchedule.muadzin }}</div>
                  <div class="text-[11px] text-muted-foreground">Adzan Awal & Akhir</div>
                </div>
              </div>
            </div>

            <!-- Col 3: Mosque Highlights & Quick Actions -->
            <div class="p-6 lg:p-8 bg-card/50 flex flex-col justify-between space-y-6">
              <div class="space-y-4">
                <h4 class="font-display text-sm font-semibold text-foreground">Fasilitas Jamaah</h4>
                <div class="flex flex-wrap gap-1.5">
                  <Badge
                    v-for="fac in featuredFriday.facilities"
                    :key="fac"
                    variant="outline"
                    class="text-xs bg-background"
                  >
                    {{ fac }}
                  </Badge>
                </div>

                <Separator />

                <div class="space-y-2 text-xs">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Kapasitas:</span>
                    <span class="font-medium tabular-nums">{{ featuredFriday.capacity }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Saldo Kas Terbuka:</span>
                    <span class="font-mono font-medium text-primary tabular-nums">{{ featuredFriday.cash }}</span>
                  </div>
                </div>
              </div>

              <div class="space-y-2 pt-4">
                <Button class="w-full gap-2" @click="() => toast.success('Membuka rute ke Masjid Raya Baiturrahman')">
                  <Compass class="size-4" />
                  <span>Petunjuk Arah Rute</span>
                </Button>
                <Button variant="outline" class="w-full" @click="() => toast.info('Riwayat jadwal khatib lengkap')">
                  Lihat Riwayat Khatib
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>

    <!-- SECTION 2: MOSQUE DIRECTORY (DAFTAR MASJID) -->
    <section id="masjid" class="py-16">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div class="flex items-center gap-2">
              <Badge variant="approved">Daftar Terverifikasi</Badge>
              <span class="text-xs text-muted-foreground">Menampilkan {{ filteredMosques.length }} masjid di Banda Aceh & sekitar</span>
            </div>
            <h2 class="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Eksplorasi Masjid Terdekat
            </h2>
          </div>

          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter class="size-3.5 text-primary" />
            <span>Filter Aktif: <strong class="text-foreground">{{ selectedLocation }}</strong></span>
          </div>
        </div>

        <!-- Mosque Grid -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="mosque in filteredMosques"
            :key="mosque.id"
            class="border-border shadow-sm flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-md group"
          >
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <Badge variant="approved" class="text-[11px] gap-1">
                  <ShieldCheck class="size-3" />
                  <span>Disetujui</span>
                </Badge>
                <span class="font-mono text-xs tabular-nums text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                  {{ mosque.distance }}
                </span>
              </div>

              <CardTitle class="mt-3 font-display text-lg font-bold group-hover:text-primary transition-colors">
                {{ mosque.name }}
              </CardTitle>
              <CardDescription class="flex items-center gap-1 text-xs">
                <MapPin class="size-3 text-muted-foreground shrink-0" />
                <span class="truncate">{{ mosque.address }}</span>
              </CardDescription>
            </CardHeader>

            <CardContent class="space-y-4 pt-1">
              <!-- Friday Schedule Highlight -->
              <div class="rounded-lg bg-background p-3 border border-border text-xs space-y-1.5">
                <div class="flex items-center justify-between text-[10px] font-semibold text-secondary-foreground uppercase tracking-wider">
                  <span>KHATIB JUMAT INI</span>
                  <span class="font-mono tabular-nums text-muted-foreground">12:30 WIB</span>
                </div>
                <div class="font-medium text-foreground text-xs leading-snug">
                  {{ mosque.fridaySchedule.khatib }}
                </div>
                <div class="text-[11px] text-muted-foreground truncate">
                  Imam: {{ mosque.fridaySchedule.imam }}
                </div>
              </div>

              <!-- Facilities & Meta -->
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="fac in mosque.facilities.slice(0, 2)"
                  :key="fac"
                  class="inline-flex items-center text-[10px] bg-card border border-border px-2 py-0.5 rounded text-muted-foreground"
                >
                  {{ fac }}
                </span>
                <span
                  v-if="mosque.facilities.length > 2"
                  class="text-[10px] text-muted-foreground self-center px-1"
                >
                  +{{ mosque.facilities.length - 2 }} lagi
                </span>
              </div>
            </CardContent>

            <CardFooter class="border-t border-border pt-4 gap-2">
              <Button size="sm" class="flex-1" @click="() => toast.info(`Membuka profil ${mosque.name}`)">
                Lihat Profil
              </Button>
              <Button size="sm" variant="outline" @click="() => toast.success(`Rute menuju ${mosque.name} ditampilkan`)">
                <Compass class="size-3.5" />
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div v-if="filteredMosques.length === 0" class="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <Building2 class="size-10 text-muted-foreground mx-auto" />
          <h3 class="font-display text-base font-semibold">Tidak Ada Masjid Ditemukan</h3>
          <p class="text-xs text-muted-foreground max-w-sm mx-auto">
            Coba ubah kata kunci pencarian atau pilih filter wilayah "Semua" untuk melihat daftar masjid lainnya.
          </p>
          <Button size="sm" variant="outline" @click="() => { searchQuery = ''; selectedLocation = 'Semua'; }">
            Reset Pencarian
          </Button>
        </div>
      </div>
    </section>

    <!-- SECTION 3: TRANSPARENCY & STATS -->
    <section id="transparansi" class="border-y border-border bg-card/40 py-16">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-3 items-center">
          <div class="space-y-4">
            <Badge variant="secondary" class="font-medium">Akuntabilitas & Kepercayaan</Badge>
            <h2 class="font-display text-3xl font-bold tracking-tight">
              Transparansi Informasi & Tata Kelola Jamaah
            </h2>
            <p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Baituna mendorong keterbukaan informasi jadwal ibadah, pengelolaan dana infaq masjid, dan kemudahan silaturahmi jamaah dengan para ulama di Aceh.
            </p>
          </div>

          <!-- Stat Counters -->
          <div class="grid grid-cols-2 gap-4 lg:col-span-2">
            <div class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-2">
              <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 class="size-5" />
              </div>
              <div class="font-mono text-3xl font-bold text-foreground tabular-nums">240+</div>
              <div class="text-xs font-semibold text-foreground">Masjid Terdaftar</div>
              <p class="text-[11px] text-muted-foreground">Tersebar di Banda Aceh dan Aceh Besar</p>
            </div>

            <div class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-2">
              <div class="flex size-9 items-center justify-center rounded-lg bg-secondary-soft text-secondary-foreground">
                <Users class="size-5" />
              </div>
              <div class="font-mono text-3xl font-bold text-foreground tabular-nums">480+</div>
              <div class="text-xs font-semibold text-foreground">Khatib & Tokoh Dayah</div>
              <p class="text-[11px] text-muted-foreground">Profil ulama, cendekiawan, dan ustadz terverifikasi</p>
            </div>

            <div class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-2">
              <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Coins class="size-5" />
              </div>
              <div class="font-mono text-3xl font-bold text-foreground tabular-nums">Rp 1,8M+</div>
              <div class="text-xs font-semibold text-foreground">Akumulasi Kas Terbuka</div>
              <p class="text-[11px] text-muted-foreground">Laporan infaq dan pengeluaran yang dapat diakses publik</p>
            </div>

            <div class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-2">
              <div class="flex size-9 items-center justify-center rounded-lg bg-secondary-soft text-secondary-foreground">
                <ShieldCheck class="size-5" />
              </div>
              <div class="font-mono text-3xl font-bold text-foreground tabular-nums">100%</div>
              <div class="text-xs font-semibold text-foreground">Verifikasi Berlapis</div>
              <p class="text-[11px] text-muted-foreground">Mencegah klaim ganda dan hoaks jadwal</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 4: DKM REGISTRATION CTA -->
    <section id="daftar-masjid" class="py-16">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="rounded-2xl border border-border bg-card p-8 sm:p-12 shadow-sm">
          <div class="mx-auto max-w-2xl text-center space-y-4">
            <Badge variant="approved">Khusus Pengurus BKM & DKM</Badge>
            <h2 class="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Daftarkan Masjid Anda di Baituna
            </h2>
            <p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Permudah pengelolaan jadwal shalat Jumat, penugasan khatib mingguan, publikasi pengumuman kegiatan, dan transparansi infaq secara mandiri.
            </p>

            <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <!-- Dialog Trigger for DKM Registration -->
              <Dialog>
                <DialogTrigger as-child>
                  <Button size="lg" class="gap-2 w-full sm:w-auto">
                    <PlusCircle class="size-4" />
                    <span>Ajukan Pendaftaran Masjid</span>
                  </Button>
                </DialogTrigger>
                <DialogContent class="sm:max-w-lg bg-card text-card-foreground border-border">
                  <DialogHeader>
                    <DialogTitle class="font-display text-xl">Formulir Pendaftaran Masjid</DialogTitle>
                    <DialogDescription class="text-xs text-muted-foreground">
                      Lengkapi informasi dasar masjid dan identitas pengurus DKM untuk proses verifikasi tim Baituna.
                    </DialogDescription>
                  </DialogHeader>
                  <div class="space-y-3.5 py-2 text-xs">
                    <div class="space-y-1">
                      <label class="font-medium text-foreground">Nama Resmi Masjid</label>
                      <Input placeholder="Contoh: Masjid Jamik Darussalam" />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1">
                        <label class="font-medium text-foreground">Kabupaten / Kota</label>
                        <Input placeholder="Banda Aceh" />
                      </div>
                      <div class="space-y-1">
                        <label class="font-medium text-foreground">Kecamatan</label>
                        <Input placeholder="Syiah Kuala" />
                      </div>
                    </div>
                    <div class="space-y-1">
                      <label class="font-medium text-foreground">Nama Ketua BKM / Kontak</label>
                      <Input placeholder="Nama Lengkap & No. HP / WhatsApp" />
                    </div>
                  </div>
                  <DialogFooter class="gap-2">
                    <DialogClose as-child>
                      <Button variant="outline" size="sm">Tutup</Button>
                    </DialogClose>
                    <DialogClose as-child>
                      <Button size="sm" @click="() => toast.success('Permohonan pendaftaran telah dikirim untuk verifikasi admin!')">
                        Kirim Pendaftaran
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <AppFooter />
  </div>
</template>
