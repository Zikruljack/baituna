<script setup lang="ts">
import { Calendar, Settings, Users } from 'lucide-vue-next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CurrentFridayAssignment, MyMosque, Person } from '~/types/api';

definePageMeta({
  middleware: ['auth', 'require-role'],
  requiredRoles: ['mosque_admin'],
  layout: 'admin',
});

const { getMyMosque } = useMosques();
const { listActive } = usePeople();
const { getCurrent } = useFridayAssignment();

const mosque = ref<MyMosque | null>(null);
const people = ref<Person[]>([]);
const currentAssignment = ref<CurrentFridayAssignment | null>(null);
const isLoading = ref(true);

onMounted(async () => {
  try {
    mosque.value = await getMyMosque();
    if (!mosque.value) {
      await navigateTo('/masjid/pendaftaran-saya');
      return;
    }
    const [peopleResult, assignmentResult] = await Promise.all([
      listActive(mosque.value.id),
      getCurrent(mosque.value.id),
    ]);
    people.value = peopleResult;
    currentAssignment.value = assignmentResult;
  } finally {
    isLoading.value = false;
  }
});

const fridayStatusLabel = computed(() => {
  if (!currentAssignment.value) return '—';
  return currentAssignment.value.has_assignment ? 'Terisi' : 'Belum Diisi';
});
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <div v-if="isLoading" class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Skeleton class="h-32 w-full rounded-xl" />
      <Skeleton class="h-32 w-full rounded-xl" />
    </div>

    <template v-else-if="mosque">
      <h1 class="font-display text-2xl font-bold tracking-tight">{{ mosque.name }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ mosque.address }}</p>

      <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">Jumlah Pengurus Terdaftar</CardTitle>
            <Users class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p class="text-3xl font-bold">{{ people.length }}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">Status Jumat Depan</CardTitle>
            <Calendar class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge :variant="currentAssignment?.has_assignment ? 'approved' : 'pending'">
              {{ fridayStatusLabel }}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div class="mt-6 flex flex-wrap gap-3">
        <NuxtLink :to="{ path: `/admin/masjid/${mosque.id}`, query: { tab: 'person' } }">
          <Button class="gap-1.5">
            <Users class="size-4" />
            Kelola Person
          </Button>
        </NuxtLink>
        <NuxtLink :to="{ path: `/admin/masjid/${mosque.id}`, query: { tab: 'jadwal' } }">
          <Button variant="outline" class="gap-1.5">
            <Settings class="size-4" />
            Kelola Jadwal Jumat
          </Button>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
