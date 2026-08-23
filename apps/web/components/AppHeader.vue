<script setup lang="ts">
import { Moon, Sun, Building2, BookOpen, Compass, LogIn, LogOut, PlusCircle, Github } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

const colorMode = useColorMode();
const { user, isAuthenticated, logout } = useAuth();

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}
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

      <!-- Action Buttons & Theme Switcher -->
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

        <NuxtLink to="/#daftar-masjid" class="hidden sm:inline-flex">
          <Button variant="outline" size="sm" class="gap-1.5">
            <PlusCircle class="size-4 text-primary" />
            <span>Daftar Masjid</span>
          </Button>
        </NuxtLink>

        <Transition name="fade" mode="out-in">
          <div v-if="isAuthenticated && user" key="auth-user" class="flex items-center gap-2">
            <span class="text-xs font-medium hidden md:inline-block text-muted-foreground">
              {{ user.name }}
            </span>
            <Button variant="outline" size="sm" class="gap-1.5" @click="logout">
              <LogOut class="size-4" />
              <span>Keluar</span>
            </Button>
          </div>
          <div v-else key="auth-guest">
            <NuxtLink to="/login">
              <Button size="sm" class="gap-1.5">
                <LogIn class="size-4" />
                <span>Masuk</span>
              </Button>
            </NuxtLink>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
