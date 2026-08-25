// apps/web/middleware/require-role.ts
import { toast } from 'vue-sonner';

import type { UserRole } from '~/lib/auth-types';

declare module '#app' {
  interface PageMeta {
    requiredRoles?: UserRole[];
  }
}

/**
 * Redirects to / if the current user's role is not in the page's
 * `requiredRoles` meta. Must run after the 'auth' middleware (which
 * guarantees a token exists) — apply both together:
 * definePageMeta({ middleware: ['auth', 'require-role'], requiredRoles: [...] }).
 */
export default defineNuxtRouteMiddleware((to) => {
  const requiredRoles = to.meta.requiredRoles as UserRole[] | undefined;
  if (!requiredRoles || requiredRoles.length === 0) return;

  const { user } = useAuth();
  if (!user.value || !requiredRoles.includes(user.value.role)) {
    toast.error('Anda tidak memiliki akses ke halaman ini.');
    return navigateTo('/');
  }
});
