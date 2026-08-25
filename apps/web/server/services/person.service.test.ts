import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { cities, mosques, people, provinces } from '../../drizzle/schema';
import { listActivePeople } from './person.service';

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('person.service', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  async function seedMosque() {
    const [province] = await db.insert(provinces).values({ name: `Prov ${Date.now()}-${Math.random()}` }).returning();
    if (!province) throw new Error('province insert failed');
    const [city] = await db.insert(cities).values({ name: `City ${Date.now()}-${Math.random()}`, provinceId: province.id }).returning();
    if (!city) throw new Error('city insert failed');
    const [mosque] = await db
      .insert(mosques)
      .values({
        name: `Masjid ${Date.now()}`,
        address: 'Jl. Test',
        latitude: '5.5500000',
        longitude: '95.3200000',
        cityId: city.id,
        provinceId: province.id,
        status: 'approved',
      })
      .returning();
    if (!mosque) throw new Error('mosque insert failed');
    return mosque;
  }

  describe('listActivePeople', () => {
    it('lists active Person rows for a mosque, alphabetically', async () => {
      const mosque = await seedMosque();
      await db.insert(people).values([
        { mosqueId: mosque.id, name: 'Zainal', phone: null },
        { mosqueId: mosque.id, name: 'Ahmad', phone: '0812' },
      ]);

      const result = await listActivePeople(db, mosque.id);
      expect(result.map((p) => p.name)).toEqual(['Ahmad', 'Zainal']);
    });

    it('excludes soft-deleted Person rows', async () => {
      const mosque = await seedMosque();
      const [inserted] = await db.insert(people).values({ mosqueId: mosque.id, name: 'Deleted Guy', phone: null }).returning();
      if (!inserted) throw new Error('person insert failed');
      await db.update(people).set({ deletedAt: new Date() }).where(eq(people.id, inserted.id));

      const result = await listActivePeople(db, mosque.id);
      expect(result.find((p) => p.id === inserted.id)).toBeUndefined();
    });

    it('does not return Person rows belonging to a different mosque', async () => {
      const mosqueA = await seedMosque();
      const mosqueB = await seedMosque();
      await db.insert(people).values({ mosqueId: mosqueA.id, name: 'Only In A', phone: null });

      const result = await listActivePeople(db, mosqueB.id);
      expect(result.find((p) => p.name === 'Only In A')).toBeUndefined();
    });
  });
});
