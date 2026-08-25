// apps/web/composables/useMosques.ts
import type { MyMosque } from '~/types/api';

/** Read access to the mosque a mosque_admin owns. */
export function useMosques() {
  const token = useAuthToken();

  function authHeaders(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {};
  }

  async function getMyMosque(): Promise<MyMosque | null> {
    return await $fetch<MyMosque | null>('/api/mosques/my-mosque', {
      headers: authHeaders(),
    });
  }

  return { getMyMosque };
}
