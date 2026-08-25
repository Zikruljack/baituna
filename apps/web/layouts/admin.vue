<script setup lang="ts">
import { Building2, LogOut, ShieldAlert, Users, Calendar as CalendarIcon, LayoutDashboard } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const { user, logout } = useAuth();

const roleLabel = computed(() => {
  if (user.value?.role === 'super_admin') return 'Super Admin';
  if (user.value?.role === 'mosque_admin') return 'Pengelola DKM';
  return '';
});

async function onLogout() {
  logout();
  await navigateTo('/');
}
</script>

<template>
  <div class="flex min-h-screen bg-background text-foreground">
    <aside class="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      <!-- Top Sticky Header -->
      <div class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
        <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
          <Building2 class="size-4" />
        </div>
        <div class="flex flex-col">
          <span class="font-display text-base font-bold leading-tight">Baituna</span>
          <span class="text-[10px] text-muted-foreground">Admin Portal</span>
        </div>
      </div>

      <!-- Middle Scrollable Navigation -->
      <nav class="flex-1 overflow-y-auto space-y-1 p-3">
        <NuxtLink
          v-if="user?.role === 'super_admin'"
          to="/admin/pendaftaran"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          active-class="bg-primary/10 text-primary font-semibold"
        >
          <ShieldAlert class="size-4" />
          Antrean Approval
        </NuxtLink>

        <template v-if="user?.role === 'mosque_admin'">
          <NuxtLink
            to="/dashboard"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            active-class="bg-primary/10 text-primary font-semibold"
          >
            <LayoutDashboard class="size-4" />
            Ringkasan
          </NuxtLink>
          <NuxtLink
            :to="{ path: '/admin/masjid/my-mosque', query: { tab: 'person' } }"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            active-class="bg-primary/10 text-primary font-semibold"
          >
            <Users class="size-4" />
            Person
          </NuxtLink>
          <NuxtLink
            :to="{ path: '/admin/masjid/my-mosque', query: { tab: 'jadwal' } }"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            active-class="bg-primary/10 text-primary font-semibold"
          >
            <CalendarIcon class="size-4" />
            Jadwal Jumat
          </NuxtLink>
        </template>
      </nav>

      <!-- Bottom Sticky Footer -->
      <div class="sticky bottom-0 z-10 shrink-0 border-t border-border bg-card p-3 space-y-2">
        <div class="px-1">
          <p class="truncate text-sm font-medium text-foreground">{{ user?.name }}</p>
          <Badge variant="secondary" class="mt-1 text-[10px] px-1.5 py-0 font-normal">{{ roleLabel }}</Badge>
        </div>
        <Button variant="outline" size="sm" class="w-full justify-start gap-2 hover:bg-accent text-muted-foreground hover:text-foreground" @click="onLogout">
          <LogOut class="size-4" />
          Keluar
        </Button>
      </div>
    </aside>

    <main class="flex-1 min-w-0">
      <slot />
    </main>
  </div>
</template>
