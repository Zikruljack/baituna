<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';
import {
  Building2,
  Calendar,
  Compass,
  MapPin,
  PlusCircle,
  Search,
  ShieldCheck,
} from 'lucide-vue-next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import type { CurrentFridayAssignment, MosqueSummary, Person } from '~/types/api';

const { nearby, search } = useMosqueSearch();
const { getCurrent } = useFridayAssignment();
const { listActive } = usePeople();

// #jadwal-jumat state
const featuredMosque = ref<MosqueSummary | null>(null);
const featuredAssignment = ref<CurrentFridayAssignment | null>(null);
const featuredPeople = ref<Person[]>([]);
const featuredLoading = ref(true);

function resolvePersonName(personId: string | null, people: Person[]): string | null {
  if (!personId) return null;
  return people.find((person) => person.id === personId)?.name ?? null;
}

async function loadFeatured() {
  featuredLoading.value = true;
  try {
    const results = await nearby();
    const mosque = results[0] ?? null;
    featuredMosque.value = mosque;

    if (mosque) {
      const [assignment, people] = await Promise.all([
        getCurrent(mosque.id),
        listActive(mosque.id),
      ]);
      featuredAssignment.value = assignment;
      featuredPeople.value = people;
    }
  } catch {
    toast.error('Gagal memuat jadwal Jumat unggulan');
  } finally {
    featuredLoading.value = false;
  }
}

// #masjid state
const searchQuery = ref('');
const mosques = ref<MosqueSummary[]>([]);
const mosquesLoading = ref(true);
const hasSearched = ref(false);

async function loadNearbyMosques() {
  mosquesLoading.value = true;
  try {
    mosques.value = await nearby();
  } catch {
    toast.error('Gagal memuat daftar masjid terdekat');
  } finally {
    mosquesLoading.value = false;
  }
}

async function runSearch() {
  const query = searchQuery.value.trim();
  if (!query) {
    hasSearched.value = false;
    await loadNearbyMosques();
    return;
  }

  mosquesLoading.value = true;
  hasSearched.value = true;
  try {
    mosques.value = await search(query);
  } catch {
    toast.error('Pencarian masjid gagal, coba lagi');
  } finally {
    mosquesLoading.value = false;
  }
}

function resetSearch() {
  searchQuery.value = '';
  hasSearched.value = false;
  loadNearbyMosques();
}

function mapsUrl(mosque: MosqueSummary): string {
  return `https://www.google.com/maps?q=${mosque.latitude},${mosque.longitude}`;
}

onMounted(() => {
  loadFeatured();
  loadNearbyMosques();
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
            Temukan lokasi masjid terdekat, jadwal khatib shalat Jumat terverifikasi, dan penugasan DKM secara terpadu.
          </p>

          <!-- Interactive Search Bar -->
          <div class="pt-4 max-w-2xl mx-auto">
            <form class="relative flex items-center rounded-xl border border-border bg-card p-1.5 shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20" @submit.prevent="runSearch">
              <div class="pl-3 pr-2 text-muted-foreground">
                <Search class="size-5" />
              </div>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Cari nama masjid atau alamat..."
                class="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              >
              <Button type="submit" size="sm" class="gap-1.5 shrink-0 px-4">
                <span>Cari</span>
              </Button>
            </form>
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
            </div>
            <h2 class="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Sorotan Jadwal Shalat Jumat
            </h2>
          </div>
        </div>

        <Skeleton v-if="featuredLoading" class="h-64 w-full rounded-xl" />

        <div
          v-else-if="!featuredMosque"
          class="rounded-xl border border-dashed border-border p-12 text-center space-y-3"
        >
          <Calendar class="size-10 text-muted-foreground mx-auto" />
          <h3 class="font-display text-base font-semibold">Belum Ada Masjid Terdekat</h3>
          <p class="text-xs text-muted-foreground max-w-sm mx-auto">
            Izinkan akses lokasi browser Anda, atau cari nama masjid di bawah untuk melihat jadwal Jumat.
          </p>
        </div>

        <!-- Featured Banner Card -->
        <Card v-else class="border-border bg-card shadow-sm overflow-hidden">
          <div class="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
            <div class="p-6 lg:p-8 lg:col-span-2 space-y-6">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <Badge variant="approved">Masjid Terverifikasi</Badge>
                  <span v-if="featuredMosque.distanceKm !== undefined" class="font-mono text-xs tabular-nums text-muted-foreground">
                    Jarak: {{ featuredMosque.distanceKm.toFixed(1) }} km
                  </span>
                </div>
              </div>

              <div>
                <h3 class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance">
                  {{ featuredMosque.name }}
                </h3>
                <p class="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin class="size-3.5 text-primary shrink-0" />
                  <span>{{ featuredMosque.address }}</span>
                </p>
              </div>

              <template v-if="featuredAssignment?.has_assignment">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
                  <div class="space-y-1">
                    <span class="text-muted-foreground font-medium">Khatib:</span>
                    <div class="font-semibold text-foreground text-sm">
                      {{ resolvePersonName(featuredAssignment.khatibPersonId, featuredPeople) ?? 'Belum ditentukan' }}
                    </div>
                  </div>
                  <div class="space-y-1">
                    <span class="text-muted-foreground font-medium">Imam:</span>
                    <div class="font-semibold text-foreground text-sm">
                      {{ resolvePersonName(featuredAssignment.imamPersonId, featuredPeople) ?? 'Belum ditentukan' }}
                    </div>
                  </div>
                  <div class="space-y-1">
                    <span class="text-muted-foreground font-medium">Muadzin:</span>
                    <div class="font-semibold text-foreground text-sm">
                      {{ resolvePersonName(featuredAssignment.muazzinPersonId, featuredPeople) ?? 'Belum ditentukan' }}
                    </div>
                  </div>
                </div>
              </template>
              <div v-else-if="featuredAssignment" class="rounded-xl border border-border/80 bg-background p-4">
                <p class="text-sm text-muted-foreground">
                  Belum ada jadwal untuk Jumat {{ featuredAssignment.assignment_date }}.
                </p>
              </div>
            </div>

            <div class="p-6 lg:p-8 bg-card/50 flex flex-col justify-between space-y-6">
              <div class="space-y-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Koordinat:</span>
                  <span class="font-mono font-medium tabular-nums">{{ featuredMosque.latitude.toFixed(4) }}, {{ featuredMosque.longitude.toFixed(4) }}</span>
                </div>
              </div>

              <div class="space-y-2 pt-4">
                <NuxtLink :to="`/masjid/${featuredMosque.id}`">
                  <Button class="w-full gap-2">
                    <Compass class="size-4" />
                    <span>Lihat Profil Masjid</span>
                  </Button>
                </NuxtLink>
                <a :href="mapsUrl(featuredMosque)" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" class="w-full">
                    Petunjuk Arah Rute
                  </Button>
                </a>
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
              <span class="text-xs text-muted-foreground">Menampilkan {{ mosques.length }} masjid</span>
            </div>
            <h2 class="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {{ hasSearched ? 'Hasil Pencarian' : 'Eksplorasi Masjid Terdekat' }}
            </h2>
          </div>
        </div>

        <div v-if="mosquesLoading" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton v-for="n in 6" :key="n" class="h-56 w-full rounded-xl" />
        </div>

        <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="mosque in mosques"
            :key="mosque.id"
            class="border-border shadow-sm flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-md group"
          >
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <Badge variant="approved" class="text-[11px] gap-1">
                  <ShieldCheck class="size-3" />
                  <span>Disetujui</span>
                </Badge>
                <span
                  v-if="mosque.distanceKm !== undefined"
                  class="font-mono text-xs tabular-nums text-muted-foreground bg-background px-2 py-0.5 rounded border border-border"
                >
                  {{ mosque.distanceKm.toFixed(1) }} km
                </span>
              </div>

              <CardTitle class="mt-3 font-display text-lg font-bold group-hover:text-primary transition-colors text-balance">
                {{ mosque.name }}
              </CardTitle>
              <CardDescription class="flex items-center gap-1 text-xs">
                <MapPin class="size-3 text-muted-foreground shrink-0" />
                <span class="truncate">{{ mosque.address }}</span>
              </CardDescription>
            </CardHeader>

            <CardFooter class="border-t border-border pt-4 gap-2">
              <NuxtLink :to="`/masjid/${mosque.id}`" class="flex-1">
                <Button size="sm" class="w-full">
                  Lihat Profil
                </Button>
              </NuxtLink>
              <a :href="mapsUrl(mosque)" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  <Compass class="size-3.5" />
                </Button>
              </a>
            </CardFooter>
          </Card>
        </div>

        <div v-if="!mosquesLoading && mosques.length === 0" class="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <Building2 class="size-10 text-muted-foreground mx-auto" />
          <h3 class="font-display text-base font-semibold">Tidak Ada Masjid Ditemukan</h3>
          <p class="text-xs text-muted-foreground max-w-sm mx-auto">
            {{ hasSearched ? 'Coba kata kunci lain, atau reset untuk melihat masjid terdekat.' : 'Izinkan akses lokasi, atau ketik nama masjid untuk mencari.' }}
          </p>
          <Button v-if="hasSearched" size="sm" variant="outline" @click="resetSearch">
            Reset Pencarian
          </Button>
        </div>
      </div>
    </section>

    <!-- SECTION 3: DKM REGISTRATION CTA -->
    <section id="daftar-masjid" class="py-16">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="rounded-2xl border border-border bg-card p-8 sm:p-12 shadow-sm">
          <div class="mx-auto max-w-2xl text-center space-y-4">
            <Badge variant="approved">Khusus Pengurus BKM & DKM</Badge>
            <h2 class="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
              Daftarkan Masjid Anda di Baituna
            </h2>
            <p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Permudah pengelolaan jadwal shalat Jumat dan penugasan khatib mingguan secara mandiri.
            </p>

            <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <NuxtLink to="/masjid/daftar">
                <Button size="lg" class="gap-2 w-full sm:w-auto">
                  <PlusCircle class="size-4" />
                  <span>Ajukan Pendaftaran Masjid</span>
                </Button>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <AppFooter />
  </div>
</template>
