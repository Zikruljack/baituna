import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { cities, fridayAssignments, mosques, people, provinces, users } from '../../drizzle/schema';
import { createAssignment } from './friday-assignment.service';

const RUN_DB_TESTS = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_DB_TESTS)('friday-assignment.service', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  async function seedMosqueWithPerson() {
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
    const [person] = await db.insert(people).values({ mosqueId: mosque.id, name: 'Khatib Test', phone: null }).returning();
    if (!person) throw new Error('person insert failed');
    return { mosque, person };
  }

  async function seedUser() {
    const unique = randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        name: `Actor ${unique}`,
        email: `actor-${unique}@example.test`,
        role: 'mosque_admin',
        provider: 'local',
      })
      .returning();
    if (!user) throw new Error('user insert failed');
    return user;
  }

  describe('createAssignment', () => {
    it('creates an assignment for a valid future Friday', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      const actor = await seedUser();
      // A far-future Friday so this test never becomes a "past date" failure.
      const result = await createAssignment(
        db,
        mosque.id,
        { assignmentDate: '2099-01-02', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null },
        actor.id,
      );

      expect(result.assignmentDate).toBe('2099-01-02');
      const [row] = await db.select().from(fridayAssignments).where(eq(fridayAssignments.id, result.id));
      expect((row?.history as unknown[]).length).toBe(1);
    });

    it('rejects a non-Friday date', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      const actor = await seedUser();
      // 2099-01-03 is a Saturday.
      await expect(
        createAssignment(db, mosque.id, { assignmentDate: '2099-01-03', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, actor.id),
      ).rejects.toThrow();
    });

    it('rejects a Person id that belongs to a different mosque', async () => {
      const { mosque } = await seedMosqueWithPerson();
      const { person: foreignPerson } = await seedMosqueWithPerson();
      const actor = await seedUser();

      await expect(
        createAssignment(db, mosque.id, { assignmentDate: '2099-01-09', khatibPersonId: foreignPerson.id, imamPersonId: null, muazzinPersonId: null }, actor.id),
      ).rejects.toThrow();
    });

    it('rejects a duplicate (mosque, date) pair with a clean error', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      const actor = await seedUser();
      await createAssignment(db, mosque.id, { assignmentDate: '2099-01-16', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, actor.id);

      await expect(
        createAssignment(db, mosque.id, { assignmentDate: '2099-01-16', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, actor.id),
      ).rejects.toThrow();
    });

    it('rejects a past Friday', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      const actor = await seedUser();
      await expect(
        createAssignment(db, mosque.id, { assignmentDate: '2020-01-03', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null }, actor.id),
      ).rejects.toThrow();
    });
  });
});
