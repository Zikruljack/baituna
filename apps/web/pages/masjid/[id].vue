<!-- apps/web/pages/masjid/[id].vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';
import { Building2, Calendar, Compass, MapPin, Settings } from 'lucide-vue-next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { CurrentFridayAssignment, FridayAssignment, MosqueDetail, Person } from '~/types/api';

const route = useRoute();
const mosqueId = route.params.id as string;

const { detail } = useMosqueSearch();
const { getCurrent, getHistory } = useFridayAssignment();
const { listActive } = usePeople();
const { user } = useAuth();

const mosque = ref<MosqueDetail | null>(null);
const notFound = ref(false);
const loading = ref(true);

const currentAssignment = ref<CurrentFridayAssignment | null>(null);
const people = ref<Person[]>([]);
const historyItems = ref<FridayAssignment[]>([]);
const historyPage = ref(1);
const historyPageSize = 10;
const historyTotal = ref(0);
const historyTotalPages = computed(() => Math.max(1, Math.ceil(historyTotal.value / historyPageSize)));

const canManage = computed(() => {
  if (!mosque.value || !user.value) return false;
  return user.value.role === 'super_admin' || user.value.id === mosque.value.adminUserId;
});

function resolvePersonName(personId: string | null): string | null {
  if (!personId) return null;
  return people.value.find((person) => person.id === personId)?.name ?? null;
}

function mapsUrl(m: MosqueDetail): string {
  return `https://www.google.com/maps?q=${m.latitude},${m.longitude}`;
}

async function loadHistory(page: number) {
  if (!mosque.value) return;
  try {
    const result = await getHistory(mosque.value.id, page, historyPageSize);
    historyItems.value = result.items;
    historyTotal.value = result.total;
    historyPage.value = result.page;
  } catch {
    toast.error('Gagal memuat riwayat jadwal Jumat');
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    const result = await detail(mosqueId);
    if (!result) {
      notFound.value = true;
      return;
    }
    mosque.value = result;

    const [assignment, activePeople] = await Promise.all([
      getCurrent(result.id),
      listActive(result.id),
    ]);
    currentAssignment.value = assignment;
    people.value = activePeople;
    await loadHistory(1);
  } catch {
    toast.error('Gagal memuat detail masjid');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-background text-foreground transition-colors flex flex-col justify-between">
    <AppHeader />

    <main class="flex-1">
      <div v-if="loading" class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-4">
        <Skeleton class="h-10 w-2/3" />
        <Skeleton class="h-4 w-1/2" />
        <Skeleton class="h-64 w-full rounded-xl" />
      </div>

      <div v-else-if="notFound" class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-24 text-center space-y-3">
        <Building2 class="size-10 text-muted-foreground mx-auto" />
        <h1 class="font-display text-2xl font-bold">Masjid Tidak Ditemukan</h1>
        <p class="text-sm text-muted-foreground">
          Masjid ini tidak ada, belum disetujui, atau sudah dihapus.
        </p>
        <NuxtLink to="/">
          <Button variant="outline" size="sm">Kembali ke Beranda</Button>
        </NuxtLink>
      </div>

      <div v-else-if="mosque" class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="approved">Masjid Terverifikasi</Badge>
            <h1 class="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance">
              {{ mosque.name }}
            </h1>
            <p class="mt-1 text-sm text-muted-foreground flex items-center gap-1">
              <MapPin class="size-4 text-primary shrink-0" />
              <span>{{ mosque.address }}</span>
            </p>
          </div>
          <NuxtLink v-if="canManage" :to="`/admin/masjid/${mosque.id}`">
            <Button variant="outline" size="sm" class="gap-1.5">
              <Settings class="size-4" />
              <span>Kelola Masjid Ini</span>
            </Button>
          </NuxtLink>
        </div>

        <Tabs default-value="jadwal">
          <TabsList>
            <TabsTrigger value="jadwal">Jadwal Jumat</TabsTrigger>
            <TabsTrigger value="tentang">Tentang</TabsTrigger>
          </TabsList>

          <TabsContent value="jadwal" class="space-y-6 pt-4">
            <Card>
              <CardContent class="pt-6">
                <div class="flex items-center gap-2 mb-4">
                  <Calendar class="size-4 text-secondary-foreground" />
                  <h2 class="font-display text-lg font-semibold">Jumat Ini / Berikutnya</h2>
                </div>

                <template v-if="currentAssignment?.has_assignment">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span class="text-xs text-muted-foreground">Tanggal:</span>
                      <div class="font-medium tabular-nums">{{ currentAssignment.assignmentDate }}</div>
                    </div>
                    <div>
                      <span class="text-xs text-muted-foreground">Khatib:</span>
                      <div class="font-medium">{{ resolvePersonName(currentAssignment.khatibPersonId) ?? 'Belum ditentukan' }}</div>
                    </div>
                    <div>
                      <span class="text-xs text-muted-foreground">Imam:</span>
                      <div class="font-medium">{{ resolvePersonName(currentAssignment.imamPersonId) ?? 'Belum ditentukan' }}</div>
                    </div>
                  </div>
                </template>
                <p v-else-if="currentAssignment" class="text-sm text-muted-foreground">
                  Belum ada jadwal untuk Jumat {{ currentAssignment.assignment_date }}.
                </p>
              </CardContent>
            </Card>

            <Separator />

            <div>
              <h3 class="font-display text-sm font-semibold mb-3">Riwayat Jadwal</h3>
              <div v-if="historyItems.length === 0" class="text-sm text-muted-foreground">
                Belum ada riwayat jadwal Jumat.
              </div>
              <ul v-else class="space-y-2">
                <li
                  v-for="item in historyItems"
                  :key="item.id"
                  class="rounded-lg border border-border bg-card p-3 text-sm flex flex-wrap items-center justify-between gap-2"
                >
                  <span class="font-medium tabular-nums">{{ item.assignmentDate }}</span>
                  <span class="text-xs text-muted-foreground">
                    Khatib: {{ resolvePersonName(item.khatibPersonId) ?? '—' }}
                  </span>
                </li>
              </ul>

              <Pagination v-if="historyTotalPages > 1" class="mt-4" :total="historyTotal" :items-per-page="historyPageSize" :page="historyPage">
                <PaginationContent>
                  <PaginationPrevious @click="loadHistory(Math.max(1, historyPage - 1))" />
                  <PaginationItem
                    v-for="page in historyTotalPages"
                    :key="page"
                    :value="page"
                    :is-active="page === historyPage"
                    @click="loadHistory(page)"
                  >
                    {{ page }}
                  </PaginationItem>
                  <PaginationNext @click="loadHistory(Math.min(historyTotalPages, historyPage + 1))" />
                </PaginationContent>
              </Pagination>
            </div>
          </TabsContent>

          <TabsContent value="tentang" class="space-y-4 pt-4">
            <Card>
              <CardContent class="pt-6 space-y-3 text-sm">
                <div>
                  <span class="text-xs text-muted-foreground">Alamat:</span>
                  <p class="font-medium">{{ mosque.address }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Koordinat:</span>
                  <p class="font-mono font-medium tabular-nums">{{ mosque.latitude }}, {{ mosque.longitude }}</p>
                </div>
                <a :href="mapsUrl(mosque)" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" class="gap-1.5">
                    <Compass class="size-4" />
                    <span>Buka di Google Maps</span>
                  </Button>
                </a>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
