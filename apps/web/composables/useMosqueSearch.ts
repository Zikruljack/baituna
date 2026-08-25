// apps/web/composables/useMosqueSearch.ts
import type { MosqueDetail, MosqueSummary } from '~/types/api';

const DEFAULT_RADIUS_KM = 5;
const GEOLOCATION_TIMEOUT_MS = 8000;

function getBrowserPosition(): Promise<GeolocationPosition | null> {
  if (!import.meta.client || !('geolocation' in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { timeout: GEOLOCATION_TIMEOUT_MS },
    );
  });
}

export function useMosqueSearch() {
  async function nearby(radiusKm: number = DEFAULT_RADIUS_KM): Promise<MosqueSummary[]> {
    const position = await getBrowserPosition();
    if (!position) return [];

    return await $fetch<MosqueSummary[]>('/api/mosques/nearby', {
      query: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        radius: radiusKm,
      },
    });
  }

  async function search(query: string): Promise<MosqueSummary[]> {
    return await $fetch<MosqueSummary[]>('/api/mosques/search', {
      query: { q: query },
    });
  }

  async function detail(id: string): Promise<MosqueDetail | null> {
    try {
      return await $fetch<MosqueDetail>(`/api/mosques/${id}`);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  return { nearby, search, detail };
}
