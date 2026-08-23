import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../drizzle/schema.ts';
import { cities, provinces } from '../drizzle/schema.ts';
import { ACEH_CITY_NAMES, ACEH_PROVINCE } from './data/aceh-regions.ts';

interface SeedCounts {
  created: number;
  updated: number;
  restored: number;
}

function recordOutcome(counts: SeedCounts, deletedAt: Date | null | undefined) {
  if (deletedAt === undefined) {
    counts.created += 1;
  } else if (deletedAt === null) {
    counts.updated += 1;
  } else {
    counts.restored += 1;
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    const counts = await db.transaction(async (tx) => {
      const nextCounts: SeedCounts = { created: 0, updated: 0, restored: 0 };
      const now = new Date();
      const existingProvince = await tx
        .select({ deletedAt: provinces.deletedAt })
        .from(provinces)
        .where(eq(provinces.name, ACEH_PROVINCE))
        .limit(1);

      recordOutcome(nextCounts, existingProvince[0]?.deletedAt);

      const seededProvince = await tx
        .insert(provinces)
        .values({ name: ACEH_PROVINCE })
        .onConflictDoUpdate({
          target: provinces.name,
          set: { name: ACEH_PROVINCE, deletedAt: null, deletedBy: null, modifiedAt: now },
        })
        .returning({ id: provinces.id });
      const province = seededProvince[0];
      if (!province) throw new Error('Failed to seed Aceh Province');

      const existingCities = await tx
        .select({ name: cities.name, deletedAt: cities.deletedAt })
        .from(cities)
        .where(and(eq(cities.provinceId, province.id), inArray(cities.name, ACEH_CITY_NAMES)));
      const deletedAtByName = new Map(existingCities.map((city) => [city.name, city.deletedAt]));

      for (const cityName of ACEH_CITY_NAMES) {
        recordOutcome(nextCounts, deletedAtByName.get(cityName));
        await tx
          .insert(cities)
          .values({ provinceId: province.id, name: cityName })
          .onConflictDoUpdate({
            target: [cities.provinceId, cities.name],
            set: { name: cityName, deletedAt: null, deletedBy: null, modifiedAt: now },
          });
      }

      return nextCounts;
    });

    console.log(`Region seed complete: created=${counts.created}, updated=${counts.updated}, restored=${counts.restored}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
