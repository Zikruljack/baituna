import { and, asc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../../drizzle/schema';
import { cities, provinces } from '../../drizzle/schema';

export type RegionDatabase = NodePgDatabase<typeof schema>;

export interface RegionOption {
  id: string;
  name: string;
}

export interface CityOption extends RegionOption {
  provinceId: string;
}

/** Lists public Province options that have not been soft-deleted. */
export async function listActiveProvinces(db: RegionDatabase): Promise<RegionOption[]> {
  return await db
    .select({ id: provinces.id, name: provinces.name })
    .from(provinces)
    .where(isNull(provinces.deletedAt))
    .orderBy(asc(provinces.name));
}

/** Finds one active Province so routes can distinguish missing Regions from empty City lists. */
export async function findActiveProvince(
  db: RegionDatabase,
  provinceId: string,
): Promise<RegionOption | null> {
  const rows = await db
    .select({ id: provinces.id, name: provinces.name })
    .from(provinces)
    .where(and(eq(provinces.id, provinceId), isNull(provinces.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

/** Lists public City options belonging to one active Province. */
export async function listActiveCities(
  db: RegionDatabase,
  provinceId: string,
): Promise<CityOption[]> {
  return await db
    .select({ id: cities.id, name: cities.name, provinceId: cities.provinceId })
    .from(cities)
    .where(and(eq(cities.provinceId, provinceId), isNull(cities.deletedAt)))
    .orderBy(asc(cities.name));
}
