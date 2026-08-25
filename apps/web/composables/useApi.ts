// apps/web/composables/useApi.ts
import type { UseFetchOptions } from '#app';

/** useFetch wrapper that attaches the bearer token cookie, if present, to every request. */
export function useApi<T>(url: string | (() => string), opts?: UseFetchOptions<T>) {
  const token = useAuthToken();

  return useFetch(url, {
    ...opts,
    headers: computed(() => ({
      ...(opts?.headers as Record<string, string> | undefined),
      ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
    })),
  });
}
