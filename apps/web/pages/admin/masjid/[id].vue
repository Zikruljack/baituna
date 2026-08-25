<script setup lang="ts">
import { CalendarDate, type DateValue, getLocalTimeZone, today } from '@internationalized/date';
import { computed, onMounted, ref, watch } from 'vue';
import { toast } from 'vue-sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
  FridayAssignment,
  PaginatedAssignments,
  Person,
  UpdateAssignmentInput,
} from '~/types/api';

/** Parses a YYYY-MM-DD string into a CalendarDate for the Calendar component's v-model. */
function isoToCalendarDate(iso: string): CalendarDate {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return new CalendarDate(year, month, day);
}

/** Formats a CalendarDate (or any DateValue) back to a YYYY-MM-DD string, matching assignmentDate's wire format. */
function calendarDateToIso(date: DateValue): string {
  const year = String(date.year).padStart(4, '0');
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
const { getHistory, create: createAssignment, update: updateAssignment } = useFridayAssignment();

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
const history = ref<PaginatedAssignments | null>(null);
const historyPage = ref(1);
const historyPageSize = 20;
const historyTotalPages = computed(() => {
  if (!history.value) return 1;
  return Math.max(1, Math.ceil(history.value.total / history.value.pageSize));
});

const { getMyMosque, updatePrayerTime } = useMosques();

const fridayPrayerTime = ref<string | null>(null);
const prayerTimeDialogOpen = ref(false);
const prayerTimeInput = ref('');
const prayerTimeSaving = ref(false);

// getMyMosque() only returns a value for the mosque this caller (as mosque_admin) owns.
// A super_admin managing another mosque_admin's mosque will see fridayPrayerTime as
// always null here — acceptable gap for MVP, not a primary flow.
async function loadPrayerTime() {
  const owned = await getMyMosque();
  fridayPrayerTime.value = owned?.id === mosqueId ? owned.fridayPrayerTime : null;
}

async function submitPrayerTime() {
  prayerTimeSaving.value = true;
  try {
    await updatePrayerTime(mosqueId, prayerTimeInput.value);
    fridayPrayerTime.value = prayerTimeInput.value;
    prayerTimeDialogOpen.value = false;
    toast.success('Waktu shalat Jumat diperbarui.');
  } catch {
    toast.error('Gagal memperbarui waktu shalat Jumat.');
  } finally {
    prayerTimeSaving.value = false;
  }
}

function openPrayerTimeDialog() {
  prayerTimeInput.value = fridayPrayerTime.value ?? '';
  prayerTimeDialogOpen.value = true;
}

const selectedDateIso = ref<string>(getCurrentOrNextFridayWib(new Date()));
const selectedDateValue = computed<DateValue>({
  get: () => isoToCalendarDate(selectedDateIso.value),
  set: (value) => {
    selectedDateIso.value = calendarDateToIso(value);
  },
});
const allAssignments = ref<FridayAssignment[]>([]);

async function loadAllAssignments() {
  const result = await getHistory(mosqueId, 1, 100);
  allAssignments.value = result.items;
}

const nextFridayDate = computed(() => getCurrentOrNextFridayWib(new Date()));

const nextFridayHasAssignment = computed(() =>
  allAssignments.value.some((a) => a.assignmentDate === nextFridayDate.value),
);

const assignmentForSelectedDate = computed(
  () => allAssignments.value.find((a) => a.assignmentDate === selectedDateIso.value) ?? null,
);

const isSelectedDatePast = computed(
  () => selectedDateValue.value.compare(today(getLocalTimeZone())) < 0,
);

function isCalendarDateDisabled(date: DateValue): boolean {
  const jsDate = date.toDate(getLocalTimeZone());
  const isFridayDate = jsDate.getDay() === 5;
  const isPast = date.compare(today(getLocalTimeZone())) < 0;
  return !isFridayDate || isPast;
}

const khatibPersonId = ref<string | null>(null);
const imamPersonId = ref<string | null>(null);
const muazzinPersonId = ref<string | null>(null);
const isPastLocked = ref(false);
const isSavingAssignment = ref(false);

async function loadAssignmentHistory(page = historyPage.value) {
  try {
    history.value = await getHistory(mosqueId, page, historyPageSize);
    historyPage.value = page;
  } catch {
    toast.error('Gagal memuat riwayat jadwal');
  }
}

watch(
  assignmentForSelectedDate,
  (value) => {
    khatibPersonId.value = value?.khatibPersonId ?? null;
    imamPersonId.value = value?.imamPersonId ?? null;
    muazzinPersonId.value = value?.muazzinPersonId ?? null;
    isPastLocked.value = false;
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
    if (assignmentForSelectedDate.value) {
      const input: UpdateAssignmentInput = {
        khatibPersonId: khatibPersonId.value,
        imamPersonId: imamPersonId.value,
        muazzinPersonId: muazzinPersonId.value,
      };
      await updateAssignment(mosqueId, assignmentForSelectedDate.value.id, input);
      toast.success('Jadwal Jumat diperbarui.');
    } else {
      const input: CreateAssignmentInput = {
        assignmentDate: selectedDateIso.value,
        khatibPersonId: khatibPersonId.value,
        imamPersonId: imamPersonId.value,
        muazzinPersonId: muazzinPersonId.value,
      };
      await createAssignment(mosqueId, input);
      toast.success('Jadwal Jumat dibuat.');
    }
    await Promise.all([loadAllAssignments(), loadAssignmentHistory(1)]);
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
      loadAllAssignments(),
      loadAssignmentHistory(1),
      loadPrayerTime(),
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
            <div class="flex items-center justify-between">
              <div>
                <h2 class="font-display text-lg font-semibold">Shalat Jumat</h2>
                <p class="text-sm text-muted-foreground">
                  Dimulai pukul
                  <span class="font-medium text-foreground">{{ fridayPrayerTime ?? 'Belum diatur' }}</span>
                </p>
              </div>
              <Button variant="ghost" size="sm" @click="openPrayerTimeDialog">Ubah</Button>
            </div>

            <Alert v-if="!nextFridayHasAssignment" variant="default">
              <AlertDescription>
                Jadwal Jumat depan ({{ nextFridayDate }}) belum diisi.
              </AlertDescription>
            </Alert>

            <Calendar
              v-model="selectedDateValue"
              :is-date-disabled="isCalendarDateDisabled"
            />

            <Alert v-if="isPastLocked" variant="destructive">
              <AlertDescription>
                Jadwal ini sudah lewat dan tidak bisa diubah. Tunggu sampai jadwal Jumat berikutnya tersedia.
              </AlertDescription>
            </Alert>

            <div class="text-xs text-muted-foreground">
              Tanggal terpilih:
              <span class="font-mono font-medium tabular-nums">{{ selectedDateIso }}</span>
              <span v-if="isSelectedDatePast"> (sudah lewat)</span>
              <span v-else-if="assignmentForSelectedDate"> (sudah terisi — mode edit)</span>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="space-y-1.5">
                <Label>Khatib</Label>
                <Select v-model="khatibPersonId" :disabled="isPastLocked || isSelectedDatePast">
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
                <Select v-model="imamPersonId" :disabled="isPastLocked || isSelectedDatePast">
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
                <Select v-model="muazzinPersonId" :disabled="isPastLocked || isSelectedDatePast">
                  <SelectTrigger><SelectValue placeholder="Pilih Muazzin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="p in people" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button :disabled="isPastLocked || isSelectedDatePast || isSavingAssignment" @click="handleSubmitAssignment">
              {{ assignmentForSelectedDate ? 'Simpan Perubahan' : 'Buat Jadwal' }}
            </Button>
          </div>

          <Dialog v-model:open="prayerTimeDialogOpen">
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ubah Waktu Shalat Jumat</DialogTitle>
                <DialogDescription>Berlaku untuk semua jadwal Jumat mendatang sampai diubah lagi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1 py-2">
                <Label for="prayer-time">Jam Mulai</Label>
                <Input id="prayer-time" v-model="prayerTimeInput" type="time" />
              </div>
              <DialogFooter>
                <DialogClose as-child>
                  <Button variant="outline" size="sm">Batal</Button>
                </DialogClose>
                <Button size="sm" :disabled="prayerTimeSaving" @click="submitPrayerTime">
                  {{ prayerTimeSaving ? 'Menyimpan...' : 'Simpan' }}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
