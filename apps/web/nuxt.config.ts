export default defineNuxtConfig({
  compatibilityDate: '2026-08-22',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint'],
  typescript: {
    strict: true,
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
  },
  nitro: {
    routeRules: {
      '/api/mosques/nearby': { cors: true },
      '/api/mosques/search': { cors: true },
    },
  },
});
