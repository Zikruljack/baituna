import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import * as schema from '../../drizzle/schema';
import { cities, mosques, people, provinces, users } from '../../drizzle/schema';
import { createPerson, deletePerson, listActivePeople, updatePerson } from './person.service';

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

  describe('createPerson', () => {
    it('inserts a Person scoped to the mosque and writes one audit entry', async () => {
      const mosque = await seedMosque();
      const actor = await seedUser();

      const result = await createPerson(db, mosque.id, { name: 'Ustadz Fulan', phone: '0812345' }, actor.id);

      expect(result.name).toBe('Ustadz Fulan');

      const [row] = await db.select().from(people).where(eq(people.id, result.id));
      expect(row?.mosqueId).toBe(mosque.id);
      expect((row?.history as unknown[]).length).toBe(1);
    });
  });

  describe('updatePerson', () => {
    it('updates fields and writes an audit entry', async () => {
      const mosque = await seedMosque();
      const actor1 = await seedUser();
      const actor2 = await seedUser();
      const created = await createPerson(db, mosque.id, { name: 'Before Name', phone: null }, actor1.id);

      const result = await updatePerson(db, mosque.id, created.id, { name: 'After Name' }, actor2.id);
      expect(result.name).toBe('After Name');

      const [row] = await db.select().from(people).where(eq(people.id, created.id));
      expect((row?.history as unknown[]).length).toBe(2);
    });

    it('404s when the Person belongs to a different mosque', async () => {
      const mosqueA = await seedMosque();
      const mosqueB = await seedMosque();
      const actor = await seedUser();
      const created = await createPerson(db, mosqueA.id, { name: 'Cross Mosque', phone: null }, actor.id);

      await expect(updatePerson(db, mosqueB.id, created.id, { name: 'Hacked' }, actor.id)).rejects.toThrow();
    });

    it('404s when the Person is soft-deleted', async () => {
      const mosque = await seedMosque();
      const actor = await seedUser();
      const created = await createPerson(db, mosque.id, { name: 'Will Delete', phone: null }, actor.id);
      await db.update(people).set({ deletedAt: new Date() }).where(eq(people.id, created.id));

      await expect(updatePerson(db, mosque.id, created.id, { name: 'Too Late' }, actor.id)).rejects.toThrow();
    });
  });

  describe('deletePerson', () => {
    it('soft-deletes: sets deletedAt/deletedBy and excludes the row from listActivePeople', async () => {
      const mosque = await seedMosque();
      const actor1 = await seedUser();
      const actor2 = await seedUser();
      const created = await createPerson(db, mosque.id, { name: 'To Delete', phone: null }, actor1.id);

      await deletePerson(db, mosque.id, created.id, actor2.id);

      const [row] = await db.select().from(people).where(eq(people.id, created.id));
      expect(row?.deletedAt).not.toBeNull();
      expect(row?.deletedBy).toBe(actor2.id);
      expect((row?.history as unknown[]).length).toBe(2);

      const list = await listActivePeople(db, mosque.id);
      expect(list.find((p) => p.id === created.id)).toBeUndefined();
    });

    it('does not hard-delete the row — it remains queryable directly', async () => {
      const mosque = await seedMosque();
      const actor = await seedUser();
      const created = await createPerson(db, mosque.id, { name: 'Still There', phone: null }, actor.id);
      await deletePerson(db, mosque.id, created.id, actor.id);

      const [row] = await db.select().from(people).where(eq(people.id, created.id));
      expect(row).toBeDefined();
      expect(row?.name).toBe('Still There');
    });

    it('404s when already deleted', async () => {
      const mosque = await seedMosque();
      const actor = await seedUser();
      const created = await createPerson(db, mosque.id, { name: 'Double Delete', phone: null }, actor.id);
      await deletePerson(db, mosque.id, created.id, actor.id);

      await expect(deletePerson(db, mosque.id, created.id, actor.id)).rejects.toThrow();
    });
  });
});
