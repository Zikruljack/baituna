<script setup lang="ts">
import { toast } from 'vue-sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PendingMosque } from '~/types/api';

definePageMeta({
  middleware: ['auth', 'require-role'],
  requiredRoles: ['super_admin'],
  layout: 'admin',
});

const { listPendingMosques, approveMosque, rejectMosque } = useMosqueRegistration();

const pending = ref<PendingMosque[]>([]);
const isLoading = ref(true);
const processingId = ref<string | null>(null);

onMounted(async () => {
  pending.value = await listPendingMosques();
  isLoading.value = false;
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function onApprove(mosqueId: string) {
  processingId.value = mosqueId;
  try {
    await approveMosque(mosqueId);
    pending.value = pending.value.filter((m) => m.id !== mosqueId);
    toast.success('Masjid disetujui.');
  } catch {
    toast.error('Gagal menyetujui masjid.');
  } finally {
    processingId.value = null;
  }
}

async function onReject(mosqueId: string) {
  processingId.value = mosqueId;
  try {
    await rejectMosque(mosqueId);
    pending.value = pending.value.filter((m) => m.id !== mosqueId);
    toast.success('Masjid ditolak.');
  } catch {
    toast.error('Gagal menolak masjid.');
  } finally {
    processingId.value = null;
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
    <h1 class="font-display text-2xl font-bold tracking-tight">Antrean Persetujuan Masjid</h1>
    <p class="mt-1 text-sm text-muted-foreground">Masjid yang menunggu verifikasi, diurutkan dari yang terlama.</p>

    <div v-if="!isLoading && pending.length === 0" class="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
      <p class="text-sm text-muted-foreground">Tidak ada pendaftaran yang menunggu persetujuan.</p>
    </div>

    <Table v-else class="mt-6">
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead>Alamat</TableHead>
          <TableHead>Tanggal Daftar</TableHead>
          <TableHead class="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="m in pending" :key="m.id">
          <TableCell class="font-medium">{{ m.name }}</TableCell>
          <TableCell class="text-sm text-muted-foreground">{{ m.address }}</TableCell>
          <TableCell class="text-sm text-muted-foreground">{{ formatDate(m.createdAt) }}</TableCell>
          <TableCell class="flex justify-end gap-2">
            <Dialog>
              <DialogTrigger as-child>
                <Button size="sm" :disabled="processingId === m.id">Setujui</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Setujui {{ m.name }}?</DialogTitle>
                  <DialogDescription>
                    Pendaftar akan otomatis menjadi Mosque Admin untuk masjid ini.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter class="gap-2">
                  <DialogClose as-child>
                    <Button variant="outline" size="sm">Batal</Button>
                  </DialogClose>
                  <DialogClose as-child>
                    <Button size="sm" @click="onApprove(m.id)">Ya, Setujui</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger as-child>
                <Button size="sm" variant="outline" :disabled="processingId === m.id">Tolak</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tolak {{ m.name }}?</DialogTitle>
                  <DialogDescription>
                    Status pendaftar tidak berubah. Tindakan ini tidak menghapus data masjid.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter class="gap-2">
                  <DialogClose as-child>
                    <Button variant="outline" size="sm">Batal</Button>
                  </DialogClose>
                  <DialogClose as-child>
                    <Button size="sm" variant="destructive" @click="onReject(m.id)">Ya, Tolak</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
