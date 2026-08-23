<!-- apps/web/pages/auth/callback.vue -->
<script setup lang="ts">
import type { AuthResponse } from '~/lib/auth-types';

const route = useRoute();
const { setSession } = useAuth();
const errorMessage = ref('');

onMounted(async () => {
  const code = route.query.code;
  const state = route.query.state;

  if (typeof code !== 'string' || typeof state !== 'string') {
    errorMessage.value = 'Tautan Google tidak valid.';
    return;
  }

  try {
    const auth = await $fetch<AuthResponse>('/api/auth/google/callback', {
      query: { code, state },
    });
    setSession(auth);
    await navigateTo('/');
  } catch {
    errorMessage.value = 'Gagal masuk dengan Google. Silakan coba lagi.';
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Alert v-if="errorMessage" variant="destructive" class="max-w-sm">
      <AlertDescription>{{ errorMessage }}</AlertDescription>
    </Alert>
    <p v-else class="text-muted-foreground text-sm">Menyelesaikan proses masuk...</p>
  </div>
</template>
