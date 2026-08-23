<script setup lang="ts">
import { Building2, ShieldCheck, MapPin } from 'lucide-vue-next';
</script>

<template>
  <footer class="border-t border-border bg-card/60 text-foreground transition-colors">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-8 md:grid-cols-4">
        <!-- Col 1: Brand Info -->
        <div class="space-y-4 md:col-span-1">
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Building2 class="size-4" />
            </div>
            <span class="font-display text-xl font-bold tracking-tight">Baituna</span>
          </div>
          <p class="text-xs leading-relaxed text-muted-foreground">
            Platform agregasi informasi masjid, jadwal ibadah Jumat, transparansi keuangan kas, dan verifikasi profil keagamaan di wilayah Aceh.
          </p>
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin class="size-3.5 text-primary" />
            <span>Banda Aceh & Aceh Besar, Indonesia</span>
          </div>
        </div>

        <!-- Col 2: Fitur Publik -->
        <div class="space-y-3">
          <h4 class="font-display text-sm font-semibold text-foreground">Fitur Publik</h4>
          <ul class="space-y-2 text-xs text-muted-foreground">
            <li>
              <NuxtLink to="/#masjid" class="hover:text-primary transition-colors">Pencarian Masjid Terdekat</NuxtLink>
            </li>
            <li>
              <NuxtLink to="/#jadwal-jumat" class="hover:text-primary transition-colors">Jadwal Khatib Jumat Terkini</NuxtLink>
            </li>
            <li>
              <NuxtLink to="/#transparansi" class="hover:text-primary transition-colors">Laporan Transparansi Kas</NuxtLink>
            </li>
            <li>
              <NuxtLink to="/#peta" class="hover:text-primary transition-colors">Peta Sebaran Masjid</NuxtLink>
            </li>
            <li>
              <a href="#" class="hover:text-primary transition-colors">Unduh Aplikasi (Play Store / App Store)</a>
            </li>
          </ul>
        </div>

        <!-- Col 3: Pengurus & Takmir -->
        <div class="space-y-3">
          <h4 class="font-display text-sm font-semibold text-foreground">Pengurus BKM/DKM</h4>
          <ul class="space-y-2 text-xs text-muted-foreground">
            <li>
              <NuxtLink to="/#daftar-masjid" class="hover:text-primary transition-colors">Pendaftaran Masjid Baru</NuxtLink>
            </li>
            <li>
              <NuxtLink to="/#verifikasi" class="hover:text-primary transition-colors">Status Verifikasi DKM</NuxtLink>
            </li>
            <li>
              <NuxtLink to="/#petugas-jumat" class="hover:text-primary transition-colors">Kelola Jadwal Petugas</NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Col 4: Keamanan & Kontak -->
        <div class="space-y-3">
          <h4 class="font-display text-sm font-semibold text-foreground">Integritas Data</h4>
          <p class="text-xs text-muted-foreground leading-relaxed">
            Semua data masjid dan jadwal diverifikasi berlapis untuk memastikan keakuratan informasi jamaah.
          </p>
          <div class="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5">
            <ShieldCheck class="size-4 text-primary shrink-0" />
            <span class="text-xs font-medium text-foreground">Verifikasi Resmi DKM</span>
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
        <p>© 2026 Baituna. Hak cipta dilindungi undang-undang.</p>
        <div class="flex items-center gap-1">
          <span>Dibangun dengan dedikasi untuk jamaah masjid Aceh</span>
        </div>
      </div>
    </div>
  </footer>
</template>
