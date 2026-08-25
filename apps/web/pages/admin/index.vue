<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  LayoutDashboard,
  PlusCircle,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-vue-next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MosqueStatus, MySubmission, PendingMosque } from '~/types/api';

definePageMeta({ middleware: 'auth' });

const { user } = useAuth();
const { listPendingMosques, listMySubmissions } = useMosqueRegistration();

const isSuperAdmin = computed(() => user.value?.role === 'super_admin');
const isMosqueAdmin = computed(() => user.value?.role === 'mosque_admin');

const pendingMosques = ref<PendingMosque[]>([]);
const mySubmissions = ref<MySubmission[]>([]);
const isLoading = ref(true);

onMounted(async () => {
  try {
    const promises: [Promise<PendingMosque[] | null>, Promise<MySubmission[]>] = [
      isSuperAdmin.value ? listPendingMosques() : Promise.resolve(null),
      listMySubmissions(),
    ];

    const [pendingRes, submissionsRes] = await Promise.all(promises);
    if (pendingRes) {
      pendingMosques.value = pendingRes;
    }
    mySubmissions.value = submissionsRes;
  } catch {
    // Graceful error handling
  } finally {
    isLoading.value = false;
  }
});

const approvedMosques = computed(() => mySubmissions.value.filter((m) => m.status === 'approved'));

const roleLabel = computed(() => {
  if (isSuperAdmin.value) return 'Super Admin';
  if (isMosqueAdmin.value) return 'Pengelola Masjid (DKM)';
  return 'Jamaah / Pengguna';
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
  <div class="min-h-screen bg-background text-foreground transition-colors flex flex-col justify-between">
    <AppHeader />

    <main class="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <!-- Welcome Header Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <Badge variant="secondary" class="gap-1.5 font-semibold">
              <LayoutDashboard class="size-3.5" />
              <span>{{ roleLabel }}</span>
            </Badge>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Dashboard Baituna
          </h1>
          <p class="text-xs sm:text-sm text-muted-foreground mt-1">
            Selamat datang, <strong class="text-foreground">{{ user?.name }}</strong> ({{ user?.email }}).
          </p>
        </div>

        <div class="flex items-center gap-3">
          <NuxtLink to="/masjid/daftar">
            <Button size="sm" class="gap-1.5">
              <PlusCircle class="size-4" />
              <span>Daftarkan Masjid Baru</span>
            </Button>
          </NuxtLink>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton class="h-44 w-full rounded-xl" />
        <Skeleton class="h-44 w-full rounded-xl" />
        <Skeleton class="h-44 w-full rounded-xl" />
      </div>

      <template v-else>
        <!-- SUPER ADMIN SECTION: APPROVAL QUEUE OVERVIEW -->
        <div v-if="isSuperAdmin" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg font-semibold flex items-center gap-2">
              <ShieldAlert class="size-5 text-amber-500" />
              <span>Antrean Persetujuan Pendaftaran</span>
            </h2>
            <NuxtLink to="/admin/pendaftaran">
              <Button variant="ghost" size="sm" class="gap-1 text-xs text-primary">
                <span>Lihat Semua ({{ pendingMosques.length }})</span>
                <ArrowRight class="size-3.5" />
              </Button>
            </NuxtLink>
          </div>

          <Alert v-if="pendingMosques.length > 0" class="border-amber-500/30 bg-amber-500/10">
            <AlertTitle class="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-2">
              <Clock class="size-4" />
              <span>Terdapat {{ pendingMosques.length }} pendaftaran masjid menunggu verifikasi</span>
            </AlertTitle>
            <AlertDescription class="text-xs text-muted-foreground mt-1">
              Verifikasi data masjid dan pendaftar untuk mengaktifkan akses kelola masjid bagi pengurus DKM.
            </AlertDescription>
          </Alert>

          <Card v-if="pendingMosques.length > 0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Masjid</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead>Tanggal Pengajuan</TableHead>
                  <TableHead class="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="m in pendingMosques.slice(0, 3)" :key="m.id">
                  <TableCell class="font-medium">{{ m.name }}</TableCell>
                  <TableCell class="text-xs text-muted-foreground">{{ m.address }}</TableCell>
                  <TableCell class="text-xs text-muted-foreground">{{ formatDate(m.createdAt) }}</TableCell>
                  <TableCell class="text-right">
                    <NuxtLink to="/admin/pendaftaran">
                      <Button size="sm" variant="outline" class="text-xs">
                        Tinjau
                      </Button>
                    </NuxtLink>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>

        <!-- MOSQUES MANAGEMENT SECTION -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-display text-lg font-semibold flex items-center gap-2">
                <Building2 class="size-5 text-primary" />
                <span>Masjid yang Dikelola</span>
              </h2>
              <p class="text-xs text-muted-foreground">
                Akses langsung ke panel pengelolaan jadwal shalat Jumat dan petugas ustadz.
              </p>
            </div>
          </div>

          <div v-if="approvedMosques.length === 0" class="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
            <Building2 class="size-10 text-muted-foreground mx-auto" />
            <h3 class="font-display text-base font-semibold">Belum Mengelola Masjid</h3>
            <p class="text-xs text-muted-foreground max-w-md mx-auto">
              Anda belum memiliki masjid yang disetujui untuk dikelola. Jika Anda pengurus DKM, ajukan pendaftaran masjid Anda sekarang.
            </p>
            <NuxtLink to="/masjid/daftar">
              <Button size="sm" class="gap-1.5">
                <PlusCircle class="size-4" />
                <span>Daftarkan Masjid</span>
              </Button>
            </NuxtLink>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card v-for="m in approvedMosques" :key="m.id" class="flex flex-col justify-between hover:border-primary/50 transition-all">
              <CardHeader>
                <div class="flex items-center justify-between">
                  <Badge variant="approved" class="gap-1 text-[10px]">
                    <ShieldCheck class="size-3" />
                    <span>Disetujui</span>
                  </Badge>
                  <span class="text-[11px] text-muted-foreground">{{ formatDate(m.createdAt) }}</span>
                </div>
                <CardTitle class="font-display text-lg font-bold mt-2">
                  {{ m.name }}
                </CardTitle>
                <CardDescription class="text-xs">
                  ID: {{ m.id.slice(0, 8) }}...
                </CardDescription>
              </CardHeader>

              <CardContent class="space-y-2 text-xs">
                <div class="rounded-lg bg-card/60 p-3 border border-border space-y-1.5">
                  <div class="flex items-center gap-2 text-muted-foreground">
                    <Users class="size-3.5" />
                    <span>Roster Khatib / Imam / Muazzin</span>
                  </div>
                  <div class="flex items-center gap-2 text-muted-foreground">
                    <Calendar class="size-3.5" />
                    <span>Jadwal Shalat Jumat Mingguan</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter class="border-t border-border pt-4 gap-2">
                <NuxtLink :to="`/admin/masjid/${m.id}`" class="flex-1">
                  <Button size="sm" class="w-full gap-1.5">
                    <Settings class="size-3.5" />
                    <span>Kelola Masjid</span>
                  </Button>
                </NuxtLink>
                <NuxtLink :to="`/masjid/${m.id}`">
                  <Button size="sm" variant="outline">
                    Lihat Profil
                  </Button>
                </NuxtLink>
              </CardFooter>
            </Card>
          </div>
        </div>

        <!-- MY SUBMISSIONS OVERVIEW -->
        <div class="space-y-4 pt-4 border-t border-border">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-display text-lg font-semibold">Semua Riwayat Pengajuan Masjid</h2>
              <p class="text-xs text-muted-foreground">Status seluruh permohonan pendaftaran yang pernah Anda ajukan.</p>
            </div>
            <NuxtLink to="/masjid/pendaftaran-saya">
              <Button variant="ghost" size="sm" class="text-xs gap-1 text-primary">
                <span>Lihat Detail</span>
                <ArrowRight class="size-3.5" />
              </Button>
            </NuxtLink>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Masjid</TableHead>
                <TableHead>Tanggal Pengajuan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="s in mySubmissions" :key="s.id">
                <TableCell class="font-medium">
                  <NuxtLink v-if="s.status === 'approved'" :to="`/masjid/${s.id}`" class="hover:underline">
                    {{ s.name }}
                  </NuxtLink>
                  <span v-else>{{ s.name }}</span>
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">{{ formatDate(s.createdAt) }}</TableCell>
                <TableCell>
                  <Badge :variant="statusVariant[s.status]">{{ statusLabel[s.status] }}</Badge>
                </TableCell>
                <TableCell class="text-right">
                  <NuxtLink v-if="s.status === 'approved'" :to="`/admin/masjid/${s.id}`">
                    <Button size="sm" variant="outline" class="text-xs gap-1">
                      <Settings class="size-3" />
                      <span>Panel Kelola</span>
                    </Button>
                  </NuxtLink>
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </TableCell>
              </TableRow>
              <TableEmpty v-if="mySubmissions.length === 0" :colspan="4">
                Belum ada permohonan pendaftaran masjid.
              </TableEmpty>
            </TableBody>
          </Table>
        </div>
      </template>
    </main>

    <AppFooter />
  </div>
</template>
