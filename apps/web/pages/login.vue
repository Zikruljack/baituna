<!-- apps/web/pages/login.vue -->
<script setup lang="ts">
import { ArrowLeft, Building2 } from 'lucide-vue-next';

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);

const { login, loginWithGoogle } = useAuth();

async function onSubmit() {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await login(email.value, password.value);
    await navigateTo('/');
  } catch {
    errorMessage.value = 'Email atau kata sandi salah.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm space-y-6">
      <!-- Back to Home link -->
      <div>
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft class="size-3.5" />
          <span>Kembali ke Beranda</span>
        </NuxtLink>
      </div>

      <Card class="w-full border-border/80 shadow-md transition-all">
        <CardHeader class="space-y-3 pb-4">
          <div class="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Building2 class="size-5" />
          </div>
          <div>
            <CardTitle class="font-display text-2xl font-bold">Masuk</CardTitle>
            <CardDescription class="text-xs text-muted-foreground mt-1">
              Masuk ke akun Baituna Anda untuk mengelola informasi masjid
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <Transition name="fade">
            <Alert v-if="errorMessage" variant="destructive">
              <AlertDescription>{{ errorMessage }}</AlertDescription>
            </Alert>
          </Transition>

          <form class="space-y-4" @submit.prevent="onSubmit">
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="nama@email.com"
                required
                autocomplete="email"
                class="transition-colors"
              />
            </div>
            <div class="space-y-2">
              <Label for="password">Kata Sandi</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                placeholder="••••••••"
                required
                autocomplete="current-password"
                class="transition-colors"
              />
            </div>
            <Button type="submit" class="w-full transition-all" :disabled="isSubmitting">
              {{ isSubmitting ? 'Memproses...' : 'Masuk' }}
            </Button>
          </form>

          <div class="relative flex items-center justify-center">
            <div class="absolute inset-0 flex items-center">
              <span class="w-full border-t border-border" />
            </div>
            <span class="relative bg-card px-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              atau
            </span>
          </div>

          <Button
            variant="outline"
            class="w-full transition-all hover:bg-card/80"
            @click="loginWithGoogle"
          >
            Masuk dengan Google
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
