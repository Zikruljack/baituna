import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { cities, fridayAssignments, mosques, people, provinces, users } from '../../drizzle/schema';
import { createAssignment, updateAssignment } from './friday-assignment.service';

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

  describe('updateAssignment', () => {
    it('updates person assignments for a future Friday', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      const actor1 = await seedUser();
      const actor2 = await seedUser();
      const created = await createAssignment(
        db, mosque.id,
        { assignmentDate: '2099-01-23', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null },
        actor1.id,
      );
      const [secondPerson] = await db.insert(people).values({ mosqueId: mosque.id, name: 'Imam Baru', phone: null }).returning();
      if (!secondPerson) throw new Error('person insert failed');

      const result = await updateAssignment(db, mosque.id, created.id, { imamPersonId: secondPerson.id }, actor2.id);
      expect(result.imamPersonId).toBe(secondPerson.id);

      const [row] = await db.select().from(fridayAssignments).where(eq(fridayAssignments.id, created.id));
      expect((row?.history as unknown[]).length).toBe(2);
    });

    it('403s when the assignment date has already passed', async () => {
      const { mosque, person } = await seedMosqueWithPerson();
      const actor = await seedUser();
      // Insert a past-dated row directly — createAssignment itself refuses to
      // create past dates, so a past row can only exist from data created
      // before "today" moved past it. Direct insert simulates that state.
      const [pastRow] = await db
        .insert(fridayAssignments)
        .values({ mosqueId: mosque.id, assignmentDate: '2020-01-03', khatibPersonId: person.id, createdBy: actor.id })
        .returning();
      if (!pastRow) throw new Error('assignment insert failed');

      await expect(updateAssignment(db, mosque.id, pastRow.id, { khatibPersonId: null }, actor.id)).rejects.toThrow();
    });

    it('404s when the assignment belongs to a different mosque', async () => {
      const { mosque: mosqueA, person } = await seedMosqueWithPerson();
      const { mosque: mosqueB } = await seedMosqueWithPerson();
      const actor = await seedUser();
      const created = await createAssignment(
        db, mosqueA.id,
        { assignmentDate: '2099-01-30', khatibPersonId: person.id, imamPersonId: null, muazzinPersonId: null },
        actor.id,
      );

      await expect(updateAssignment(db, mosqueB.id, created.id, { khatibPersonId: null }, actor.id)).rejects.toThrow();
    });
  });
});
