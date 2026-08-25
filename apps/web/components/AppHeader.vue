<script setup lang="ts">
import { computed } from 'vue';
import {
  BookOpen,
  Building2,
  ChevronDown,
  ClipboardList,
  Compass,
  Github,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  PlusCircle,
  ShieldAlert,
  Sun,
  User as UserIcon,
} from 'lucide-vue-next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const colorMode = useColorMode();
const { user, isAuthenticated, logout } = useAuth();

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}

const roleBadgeLabel = computed(() => {
  if (!user.value) return '';
  if (user.value.role === 'super_admin') return 'Super Admin';
  if (user.value.role === 'mosque_admin') return 'Pengelola DKM';
  return 'Jamaah';
});
</script>

<template>
  <header class="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md transition-colors">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <!-- Logo & Brand -->
      <div class="flex items-center gap-8">
        <NuxtLink to="/" class="group flex items-center gap-3">
          <div class="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <Building2 class="size-5" />
          </div>
          <div class="flex flex-col">
            <span class="font-display text-xl font-bold tracking-tight text-foreground">Baituna</span>
            <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Portal Masjid Aceh</span>
          </div>
        </NuxtLink>

        <!-- Navigation Links -->
        <nav class="hidden items-center gap-1 md:flex">
          <NuxtLink
            to="/"
            class="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-card hover:text-primary transition-colors"
          >
            Beranda
          </NuxtLink>
          <NuxtLink
            to="/#masjid"
            class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
          >
            <Compass class="size-4" />
            Cari Masjid
          </NuxtLink>
          <NuxtLink
            to="/#jadwal-jumat"
            class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
          >
            <BookOpen class="size-4" />
            Jadwal Jumat
          </NuxtLink>
        </nav>
      </div>

      <!-- Action Buttons, User Menu & Theme Switcher -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Theme Toggle -->
        <Button
          variant="outline"
          size="icon-sm"
          class="rounded-lg border-border text-foreground hover:bg-card"
          aria-label="Toggle theme"
          @click="toggleTheme"
        >
          <ClientOnly>
            <Sun v-if="colorMode.value === 'dark'" class="size-4 text-secondary-foreground" />
            <Moon v-else class="size-4 text-foreground" />
            <template #fallback>
              <div class="size-4" />
            </template>
          </ClientOnly>
        </Button>

        <!-- GitHub Repo Button -->
        <a
          href="https://github.com/Zikruljack/baituna"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub Repository Baituna"
        >
          <Button
            variant="outline"
            size="icon-sm"
            class="rounded-lg border-border text-foreground hover:bg-card"
          >
            <Github class="size-4" />
          </Button>
        </a>

        <!-- Authenticated User Dropdown Menu -->
        <div v-if="isAuthenticated && user" class="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="sm" class="gap-2 px-3">
                <div class="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon class="size-3.5" />
                </div>
                <span class="max-w-[120px] truncate text-xs font-medium sm:max-w-[160px]">
                  {{ user.name }}
                </span>
                <ChevronDown class="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuLabel class="space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-medium text-sm text-foreground truncate">{{ user.name }}</span>
                </div>
                <div class="text-[11px] text-muted-foreground truncate">{{ user.email }}</div>
                <Badge variant="secondary" class="mt-1 text-[10px] px-1.5 py-0 font-normal">
                  {{ roleBadgeLabel }}
                </Badge>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <NuxtLink to="/admin">
                <DropdownMenuItem class="cursor-pointer gap-2">
                  <LayoutDashboard class="size-4 text-primary" />
                  <span>Dashboard</span>
                </DropdownMenuItem>
              </NuxtLink>

              <NuxtLink to="/masjid/pendaftaran-saya">
                <DropdownMenuItem class="cursor-pointer gap-2">
                  <ClipboardList class="size-4 text-muted-foreground" />
                  <span>Pendaftaran Saya</span>
                </DropdownMenuItem>
              </NuxtLink>

              <NuxtLink v-if="user.role === 'super_admin'" to="/admin/pendaftaran">
                <DropdownMenuItem class="cursor-pointer gap-2">
                  <ShieldAlert class="size-4 text-amber-500" />
                  <span>Antrean Persetujuan</span>
                </DropdownMenuItem>
              </NuxtLink>

              <NuxtLink to="/masjid/daftar">
                <DropdownMenuItem class="cursor-pointer gap-2">
                  <PlusCircle class="size-4 text-muted-foreground" />
                  <span>Daftarkan Masjid Baru</span>
                </DropdownMenuItem>
              </NuxtLink>

              <DropdownMenuSeparator />

              <DropdownMenuItem class="cursor-pointer gap-2 text-destructive focus:text-destructive" @click="logout">
                <LogOut class="size-4" />
                <span>Keluar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <!-- Guest Menu -->
        <div v-else class="flex items-center gap-2">
          <NuxtLink to="/masjid/daftar" class="hidden sm:inline-flex">
            <Button variant="outline" size="sm" class="gap-1.5">
              <PlusCircle class="size-4 text-primary" />
              <span>Daftar Masjid</span>
            </Button>
          </NuxtLink>

          <NuxtLink to="/login">
            <Button size="sm" class="gap-1.5">
              <LogIn class="size-4" />
              <span>Masuk</span>
            </Button>
          </NuxtLink>
        </div>
      </div>
    </div>
  </header>
</template>
