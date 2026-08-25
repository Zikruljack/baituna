<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-sonner';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  MapPin,
  Building2,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Sparkles,
  ArrowRight,
  Layers,
  Type,
  Palette,
  Eye,
  Sliders,
  ChevronDown,
  User as UserIcon,
  Settings,
  LogOut,
  FileText,
} from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const selectedCategory = ref('all');

const sampleMosqueData = [
  {
    id: 1,
    name: 'Masjid Raya Baiturrahman',
    location: 'Banda Aceh',
    khatib: 'Prof. Dr. Tgk. H. Muslim Ibrahim, MA',
    status: 'approved',
    distance: '0.8 km',
    cash: 'Rp 248.500.000',
  },
  {
    id: 2,
    name: 'Masjid Jamik Lueng Bata',
    location: 'Lueng Bata, Banda Aceh',
    khatib: 'Dr. Tgk. H. Syamsul Rijal, M.Ag',
    status: 'approved',
    distance: '2.4 km',
    cash: 'Rp 42.120.000',
  },
  {
    id: 3,
    name: 'Masjid Al-Furqan Lambaro',
    location: 'Ingin Jaya, Aceh Besar',
    khatib: 'Tgk. H. Faisal Ali',
    status: 'pending',
    distance: '5.1 km',
    cash: 'Rp 18.300.000',
  },
  {
    id: 4,
    name: 'Masjid Teungku Di Anjong',
    location: 'Peulanggahan, Banda Aceh',
    khatib: 'Tgk. M. Yusuf A. Wahab',
    status: 'rejected',
    distance: '1.9 km',
    cash: 'Rp 0',
  },
];
</script>

<template>
  <div class="min-h-screen bg-background text-foreground transition-colors">
    <AppHeader />

    <!-- Hero / Title Bar -->
    <div class="border-b border-border bg-card/40 py-10">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <Badge variant="secondary" class="font-medium">Design System v1.0</Badge>
              <span class="text-xs text-muted-foreground">WCAG AA Compliant · Tailwind v4 · shadcn-vue</span>
            </div>
            <h1 class="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Baituna Component Library & Design Tokens
            </h1>
            <p class="mt-1 text-sm text-muted-foreground max-w-3xl">
              Indeks lengkap token warna, hierarki tipografi, dan seluruh komponen UI yang siap diimplementasikan ke setiap modul (Auth, Pencarian Masjid, Registrasi, Person, Jadwal Jumat, dan Finansial).
            </p>
          </div>

          <div class="flex items-center gap-3">
            <NuxtLink to="/">
              <Button variant="outline" class="gap-2">
                <ArrowRight class="size-4 rotate-180" />
                <span>Lihat Beranda Full</span>
              </Button>
            </NuxtLink>
            <Button class="gap-2" @click="() => toast.success('Toaster notifikasi berfungsi sempurna!')">
              <Sparkles class="size-4" />
              <span>Test Toast</span>
            </Button>
          </div>
        </div>

        <!-- Category Nav -->
        <div class="mt-8 flex flex-wrap gap-2 border-t border-border pt-4">
          <button
            v-for="cat in [
              { id: 'all', label: 'Semua Komponen' },
              { id: 'tokens', label: '1. Design Tokens & Warna' },
              { id: 'typography', label: '2. Tipografi & Skala' },
              { id: 'buttons', label: '3. Buttons & Badges' },
              { id: 'cards', label: '4. Cards & Modul Patterns' },
              { id: 'forms', label: '5. Form & Inputs' },
              { id: 'feedback', label: '6. Alerts & Toasts' },
              { id: 'tables', label: '7. Data Table & Overlays' },
            ]"
            :key="cat.id"
            :class="[
              'rounded-full px-3.5 py-1 text-xs font-medium transition-colors cursor-pointer',
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground hover:bg-border/50 border border-border'
            ]"
            @click="selectedCategory = cat.id"
          >
            {{ cat.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <main class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-16">

      <!-- SECTION 1: DESIGN TOKENS -->
      <section v-if="selectedCategory === 'all' || selectedCategory === 'tokens'" id="tokens" class="space-y-6">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-3">
            <div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Palette class="size-4" />
            </div>
            <div>
              <h2 class="font-display text-xl font-bold">1. Palet Warna & Token Semantik</h2>
              <p class="text-xs text-muted-foreground">Emerald (#0F5132), Bronze (#C9A227), Maroon (#7B1830), Warm Cream (#F7F4EE / #1A1712)</p>
            </div>
          </div>
          <Badge variant="approved">WCAG AA Verified</Badge>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Primary Token -->
          <div class="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary (Emerald)</span>
              <span class="text-[11px] font-mono text-muted-foreground">9.2:1 AA</span>
            </div>
            <div class="h-14 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold text-xs shadow-inner">
              bg-primary
            </div>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between font-mono">
                <span class="text-muted-foreground">Light:</span>
                <span class="font-medium text-foreground">#0F5132</span>
              </div>
              <div class="flex justify-between font-mono">
                <span class="text-muted-foreground">Dark:</span>
                <span class="font-medium text-foreground">#2E9E68</span>
              </div>
              <div class="text-[11px] text-muted-foreground pt-1">
                Tombol utama, identitas merek, link, status "Disetujui".
              </div>
            </div>
            <div class="h-7 rounded bg-primary-soft text-primary flex items-center justify-center text-xs font-semibold">
              bg-primary-soft (Badge)
            </div>
          </div>

          <!-- Secondary Token -->
          <div class="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Secondary (Bronze)</span>
              <span class="text-[11px] font-mono text-muted-foreground">6.7:1 AA (Text)</span>
            </div>
            <div class="h-14 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground font-semibold text-xs shadow-inner">
              bg-secondary (Aksen)
            </div>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between font-mono">
                <span class="text-muted-foreground">Light:</span>
                <span class="font-medium text-foreground">#C9A227 / #6B5312</span>
              </div>
              <div class="flex justify-between font-mono">
                <span class="text-muted-foreground">Dark:</span>
                <span class="font-medium text-foreground">#D8B14A / #E3C169</span>
              </div>
              <div class="text-[11px] text-muted-foreground pt-1">
                Aksen garis, badge "Pending", teks status bronze.
              </div>
            </div>
            <div class="h-7 rounded bg-secondary-soft text-secondary-foreground flex items-center justify-center text-xs font-semibold">
              bg-secondary-soft (Badge)
            </div>
          </div>

          <!-- Destructive Token -->
          <div class="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destructive (Maroon)</span>
              <span class="text-[11px] font-mono text-muted-foreground">10.3:1 AA</span>
            </div>
            <div class="h-14 rounded-lg bg-destructive flex items-center justify-center text-destructive-foreground font-semibold text-xs shadow-inner">
              bg-destructive
            </div>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between font-mono">
                <span class="text-muted-foreground">Light:</span>
                <span class="font-medium text-foreground">#7B1830</span>
              </div>
              <div class="flex justify-between font-mono">
                <span class="text-muted-foreground">Dark:</span>
                <span class="font-medium text-foreground">#D2647C</span>
              </div>
              <div class="text-[11px] text-muted-foreground pt-1">
                Tolak, hapus, error, peringatan duplikat, pengeluaran kas.
              </div>
            </div>
            <div class="h-7 rounded bg-destructive-soft text-destructive flex items-center justify-center text-xs font-semibold">
              bg-destructive-soft (Badge)
            </div>
          </div>

          <!-- Background & Card Tokens -->
          <div class="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Neutrals (Krem Hangat)</span>
              <span class="text-[11px] font-mono text-muted-foreground">15.3:1 AA</span>
            </div>
            <div class="h-14 rounded-lg border border-border bg-background flex items-center justify-center text-foreground font-semibold text-xs">
              bg-background & card
            </div>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between font-mono">
                <span class="text-muted-foreground">Background:</span>
                <span class="font-medium text-foreground">#F7F4EE / #1A1712</span>
              </div>
              <div class="flex justify-between font-mono">
                <span class="text-muted-foreground">Card Base:</span>
                <span class="font-medium text-foreground">#FFFDF9 / #221E18</span>
              </div>
              <div class="text-[11px] text-muted-foreground pt-1">
                Krem hangat alami tanpa abu-abu kusam, menjaga suhu visual serasi.
              </div>
            </div>
            <div class="h-7 rounded border border-border-strong text-muted-foreground flex items-center justify-center text-xs">
              border-border-strong
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 2: TYPOGRAPHY -->
      <section v-if="selectedCategory === 'all' || selectedCategory === 'typography'" id="typography" class="space-y-6">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-3">
            <div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Type class="size-4" />
            </div>
            <div>
              <h2 class="font-display text-xl font-bold">2. Sistem Tipografi</h2>
              <p class="text-xs text-muted-foreground">Inter Tight (Heading/Display) + Inter (Body/Data/Tabular Numbers)</p>
            </div>
          </div>
          <Badge variant="outline">2 Font Families</Badge>
        </div>

        <div class="rounded-xl border border-border bg-card p-6 divide-y divide-border">
          <div class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="w-48 shrink-0">
              <span class="text-xs font-semibold text-muted-foreground uppercase">Judul Halaman</span>
              <p class="text-[11px] font-mono text-muted-foreground">Inter Tight · 34px / 700</p>
            </div>
            <div class="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground flex-1">
              Masjid Raya Baiturrahman
            </div>
          </div>

          <div class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="w-48 shrink-0">
              <span class="text-xs font-semibold text-muted-foreground uppercase">Judul Seksi</span>
              <p class="text-[11px] font-mono text-muted-foreground">Inter Tight · 24px / 650</p>
            </div>
            <div class="font-display text-2xl font-semibold tracking-tight text-foreground flex-1">
              Jadwal Shalat Jumat & Profil Khatib
            </div>
          </div>

          <div class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="w-48 shrink-0">
              <span class="text-xs font-semibold text-muted-foreground uppercase">Judul Kartu</span>
              <p class="text-[11px] font-mono text-muted-foreground">Inter Tight · 18px / 620</p>
            </div>
            <div class="font-display text-lg font-semibold text-balance text-foreground flex-1">
              Antrean Verifikasi Pendaftaran Masjid Baru
            </div>
          </div>

          <div class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="w-48 shrink-0">
              <span class="text-xs font-semibold text-muted-foreground uppercase">Isi / Body</span>
              <p class="text-[11px] font-mono text-muted-foreground">Inter · 15px / 400</p>
            </div>
            <div class="text-[15px] leading-relaxed text-foreground/90 flex-1">
              Baituna menyajikan informasi komprehensif terkait jadwal khatib, fasilitas wudhu, lokasi terdekat, dan transparansi keuangan kas masjid di seluruh Aceh.
            </div>
          </div>

          <div class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="w-48 shrink-0">
              <span class="text-xs font-semibold text-muted-foreground uppercase">Eyebrow & Label</span>
              <p class="text-[11px] font-mono text-muted-foreground">Inter · 11px / 600 Caps</p>
            </div>
            <div class="flex items-center gap-4 flex-1">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">JUMAT INI · 29 AGUSTUS 2026</span>
              <span class="text-xs font-medium text-muted-foreground">Label Field: Khatib Utama</span>
            </div>
          </div>

          <div class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="w-48 shrink-0">
              <span class="text-xs font-semibold text-muted-foreground uppercase">Data & Angka</span>
              <p class="text-[11px] font-mono text-muted-foreground">tabular-nums · 13px / 500</p>
            </div>
            <div class="flex flex-wrap items-center gap-6 font-mono text-sm tabular-nums text-foreground flex-1">
              <span class="bg-card border border-border px-2.5 py-1 rounded">0.8 km</span>
              <span class="bg-card border border-border px-2.5 py-1 rounded">5.5539° N, 95.3175° E</span>
              <span class="bg-card border border-border px-2.5 py-1 rounded">12:34 WIB</span>
              <span class="bg-card border border-border px-2.5 py-1 rounded">Rp 248.500.000</span>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 3: BUTTONS & BADGES -->
      <section v-if="selectedCategory === 'all' || selectedCategory === 'buttons'" id="buttons" class="space-y-6">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-3">
            <div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sliders class="size-4" />
            </div>
            <div>
              <h2 class="font-display text-xl font-bold">3. Buttons & Badges</h2>
              <p class="text-xs text-muted-foreground">Varian tombol dan lencana status sesuai standar interaksi Baituna</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <!-- Button Variants -->
          <div class="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">
            <h3 class="font-display text-base font-semibold">Button Variants</h3>
            
            <div class="flex flex-wrap items-center gap-3">
              <Button>Primary (Default)</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link Style</Button>
            </div>

            <Separator />

            <h3 class="font-display text-sm font-semibold text-muted-foreground">Button Sizes & Icons</h3>
            <div class="flex flex-wrap items-center gap-3">
              <Button size="lg" class="gap-2">
                <Building2 class="size-4" />
                <span>Large Action</span>
              </Button>
              <Button size="default" class="gap-2">
                <CheckCircle2 class="size-4" />
                <span>Default</span>
              </Button>
              <Button size="sm" class="gap-1.5">
                <Search class="size-3.5" />
                <span>Small</span>
              </Button>
              <Button size="xs" variant="outline">Extra Small</Button>
              <Button size="icon" variant="outline">
                <MoreVertical class="size-4" />
              </Button>
            </div>
          </div>

          <!-- Badge Variants -->
          <div class="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">
            <h3 class="font-display text-base font-semibold">Status Badges</h3>
            <p class="text-xs text-muted-foreground">
              Digunakan pada status verifikasi masjid, status jadwal khutbah, dan status kas.
            </p>

            <div class="flex flex-wrap items-center gap-3 pt-2">
              <Badge variant="approved" class="gap-1">
                <CheckCircle2 class="size-3" />
                <span>Disetujui (Approved)</span>
              </Badge>
              
              <Badge variant="pending" class="gap-1">
                <Clock class="size-3" />
                <span>Menunggu Review (Pending)</span>
              </Badge>

              <Badge variant="rejected" class="gap-1">
                <XCircle class="size-3" />
                <span>Ditolak / Duplikat (Rejected)</span>
              </Badge>

              <Badge variant="default">Default Primary</Badge>
              <Badge variant="secondary">Secondary Accent</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive Solid</Badge>
            </div>

            <Separator />

            <div class="rounded-lg bg-background p-3 border border-border text-xs space-y-1">
              <div class="font-mono text-muted-foreground font-semibold">Penggunaan Token:</div>
              <div class="text-muted-foreground">Badge "Disetujui" memakai <code class="font-mono text-primary font-medium">bg-primary-soft text-primary</code> dengan kontras terjamin WCAG AA.</div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 4: CARDS & MODULE PATTERNS -->
      <section v-if="selectedCategory === 'all' || selectedCategory === 'cards'" id="cards" class="space-y-6">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-3">
            <div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Layers class="size-4" />
            </div>
            <div>
              <h2 class="font-display text-xl font-bold">4. Kartu & Pola Modul</h2>
              <p class="text-xs text-muted-foreground">Pola kartu untuk Modul Pencarian Masjid, Jadwal Jumat, dan Dashboard Admin</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <!-- Pattern 1: Mosque Card (Modul Search) -->
          <Card class="border-border shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
            <CardHeader>
              <div class="flex items-center justify-between">
                <Badge variant="approved">Disetujui</Badge>
                <span class="font-mono text-xs tabular-nums text-muted-foreground">0.8 km</span>
              </div>
              <CardTitle class="mt-2 font-display">Masjid Raya Baiturrahman</CardTitle>
              <CardDescription class="flex items-center gap-1 text-xs">
                <MapPin class="size-3 text-muted-foreground shrink-0" />
                <span class="truncate">Jl. Moh. Jam No.1, Banda Aceh</span>
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <div class="rounded-md bg-background p-2.5 border border-border/70 text-xs space-y-1">
                <span class="text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">JUMAT INI</span>
                <div class="font-medium text-foreground">Prof. Dr. Tgk. H. Muslim Ibrahim, MA</div>
                <div class="text-muted-foreground text-[11px]">Waktu: 12:30 WIB · Muadzin: Ust. M. Rizal</div>
              </div>
            </CardContent>
            <CardFooter class="gap-2 border-t border-border pt-4">
              <Button size="sm" class="flex-1">Lihat Detail</Button>
              <Button size="sm" variant="outline">Riwayat</Button>
            </CardFooter>
          </Card>

          <!-- Pattern 2: Friday Assignment Card (Modul Friday Assignment) -->
          <Card class="border-border shadow-sm flex flex-col justify-between">
            <CardHeader>
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-secondary-foreground">Jadwal Shalat Jumat</span>
                <span class="font-mono text-xs font-medium tabular-nums text-foreground">29 Ags 2026</span>
              </div>
              <CardTitle class="mt-2 font-display">Penugasan Petugas Jumat</CardTitle>
              <CardDescription>Masjid Oman Al-Makmur (Lampriet)</CardDescription>
            </CardHeader>
            <CardContent class="space-y-2.5 text-xs">
              <div class="flex items-center justify-between py-1 border-b border-border/60">
                <span class="text-muted-foreground">Khatib:</span>
                <span class="font-medium text-foreground">Dr. Tgk. H. Syamsul Rijal</span>
              </div>
              <div class="flex items-center justify-between py-1 border-b border-border/60">
                <span class="text-muted-foreground">Imam:</span>
                <span class="font-medium text-foreground">Ust. H. Munawir Darwis</span>
              </div>
              <div class="flex items-center justify-between py-1">
                <span class="text-muted-foreground">Status Konfirmasi:</span>
                <Badge variant="approved" class="text-[10px]">Terkonfirmasi</Badge>
              </div>
            </CardContent>
            <CardFooter class="border-t border-border pt-4">
              <Button size="sm" variant="outline" class="w-full">Ubah Petugas</Button>
            </CardFooter>
          </Card>

          <!-- Pattern 3: Admin Approval Queue Card (Modul Mosque Registration) -->
          <Card class="border-border shadow-sm flex flex-col justify-between">
            <CardHeader>
              <div class="flex items-center justify-between">
                <Badge variant="pending">Menunggu Verifikasi</Badge>
                <span class="text-[11px] text-muted-foreground font-mono">1 jam lalu</span>
              </div>
              <CardTitle class="mt-2 font-display">Masjid Al-Furqan Lambaro</CardTitle>
              <CardDescription>Kec. Ingin Jaya, Kab. Aceh Besar</CardDescription>
            </CardHeader>
            <CardContent class="space-y-2 text-xs">
              <div class="text-muted-foreground">
                Diajukan oleh: <span class="font-medium text-foreground">Tgk. Abdullah (Ketua BKM)</span>
              </div>
              <div class="text-muted-foreground">
                Dokumen: <span class="text-primary font-medium underline">SK_BKM_2026.pdf</span>
              </div>
            </CardContent>
            <CardFooter class="gap-2 border-t border-border pt-4">
              <Button size="sm" class="flex-1">Setujui</Button>
              <Button size="sm" variant="destructive">Tolak</Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      <!-- SECTION 5: FORM & INPUTS -->
      <section v-if="selectedCategory === 'all' || selectedCategory === 'forms'" id="forms" class="space-y-6">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-3">
            <div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sliders class="size-4" />
            </div>
            <div>
              <h2 class="font-display text-xl font-bold">5. Form & Controls</h2>
              <p class="text-xs text-muted-foreground">Input, label, dropdown select, dan modal dialog</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Form Inputs -->
          <Card class="border-border shadow-sm p-6 space-y-4">
            <h3 class="font-display text-base font-semibold">Form Field Controls</h3>
            
            <div class="space-y-1.5">
              <Label for="mosque-name">Nama Masjid</Label>
              <Input id="mosque-name" placeholder="contoh: Masjid Jamik Al-Hidayah" />
              <p class="text-[11px] text-muted-foreground">Sesuai nama pada plang resmi atau SK BKM.</p>
            </div>

            <div class="space-y-1.5">
              <Label for="district">Kecamatan / Wilayah</Label>
              <Select>
                <SelectTrigger id="district">
                  <SelectValue placeholder="Pilih Kecamatan di Aceh" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Banda Aceh</SelectLabel>
                    <SelectItem value="baiturrahman">Baiturrahman</SelectItem>
                    <SelectItem value="kuta-alam">Kuta Alam</SelectItem>
                    <SelectItem value="syiah-kuala">Syiah Kuala</SelectItem>
                    <SelectItem value="lueng-bata">Lueng Bata</SelectItem>
                    <SelectItem value="ulee-kareng">Ulee Kareng</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1.5">
              <Label for="error-field" class="text-destructive">Field dengan Validasi Error</Label>
              <Input
                id="error-field"
                value="Masjid Tanpa Alamat"
                aria-invalid="true"
                class="border-destructive focus-visible:ring-destructive/30"
              />
              <p class="text-[11px] font-medium text-destructive">Alamat lengkap masjid wajib diisi.</p>
            </div>
          </Card>

          <!-- Dropdown Menu Showcase -->
          <Card class="border-border shadow-sm p-6 space-y-4 flex flex-col justify-between">
            <div>
              <h3 class="font-display text-base font-semibold">Dropdown Menu Visual</h3>
              <p class="text-xs text-muted-foreground mt-1">
                Menu popup kontekstual dengan hover token, separator, ikon, dan varian destruktif.
              </p>
            </div>

            <div class="rounded-lg bg-background p-4 border border-border space-y-3">
              <div class="text-xs font-medium text-foreground">Menu Akun & Aksi Pengguna</div>
              <div class="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="outline" class="gap-2">
                      <UserIcon class="size-4 text-primary" />
                      <span>Akun Pengurus</span>
                      <ChevronDown class="size-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" class="w-56">
                    <DropdownMenuLabel>Akun DKM Baiturrahman</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem class="gap-2" @click="() => toast.info('Buka Profil DKM')">
                      <UserIcon class="size-4 text-muted-foreground" />
                      <span>Profil Pengurus</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem class="gap-2" @click="() => toast.info('Buka Laporan Keuangan')">
                      <FileText class="size-4 text-muted-foreground" />
                      <span>Laporan Keuangan</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem class="gap-2" @click="() => toast.info('Buka Pengaturan')">
                      <Settings class="size-4 text-muted-foreground" />
                      <span>Pengaturan</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" class="gap-2" @click="() => toast.error('Berhasil keluar')">
                      <LogOut class="size-4" />
                      <span>Keluar Akun</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div class="text-[11px] text-muted-foreground">
              Didukung token <code>--popover</code> dan <code>--accent</code> dengan dukungan light/dark mode terpadu.
            </div>
          </Card>

          <!-- Dialog & Actions -->
          <Card class="border-border shadow-sm p-6 space-y-4 flex flex-col justify-between">
            <div>
              <h3 class="font-display text-base font-semibold">Dialog & Konfirmasi Interaktif</h3>
              <p class="text-xs text-muted-foreground mt-1">
                Pola modal konfirmasi untuk aksi destruktif atau persetujuan penting.
              </p>
            </div>

            <div class="rounded-lg bg-background p-4 border border-border space-y-3">
              <div class="text-xs font-medium text-foreground">Simulasi Konfirmasi Persetujuan Masjid</div>
              <Dialog>
                <DialogTrigger as-child>
                  <Button class="gap-2">
                    <CheckCircle2 class="size-4" />
                    <span>Buka Dialog Verifikasi</span>
                  </Button>
                </DialogTrigger>
                <DialogContent class="sm:max-w-md bg-card text-card-foreground border-border">
                  <DialogHeader>
                    <DialogTitle class="font-display text-lg">Konfirmasi Persetujuan Masjid</DialogTitle>
                    <DialogDescription class="text-xs text-muted-foreground">
                      Apakah Anda yakin ingin menyetujui pendaftaran <strong>Masjid Raya Baiturrahman</strong>? Data akan langsung tayang ke publik.
                    </DialogDescription>
                  </DialogHeader>
                  <div class="rounded-lg bg-background p-3 border border-border text-xs space-y-1">
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Pengaju:</span>
                      <span class="font-medium">Tgk. H. Muslim Ibrahim</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Wilayah:</span>
                      <span class="font-medium">Banda Aceh</span>
                    </div>
                  </div>
                  <DialogFooter class="gap-2">
                    <DialogClose as-child>
                      <Button variant="outline" size="sm">Batal</Button>
                    </DialogClose>
                    <DialogClose as-child>
                      <Button size="sm" @click="() => toast.success('Masjid berhasil disetujui!')">
                        Ya, Setujui
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div class="text-[11px] text-muted-foreground">
              Semua dialog menggunakan Reka UI dengan focus trap otomatis dan aksesibilitas keyboard (ESC / Tab).
            </div>
          </Card>
        </div>
      </section>

      <!-- SECTION 6: ALERTS & TOASTS -->
      <section v-if="selectedCategory === 'all' || selectedCategory === 'feedback'" id="feedback" class="space-y-6">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-3">
            <div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Info class="size-4" />
            </div>
            <div>
              <h2 class="font-display text-xl font-bold">6. Alerts & Feedback Messages</h2>
              <p class="text-xs text-muted-foreground">Pemberitahuan sistem, pesan sukses, peringatan duplikat, dan error</p>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <Alert variant="default">
            <Info class="size-4" />
            <AlertTitle class="font-semibold">Informasi Sistem</AlertTitle>
            <AlertDescription class="text-xs text-muted-foreground">
              Jadwal khutbah Jumat diperbarui secara otomatis setiap Kamis pukul 18:00 WIB oleh pengurus DKM masing-masing masjid.
            </AlertDescription>
          </Alert>

          <Alert variant="success">
            <CheckCircle2 class="size-4" />
            <AlertTitle class="font-semibold">Verifikasi Berhasil</AlertTitle>
            <AlertDescription class="text-xs">
              Data masjid dan akun pengurus telah diverifikasi oleh tim Baituna. Halaman publik masjid kini aktif.
            </AlertDescription>
          </Alert>

          <Alert variant="warning">
            <AlertTriangle class="size-4" />
            <AlertTitle class="font-semibold">Peringatan Jadwal Kosong</AlertTitle>
            <AlertDescription class="text-xs">
              Masjid ini belum menetapkan Khatib dan Imam untuk shalat Jumat minggu ini. Harap segera perbarui jadwal.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <XCircle class="size-4" />
            <AlertTitle class="font-semibold">Potensi Duplikasi Data Terdeteksi</AlertTitle>
            <AlertDescription class="text-xs">
              Masjid dengan koordinat dan nama yang serupa sudah terdaftar di sistem. Periksa kembali sebelum memproses approval.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      <!-- SECTION 7: DATA TABLE & SKELETONS -->
      <section v-if="selectedCategory === 'all' || selectedCategory === 'tables'" id="tables" class="space-y-6">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-3">
            <div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Layers class="size-4" />
            </div>
            <div>
              <h2 class="font-display text-xl font-bold">7. Data Table & Skeleton Loading</h2>
              <p class="text-xs text-muted-foreground">Tabel data administratif dengan nomor tabular, dropdown aksi, dan avatar</p>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow class="hover:bg-transparent">
                <TableHead class="w-12 text-center">#</TableHead>
                <TableHead>Nama Masjid & Lokasi</TableHead>
                <TableHead>Khatib Jumat Terdaftar</TableHead>
                <TableHead class="text-right">Kas Terlaporkan</TableHead>
                <TableHead class="text-center">Status</TableHead>
                <TableHead class="w-16 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in sampleMosqueData" :key="item.id">
                <TableCell class="font-mono text-xs text-center text-muted-foreground tabular-nums">
                  {{ item.id }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-3">
                    <Avatar class="size-8 rounded-lg border border-border">
                      <AvatarFallback class="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                        {{ item.name.slice(0, 2).toUpperCase() }}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div class="font-medium text-foreground text-sm font-display">{{ item.name }}</div>
                      <div class="text-xs text-muted-foreground">{{ item.location }} · <span class="tabular-nums font-mono">{{ item.distance }}</span></div>
                    </div>
                  </div>
                </TableCell>
                <TableCell class="text-xs font-medium">
                  {{ item.khatib }}
                </TableCell>
                <TableCell class="font-mono text-xs text-right tabular-nums">
                  {{ item.cash }}
                </TableCell>
                <TableCell class="text-center">
                  <Badge
                    :variant="
                      item.status === 'approved'
                        ? 'approved'
                        : item.status === 'pending'
                          ? 'pending'
                          : 'rejected'
                    "
                  >
                    {{ item.status === 'approved' ? 'Disetujui' : item.status === 'pending' ? 'Pending' : 'Ditolak' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical class="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-40">
                      <DropdownMenuLabel class="text-xs">Aksi Pengurus</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-xs gap-2" @click="() => toast.info(`Detail ${item.name}`)">
                        <Eye class="size-3.5" />
                        <span>Lihat Profil</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem class="text-xs gap-2 cursor-pointer" @click="() => toast.info(`Edit ${item.name}`)">
                        <Edit2 class="size-3.5" />
                        <span>Edit Data</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-xs gap-2 text-destructive focus:text-destructive cursor-pointer" @click="() => toast.error(`Hapus ${item.name}`)">
                        <Trash2 class="size-3.5" />
                        <span>Hapus</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- Skeleton Preview -->
        <div class="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
          <div class="flex items-center justify-between">
            <h3 class="font-display text-sm font-semibold">Skeleton Loading States</h3>
            <span class="text-xs text-muted-foreground">Pola saat memuat API / data lambat</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-4 rounded-lg border border-border bg-background space-y-3">
              <div class="flex items-center justify-between">
                <Skeleton class="h-5 w-16 rounded-full" />
                <Skeleton class="h-4 w-12" />
              </div>
              <Skeleton class="h-6 w-3/4" />
              <Skeleton class="h-4 w-1/2" />
              <Skeleton class="h-12 w-full rounded-md" />
              <div class="flex gap-2 pt-2">
                <Skeleton class="h-8 flex-1 rounded-md" />
                <Skeleton class="h-8 flex-1 rounded-md" />
              </div>
            </div>

            <div class="p-4 rounded-lg border border-border bg-background space-y-3">
              <div class="flex items-center justify-between">
                <Skeleton class="h-5 w-20 rounded-full" />
                <Skeleton class="h-4 w-14" />
              </div>
              <Skeleton class="h-6 w-2/3" />
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-12 w-full rounded-md" />
              <div class="flex gap-2 pt-2">
                <Skeleton class="h-8 flex-1 rounded-md" />
                <Skeleton class="h-8 flex-1 rounded-md" />
              </div>
            </div>

            <div class="p-4 rounded-lg border border-border bg-background space-y-3">
              <div class="flex items-center justify-between">
                <Skeleton class="h-5 w-16 rounded-full" />
                <Skeleton class="h-4 w-10" />
              </div>
              <Skeleton class="h-6 w-4/5" />
              <Skeleton class="h-4 w-2/5" />
              <Skeleton class="h-12 w-full rounded-md" />
              <div class="flex gap-2 pt-2">
                <Skeleton class="h-8 flex-1 rounded-md" />
                <Skeleton class="h-8 flex-1 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>

    <AppFooter />
  </div>
</template>
