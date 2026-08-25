<script setup lang="ts">
import { toast } from 'vue-sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AuthResponse } from '~/lib/auth-types';
import type { DuplicateWarning } from '~/types/api';

const { user, isAuthenticated, setSession } = useAuth();
const { submitMosqueRegistration } = useMosqueRegistration();
const { listProvinces, listCities } = useRegions();

const submitterName = ref('');
const email = ref('');
const password = ref('');
const name = ref('');
const address = ref('');
const provinceId = ref('');
const cityId = ref('');
const latitude = ref('');
const longitude = ref('');

const provinces = ref<{ id: string; name: string }[]>([]);
const cities = ref<{ id: string; name: string; provinceId: string }[]>([]);
const isSubmitting = ref(false);
const isLocating = ref(false);
const duplicateWarning = ref<DuplicateWarning[]>([]);
const errorMessage = ref('');

onMounted(async () => {
  provinces.value = await listProvinces();
});

watch(provinceId, async (newProvinceId) => {
  cityId.value = '';
  cities.value = newProvinceId ? await listCities(newProvinceId) : [];
});

function useMyLocation() {
  if (!navigator.geolocation) {
    toast.error('Browser Anda tidak mendukung deteksi lokasi.');
    return;
  }
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      latitude.value = position.coords.latitude.toFixed(7);
      longitude.value = position.coords.longitude.toFixed(7);
      isLocating.value = false;
    },
    () => {
      toast.error('Gagal mendapatkan lokasi. Isi koordinat secara manual.');
      isLocating.value = false;
    },
  );
}

async function onSubmit() {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    const result = await submitMosqueRegistration({
      name: name.value,
      address: address.value,
      latitude: latitude.value,
      longitude: longitude.value,
      cityId: cityId.value,
      provinceId: provinceId.value,
      ...(isAuthenticated.value
        ? {}
        : { submitterName: submitterName.value, email: email.value, password: password.value }),
    });
    duplicateWarning.value = result.duplicateWarning;

    if (result.token && result.user) {
      setSession({ token: result.token, user: result.user } as AuthResponse);
    }

    toast.success('Pendaftaran masjid berhasil dikirim.');
    await navigateTo('/masjid/pendaftaran-saya');
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 409) {
      errorMessage.value = 'Email sudah terdaftar. Masuk ke akun Anda lalu ajukan pendaftaran masjid dari sana.';
    } else if (statusCode === 403) {
      errorMessage.value = 'Akun Anda sudah menjadi admin masjid lain. Satu akun hanya bisa mengelola satu masjid.';
    } else {
      errorMessage.value = 'Gagal mengirim pendaftaran. Periksa kembali data yang diisi.';
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
    <Card>
      <CardHeader>
        <CardTitle class="font-display text-xl">Daftarkan Masjid</CardTitle>
        <CardDescription>Lengkapi data masjid untuk diverifikasi oleh Super Admin.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <Alert v-if="isAuthenticated && user">
          <AlertDescription>Anda mendaftar sebagai {{ user.name }} ({{ user.email }}).</AlertDescription>
        </Alert>

        <Alert v-if="duplicateWarning.length > 0" variant="default">
          <AlertTitle>Kemungkinan Masjid Serupa Ditemukan</AlertTitle>
          <AlertDescription>
            <ul class="mt-2 space-y-1 text-xs">
              <li v-for="candidate in duplicateWarning" :key="candidate.id">
                {{ candidate.name }} — {{ candidate.address }} ({{ Math.round(candidate.distanceMeters) }}m, kemiripan {{ Math.round(candidate.nameSimilarity * 100) }}%)
              </li>
            </ul>
            <p class="mt-2">Pendaftaran Anda tetap tersimpan dan akan diproses.</p>
          </AlertDescription>
        </Alert>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <template v-if="!isAuthenticated">
            <div class="space-y-2">
              <Label for="submitterName">Nama Pendaftar</Label>
              <Input id="submitterName" v-model="submitterName" required maxlength="200" />
            </div>
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input id="email" v-model="email" type="email" required placeholder="nama@gmail.com" />
            </div>
            <div class="space-y-2">
              <Label for="password">Kata Sandi</Label>
              <Input id="password" v-model="password" type="password" required minlength="8" />
              <p class="text-xs text-muted-foreground">Minimal 8 karakter.</p>
            </div>
          </template>

          <div class="space-y-2">
            <Label for="name">Nama Masjid</Label>
            <Input id="name" v-model="name" required maxlength="200" />
          </div>

          <div class="space-y-2">
            <Label for="address">Alamat</Label>
            <Textarea id="address" v-model="address" required maxlength="500" rows="3" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label>Provinsi</Label>
              <Select v-model="provinceId">
                <SelectTrigger><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="p in provinces" :key="p.id" :value="p.id">{{ p.name }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>Kabupaten/Kota</Label>
              <Select v-model="cityId" :disabled="!provinceId">
                <SelectTrigger><SelectValue placeholder="Pilih kabupaten/kota" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label>Koordinat</Label>
              <Button type="button" variant="outline" size="sm" :disabled="isLocating" @click="useMyLocation">
                {{ isLocating ? 'Mendeteksi...' : 'Gunakan Lokasi Saya Sekarang' }}
              </Button>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <Input v-model="latitude" placeholder="Latitude" required />
              <Input v-model="longitude" placeholder="Longitude" required />
            </div>
          </div>

          <Button type="submit" class="w-full" :disabled="isSubmitting">
            {{ isSubmitting ? 'Mengirim...' : 'Kirim Pendaftaran' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
