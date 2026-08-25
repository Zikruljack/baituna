// apps/web/middleware/auth.ts

/** Redirects to /login if there is no auth token cookie. Apply via definePageMeta({ middleware: 'auth' }). */
export default defineNuxtRouteMiddleware(async (to) => {
  const token = useAuthToken();
  if (!token.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }

  await useAuth().init();
});
