<!-- apps/web/pages/login.vue -->
<script setup lang="ts">
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
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>Masuk ke akun Baituna Anda</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" placeholder="nama@email.com" required autocomplete="email" />
          </div>
          <div class="space-y-2">
            <Label for="password">Kata Sandi</Label>
            <Input id="password" v-model="password" type="password" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <Button type="submit" class="w-full" :disabled="isSubmitting">
            {{ isSubmitting ? 'Memproses...' : 'Masuk' }}
          </Button>
        </form>

        <Button variant="outline" class="w-full" @click="loginWithGoogle">
          Masuk dengan Google
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
