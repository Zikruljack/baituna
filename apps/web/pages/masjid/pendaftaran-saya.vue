<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MosqueStatus, MySubmission } from '~/types/api';

definePageMeta({ middleware: 'auth' });

const { listMySubmissions } = useMosqueRegistration();

const submissions = ref<MySubmission[]>([]);
const isLoading = ref(true);

onMounted(async () => {
  submissions.value = await listMySubmissions();
  isLoading.value = false;
});

const statusVariant: Record<MosqueStatus, 'approved' | 'pending' | 'rejected'> = {
  approved: 'approved',
  pending: 'pending',
  rejected: 'rejected',
};

const statusLabel: Record<MosqueStatus, string> = {
  approved: 'Disetujui',
  pending: 'Menunggu',
  rejected: 'Ditolak',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
    <h1 class="font-display text-2xl font-bold tracking-tight">Pendaftaran Saya</h1>
    <p class="mt-1 text-sm text-muted-foreground">Status masjid yang pernah Anda daftarkan.</p>

    <div v-if="!isLoading && submissions.length === 0" class="mt-8 rounded-xl border border-dashed border-border p-12 text-center space-y-3">
      <h3 class="font-display text-base font-semibold">Belum Ada Pendaftaran</h3>
      <p class="text-xs text-muted-foreground">Anda belum pernah mendaftarkan masjid.</p>
      <NuxtLink to="/masjid/daftar">
        <Button size="sm">Daftarkan Masjid</Button>
      </NuxtLink>
    </div>

    <Table v-else class="mt-6">
      <TableHeader>
        <TableRow>
          <TableHead>Nama Masjid</TableHead>
          <TableHead>Tanggal Daftar</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="s in submissions" :key="s.id">
          <TableCell class="font-medium">
            <NuxtLink v-if="s.status === 'approved'" :to="`/masjid/${s.id}`" class="hover:underline">
              {{ s.name }}
            </NuxtLink>
            <span v-else>{{ s.name }}</span>
          </TableCell>
          <TableCell class="text-sm text-muted-foreground">{{ formatDate(s.createdAt) }}</TableCell>
          <TableCell>
            <Badge :variant="statusVariant[s.status]">{{ statusLabel[s.status] }}</Badge>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
