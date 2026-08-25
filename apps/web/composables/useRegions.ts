// apps/web/composables/useRegions.ts
import type { CityOption, RegionOption } from '~/types/api';

/** Read-only Province/City lookups (Module 2 backend). Both endpoints are public — no auth header needed. */
export function useRegions() {
  async function listProvinces(): Promise<RegionOption[]> {
    const { data } = await $fetch<{ data: RegionOption[] }>('/api/provinces');
    return data;
  }

  async function listCities(provinceId: string): Promise<CityOption[]> {
    const { data } = await $fetch<{ data: CityOption[] }>(`/api/provinces/${provinceId}/cities`);
    return data;
  }

  return { listProvinces, listCities };
}
