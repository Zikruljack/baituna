<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { toast } from 'vue-sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentOrNextFridayWib } from '~/lib/wib-date-client';
import type {
  CreateAssignmentInput,
  CurrentFridayAssignment,
  PaginatedAssignments,
  Person,
  UpdateAssignmentInput,
} from '~/types/api';

definePageMeta({
  middleware: ['auth', 'require-role'],
  requiredRoles: ['mosque_admin', 'super_admin'],
  layout: 'admin',
});

interface MosqueOwnerCheck {
  id: string;
  name: string;
  adminUserId: string | null;
}

const route = useRoute();
const mosqueId = route.params.id as string;
const { user } = useAuth();

const activeTab = computed({
  get: () => (route.query.tab === 'jadwal' ? 'jadwal' : 'person'),
  set: (value: string) => {
    navigateTo({ path: route.path, query: { ...route.query, tab: value } });
  },
});
const { listActive, create: createPerson, update: updatePerson, remove: removePerson } = usePeople();
const { getCurrent, getHistory, create: createAssignment, update: updateAssignment } = useFridayAssignment();

const mosque = ref<MosqueOwnerCheck | null>(null);
const mosqueLoadFailed = ref(false);

async function loadMosque() {
  try {
    mosque.value = await $fetch<MosqueOwnerCheck>(`/api/mosques/${mosqueId}`);
  } catch {
    mosqueLoadFailed.value = true;
    return;
  }

  const isOwner = mosque.value.adminUserId === user.value?.id;
  const isSuperAdmin = user.value?.role === 'super_admin';
  if (!isOwner && !isSuperAdmin) {
    toast.error('Anda bukan pengelola masjid ini');
    await navigateTo(`/masjid/${mosqueId}`);
  }
}

// --- Person Tab State ---
const people = ref<Person[]>([]);
const peopleLoading = ref(true);

async function loadPeople() {
  peopleLoading.value = true;
  try {
    people.value = await listActive(mosqueId);
  } catch {
    toast.error('Gagal memuat daftar Person');
  } finally {
    peopleLoading.value = false;
  }
}

const addDialogOpen = ref(false);
const addName = ref('');
const addPhone = ref('');
const addSubmitting = ref(false);

async function submitAdd() {
  if (addName.value.trim().length === 0) {
    toast.error('Nama wajib diisi');
    return;
  }
  addSubmitting.value = true;
  try {
    await createPerson(mosqueId, { name: addName.value.trim(), phone: addPhone.value.trim() || null });
    toast.success('Person berhasil ditambahkan');
    addDialogOpen.value = false;
    addName.value = '';
    addPhone.value = '';
    await loadPeople();
  } catch {
    toast.error('Gagal menambahkan Person');
  } finally {
    addSubmitting.value = false;
  }
}

const editDialogOpen = ref(false);
const editTarget = ref<Person | null>(null);
const editName = ref('');
const editPhone = ref('');
const editSubmitting = ref(false);

function openEdit(person: Person) {
  editTarget.value = person;
  editName.value = person.name;
  editPhone.value = person.phone ?? '';
  editDialogOpen.value = true;
}

async function submitEdit() {
  if (!editTarget.value) return;
  if (editName.value.trim().length === 0) {
    toast.error('Nama wajib diisi');
    return;
  }
  editSubmitting.value = true;
  try {
    await updatePerson(mosqueId, editTarget.value.id, {
      name: editName.value.trim(),
      phone: editPhone.value.trim() || null,
    });
    toast.success('Person berhasil diperbarui');
    editDialogOpen.value = false;
    await loadPeople();
  } catch {
    toast.error('Gagal memperbarui Person');
  } finally {
    editSubmitting.value = false;
  }
}

const deleteDialogOpen = ref(false);
const deleteTarget = ref<Person | null>(null);
const deleteSubmitting = ref(false);

function openDelete(person: Person) {
  deleteTarget.value = person;
  deleteDialogOpen.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleteSubmitting.value = true;
  try {
    await removePerson(mosqueId, deleteTarget.value.id);
    toast.success('Person berhasil dihapus');
    deleteDialogOpen.value = false;
    await loadPeople();
  } catch {
    toast.error('Gagal menghapus Person');
  } finally {
    deleteSubmitting.value = false;
  }
}

// --- Jadwal Jumat Tab State ---
const currentAssignment = ref<CurrentFridayAssignment | null>(null);
const history = ref<PaginatedAssignments | null>(null);
const historyPage = ref(1);
const historyPageSize = 20;
const historyTotalPages = computed(() => {
  if (!history.value) return 1;
  return Math.max(1, Math.ceil(history.value.total / history.value.pageSize));
});

const targetDate = computed(() => getCurrentOrNextFridayWib(new Date()));

const khatibPersonId = ref<string | null>(null);
const imamPersonId = ref<string | null>(null);
const muazzinPersonId = ref<string | null>(null);
const isPastLocked = ref(false);
const isSavingAssignment = ref(false);

async function loadCurrentAssignment() {
  try {
    currentAssignment.value = await getCurrent(mosqueId);
  } catch {
    toast.error('Gagal memuat jadwal Jumat');
  }
}

async function loadAssignmentHistory(page = historyPage.value) {
  try {
    history.value = await getHistory(mosqueId, page, historyPageSize);
    historyPage.value = page;
  } catch {
    toast.error('Gagal memuat riwayat jadwal');
  }
}

watch(
  currentAssignment,
  (value) => {
    if (!value) return;
    if (value.has_assignment) {
      khatibPersonId.value = value.khatibPersonId;
      imamPersonId.value = value.imamPersonId;
      muazzinPersonId.value = value.muazzinPersonId;
    } else {
      khatibPersonId.value = null;
      imamPersonId.value = null;
      muazzinPersonId.value = null;
    }
  },
  { immediate: true },
);

function personName(id: string | null): string {
  if (!id) return '—';
  const person = (people.value ?? []).find((p: Person) => p.id === id);
  return person ? person.name : '—';
}

async function handleSubmitAssignment() {
  if (!khatibPersonId.value && !imamPersonId.value && !muazzinPersonId.value) {
    toast.error('Isi minimal satu peran: Khatib, Imam, atau Muazzin.');
    return;
  }

  isSavingAssignment.value = true;
  try {
    if (currentAssignment.value?.has_assignment) {
      const input: UpdateAssignmentInput = {
        khatibPersonId: khatibPersonId.value,
        imamPersonId: imamPersonId.value,
        muazzinPersonId: muazzinPersonId.value,
      };
      await updateAssignment(mosqueId, currentAssignment.value.id, input);
      toast.success('Jadwal Jumat diperbarui.');
    } else {
      const input: CreateAssignmentInput = {
        assignmentDate: targetDate.value,
        khatibPersonId: khatibPersonId.value,
        imamPersonId: imamPersonId.value,
        muazzinPersonId: muazzinPersonId.value,
      };
      await createAssignment(mosqueId, input);
      toast.success('Jadwal Jumat dibuat.');
    }
    await Promise.all([loadCurrentAssignment(), loadAssignmentHistory(1)]);
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 403) {
      isPastLocked.value = true;
      toast.error('Jadwal ini sudah lewat dan tidak bisa diubah.');
    } else {
      toast.error('Gagal menyimpan jadwal Jumat.');
    }
  } finally {
    isSavingAssignment.value = false;
  }
}

onMounted(async () => {
  await loadMosque();
  if (mosque.value) {
    await Promise.all([
      loadPeople(),
      loadCurrentAssignment(),
      loadAssignmentHistory(1),
    ]);
  }
});

const canManage = computed(() => Boolean(mosque.value) && !mosqueLoadFailed.value);
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <div v-if="mosqueLoadFailed" class="rounded-xl border border-dashed border-border p-12 text-center">
      <h1 class="font-display text-xl font-semibold">Masjid tidak ditemukan</h1>
      <p class="mt-2 text-sm text-muted-foreground">Masjid ini mungkin belum disetujui atau sudah dihapus.</p>
    </div>

    <template v-else-if="canManage && mosque">
      <div class="mb-6">
        <Badge variant="approved" class="mb-2">Panel Kelola Masjid</Badge>
        <h1 class="font-display text-2xl font-bold tracking-tight sm:text-3xl">{{ mosque.name }}</h1>
      </div>

      <Tabs :model-value="activeTab" @update:model-value="(v) => (activeTab = v === 'jadwal' ? 'jadwal' : 'person')">
        <TabsList>
          <TabsTrigger value="person">Person</TabsTrigger>
          <TabsTrigger value="jadwal">Jadwal Jumat</TabsTrigger>
        </TabsList>

        <!-- TAB 1: PERSON -->
        <TabsContent value="person" class="space-y-4 pt-4">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg font-semibold">Roster Khatib / Imam / Muazzin</h2>
            <Dialog v-model:open="addDialogOpen">
              <Button size="sm" @click="addDialogOpen = true">Tambah Person</Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Person</DialogTitle>
                  <DialogDescription>Nama akan muncul sebagai pilihan saat membuat jadwal Jumat.</DialogDescription>
                </DialogHeader>
                <div class="space-y-3 py-2">
                  <div class="space-y-1">
                    <Label for="add-name">Nama</Label>
                    <Input id="add-name" v-model="addName" placeholder="Ustadz Fulan" maxlength="200" />
                  </div>
                  <div class="space-y-1">
                    <Label for="add-phone">Telepon (opsional)</Label>
                    <Input id="add-phone" v-model="addPhone" placeholder="0812xxxxxxx" maxlength="30" />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose as-child>
                    <Button variant="outline" size="sm">Batal</Button>
                  </DialogClose>
                  <Button size="sm" :disabled="addSubmitting" @click="submitAdd">
                    {{ addSubmitting ? 'Menyimpan...' : 'Simpan' }}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead class="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="p in people" :key="p.id">
                <TableCell>{{ p.name }}</TableCell>
                <TableCell>{{ p.phone ?? '—' }}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="sm">⋮</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="openEdit(p)">Edit</DropdownMenuItem>
                      <DropdownMenuItem class="text-destructive" @click="openDelete(p)">Hapus</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              <TableEmpty v-if="!peopleLoading && people.length === 0" :colspan="3">
                Belum ada Person untuk masjid ini.
              </TableEmpty>
            </TableBody>
          </Table>
        </TabsContent>

        <!-- TAB 2: JADWAL JUMAT -->
        <TabsContent value="jadwal" class="space-y-6 pt-4">
          <div class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div>
              <h2 class="font-display text-lg font-semibold">
                {{ currentAssignment?.has_assignment ? 'Jadwal Jumat Saat Ini' : 'Buat Jadwal Jumat' }}
              </h2>
              <p class="text-xs text-muted-foreground mt-1">
                Tanggal:
                <span class="font-mono font-medium tabular-nums">
                  {{ currentAssignment?.has_assignment ? currentAssignment.assignmentDate : (currentAssignment?.assignment_date ?? targetDate) }}
                </span>
                (tidak dapat diubah setelah dibuat)
              </p>
            </div>

            <Alert v-if="isPastLocked" variant="destructive">
              <AlertDescription>
                Jadwal ini sudah lewat dan tidak bisa diubah. Tunggu sampai jadwal Jumat berikutnya tersedia.
              </AlertDescription>
            </Alert>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="space-y-1.5">
                <Label>Khatib</Label>
                <Select v-model="khatibPersonId" :disabled="isPastLocked">
                  <SelectTrigger><SelectValue placeholder="Pilih Khatib" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="p in people" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-1.5">
                <Label>Imam</Label>
                <Select v-model="imamPersonId" :disabled="isPastLocked">
                  <SelectTrigger><SelectValue placeholder="Pilih Imam" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="p in people" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-1.5">
                <Label>Muazzin</Label>
                <Select v-model="muazzinPersonId" :disabled="isPastLocked">
                  <SelectTrigger><SelectValue placeholder="Pilih Muazzin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="p in people" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button :disabled="isPastLocked || isSavingAssignment" @click="handleSubmitAssignment">
              {{ currentAssignment?.has_assignment ? 'Simpan Perubahan' : 'Buat Jadwal' }}
            </Button>
          </div>

          <div class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 class="font-display text-lg font-semibold">Riwayat Jadwal Jumat</h3>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Khatib</TableHead>
                  <TableHead>Imam</TableHead>
                  <TableHead>Muazzin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in history?.items ?? []" :key="item.id">
                  <TableCell class="font-mono tabular-nums font-medium">{{ item.assignmentDate }}</TableCell>
                  <TableCell>{{ personName(item.khatibPersonId) }}</TableCell>
                  <TableCell>{{ personName(item.imamPersonId) }}</TableCell>
                  <TableCell>{{ personName(item.muazzinPersonId) }}</TableCell>
                </TableRow>
                <TableEmpty v-if="!history?.items.length" :colspan="4">
                  Belum ada riwayat jadwal Jumat.
                </TableEmpty>
              </TableBody>
            </Table>

            <Pagination
              v-if="historyTotalPages > 1"
              class="mt-4"
              :total="history?.total ?? 0"
              :items-per-page="historyPageSize"
              :page="historyPage"
            >
              <PaginationContent>
                <PaginationFirst @click="loadAssignmentHistory(1)" />
                <PaginationPrevious @click="loadAssignmentHistory(Math.max(1, historyPage - 1))" />
                <PaginationItem
                  v-for="page in historyTotalPages"
                  :key="page"
                  :value="page"
                  :is-active="page === historyPage"
                  @click="loadAssignmentHistory(page)"
                >
                  {{ page }}
                </PaginationItem>
                <PaginationNext @click="loadAssignmentHistory(Math.min(historyTotalPages, historyPage + 1))" />
                <PaginationLast @click="loadAssignmentHistory(historyTotalPages)" />
              </PaginationContent>
            </Pagination>
          </div>
        </TabsContent>
      </Tabs>

      <!-- Edit Person Dialog -->
      <Dialog v-model:open="editDialogOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
          </DialogHeader>
          <div class="space-y-3 py-2">
            <div class="space-y-1">
              <Label for="edit-name">Nama</Label>
              <Input id="edit-name" v-model="editName" maxlength="200" />
            </div>
            <div class="space-y-1">
              <Label for="edit-phone">Telepon (opsional)</Label>
              <Input id="edit-phone" v-model="editPhone" maxlength="30" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose as-child>
              <Button variant="outline" size="sm">Batal</Button>
            </DialogClose>
            <Button size="sm" :disabled="editSubmitting" @click="submitEdit">
              {{ editSubmitting ? 'Menyimpan...' : 'Simpan' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Delete Person Dialog -->
      <Dialog v-model:open="deleteDialogOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Person?</DialogTitle>
            <DialogDescription>
              "{{ deleteTarget?.name }}" akan dihapus dari daftar aktif. Riwayat jadwal Jumat lama yang
              menyertakan nama ini tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose as-child>
              <Button variant="outline" size="sm">Batal</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" :disabled="deleteSubmitting" @click="confirmDelete">
              {{ deleteSubmitting ? 'Menghapus...' : 'Hapus' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
