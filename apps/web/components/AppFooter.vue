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

          <!-- Mobile App Store Badges -->
          <div class="pt-2 space-y-2">
            <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aplikasi Mobile Baituna</span>
            <div class="flex flex-wrap gap-2">
              <!-- Google Play Badge -->
              <a
                href="#"
                class="inline-flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-1.5 text-foreground hover:bg-card hover:border-primary/50 transition-all shadow-xs group"
                aria-label="Unduh di Google Play Store"
              >
                <!-- Play Store SVG -->
                <svg class="size-5 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a1.986 1.986 0 0 1-.61-1.428V3.242c0-.555.226-1.059.609-1.428z" fill="#4285F4"/>
                  <path d="M17.186 8.608L13.792 12l3.394 3.392 3.84-2.194a1.503 1.503 0 0 0 0-2.596l-3.84-1.988z" fill="#FBBC05"/>
                  <path d="M13.792 12L3.61 1.814A1.942 1.942 0 0 1 4.757 1.5c.44 0 .88.118 1.258.334l11.171 6.774L13.792 12z" fill="#EA4335"/>
                  <path d="M13.792 12l3.394 3.392-11.171 6.474a2.44 2.44 0 0 1-1.258.334 1.942 1.942 0 0 1-1.147-.314L13.792 12z" fill="#34A853"/>
                </svg>
                <div class="flex flex-col text-left">
                  <span class="text-[9px] font-medium uppercase tracking-wider text-muted-foreground leading-none">TEMUKAN DI</span>
                  <span class="font-display text-xs font-bold leading-tight group-hover:text-primary transition-colors">Google Play</span>
                </div>
              </a>

              <!-- App Store Badge -->
              <a
                href="#"
                class="inline-flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-1.5 text-foreground hover:bg-card hover:border-primary/50 transition-all shadow-xs group"
                aria-label="Unduh di App Store"
              >
                <!-- Apple SVG -->
                <svg class="size-5 shrink-0 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.67 1.39-.58.66-1.09 1.74-.95 2.78 1.05.08 2.09-.55 2.7-.3z"/>
                </svg>
                <div class="flex flex-col text-left">
                  <span class="text-[9px] font-medium uppercase tracking-wider text-muted-foreground leading-none">Unduh di</span>
                  <span class="font-display text-xs font-bold leading-tight group-hover:text-primary transition-colors">App Store</span>
                </div>
              </a>
            </div>
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
