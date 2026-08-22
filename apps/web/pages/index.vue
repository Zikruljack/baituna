<script setup lang="ts">
const { data: health } = await useFetch<{ status: string }>('/api/health');
</script>

<template>
  <main>
    <h1>Baituna</h1>
    <p>Open-source mosque management platform.</p>
    <p v-if="health">API status: {{ health.status }}</p>
    <p><NuxtLink to="/api/docs">Open API documentation</NuxtLink></p>
  </main>
</template>
