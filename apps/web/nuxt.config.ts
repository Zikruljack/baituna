import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2026-08-22',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxtjs/color-mode'],
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
  },
  css: ['~/assets/css/tailwind.css'],
  app: {
    head: {
      title: 'Baituna - Platform Informasi Masjid Aceh',
      meta: [
        { name: 'description', content: 'Platform agregasi informasi masjid, jadwal shalat Jumat, profil khatib & imam, serta transparansi masjid di Aceh.' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;650;700&family=Inter:wght@400;500;600&display=swap',
        },
      ],
    },
  },
  components: [
    {
      path: '~/components/ui',
      extensions: ['.vue'],
      pathPrefix: false,
    },
    {
      path: '~/components',
      extensions: ['.vue'],
      pathPrefix: false,
    },
  ],
  typescript: {
    strict: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
  },
  nitro: {
    routeRules: {
      '/api/mosques/nearby': { cors: true },
      '/api/mosques/search': { cors: true },
    },
  },
});
