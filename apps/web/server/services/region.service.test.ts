import { describe, expect, it, vi } from 'vitest';
import {
  findActiveProvince,
  listActiveCities,
  listActiveProvinces,
  type RegionDatabase,
} from './region.service.ts';
import { cities, provinces } from '../../drizzle/schema.ts';

const { asc, eq, isNull, and } = vi.hoisted(() => ({
  asc: vi.fn((column: unknown) => ({ kind: 'asc', column })),
  eq: vi.fn((left: unknown, right: unknown) => ({ kind: 'eq', left, right })),
  isNull: vi.fn((column: unknown) => ({ kind: 'isNull', column })),
  and: vi.fn((...conditions: unknown[]) => ({ kind: 'and', conditions })),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    asc,
    eq,
    isNull,
    and,
  };
});

function fakeDb(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy, limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  return {
    db: { select } as unknown as RegionDatabase,
    select,
    where,
    orderBy,
    limit,
  };
}

describe('Region service', () => {
  it('lists active Provinces alphabetically with public fields only', async () => {
    const { db, select, where, orderBy } = fakeDb([{ id: 'province-1', name: 'Aceh' }]);

    await expect(listActiveProvinces(db)).resolves.toEqual([{ id: 'province-1', name: 'Aceh' }]);

    expect(select).toHaveBeenCalledWith({ id: provinces.id, name: provinces.name });
    expect(where).toHaveBeenCalledWith({ kind: 'isNull', column: provinces.deletedAt });
    expect(orderBy).toHaveBeenCalledWith({ kind: 'asc', column: provinces.name });
  });

  it('finds an active Province by ID or returns null', async () => {
    const found = fakeDb([{ id: 'province-1', name: 'Aceh' }]);
    await expect(findActiveProvince(found.db, 'province-1')).resolves.toEqual({
      id: 'province-1',
      name: 'Aceh',
    });
    expect(found.where).toHaveBeenCalledWith({
      kind: 'and',
      conditions: [
        { kind: 'eq', left: provinces.id, right: 'province-1' },
        { kind: 'isNull', column: provinces.deletedAt },
      ],
    });
    expect(found.limit).toHaveBeenCalledWith(1);

    await expect(findActiveProvince(fakeDb([]).db, 'missing')).resolves.toBeNull();
  });

  it('lists only active Cities scoped to a Province in alphabetical order', async () => {
    const { db, select, where, orderBy } = fakeDb([
      { id: 'city-1', name: 'Banda Aceh', provinceId: 'province-1' },
    ]);

    await expect(listActiveCities(db, 'province-1')).resolves.toEqual([
      { id: 'city-1', name: 'Banda Aceh', provinceId: 'province-1' },
    ]);

    expect(select).toHaveBeenCalledWith({
      id: cities.id,
      name: cities.name,
      provinceId: cities.provinceId,
    });
    expect(where).toHaveBeenCalledWith({
      kind: 'and',
      conditions: [
        { kind: 'eq', left: cities.provinceId, right: 'province-1' },
        { kind: 'isNull', column: cities.deletedAt },
      ],
    });
    expect(orderBy).toHaveBeenCalledWith({ kind: 'asc', column: cities.name });
  });
});
