<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'require-role'],
  requiredRoles: ['mosque_admin'],
});

const route = useRoute();
const { getMyMosque } = useMosques();

onMounted(async () => {
  const mosque = await getMyMosque();
  if (!mosque) {
    await navigateTo('/masjid/pendaftaran-saya');
    return;
  }
  await navigateTo({ path: `/admin/masjid/${mosque.id}`, query: route.query });
});
</script>

<template>
  <div class="flex min-h-[50vh] items-center justify-center">
    <p class="text-sm text-muted-foreground">Memuat...</p>
  </div>
</template>
