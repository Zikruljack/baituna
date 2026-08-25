import { describe, expect, it, vi } from 'vitest';

import { mosques } from '../../drizzle/schema.ts';
import {
  findApprovedMosqueById,
  findNearbyMosques,
  searchMosquesByKeyword,
  type Database,
} from './mosque-search.service.ts';

const { and, asc, between, eq, ilike, isNull, or, sql } = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ kind: 'and', conditions })),
  asc: vi.fn((column: unknown) => ({ kind: 'asc', column })),
  between: vi.fn((column: unknown, minimum: unknown, maximum: unknown) => ({
    kind: 'between',
    column,
    minimum,
    maximum,
  })),
  eq: vi.fn((left: unknown, right: unknown) => ({ kind: 'eq', left, right })),
  ilike: vi.fn((column: unknown, pattern: string) => ({ kind: 'ilike', column, pattern })),
  isNull: vi.fn((column: unknown) => ({ kind: 'isNull', column })),
  or: vi.fn((...conditions: unknown[]) => ({ kind: 'or', conditions })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ kind: 'sql', strings, values })),
    { raw: vi.fn((value: string) => ({ kind: 'sql.raw', value })) },
  ),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and, asc, between, eq, ilike, isNull, or, sql };
});

interface CandidateRow {
  id: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  photoUrl: string | null;
  cityId?: string;
  provinceId?: string;
  status?: 'approved';
  adminUserId?: string | null;
}

function fakeDb(rows: CandidateRow[]): Database {
  const query = {
    then: <TResult1 = CandidateRow[], TResult2 = never>(
      onfulfilled?: ((value: CandidateRow[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(rows).then(onfulfilled, onrejected),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
  query.orderBy.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  const where = vi.fn().mockReturnValue(query);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  return { select } as unknown as Database;
}

describe('findNearbyMosques', () => {
  it('ranks a nearer Banda Aceh mosque before a farther candidate', async () => {
    const result = await findNearbyMosques(
      fakeDb([
        {
          id: 'farther',
          name: 'Masjid Farther',
          address: 'Jl. Farther',
          latitude: '5.6000000',
          longitude: '95.4000000',
          photoUrl: null,
        },
        {
          id: 'nearer',
          name: 'Masjid Nearer',
          address: 'Jl. Nearer',
          latitude: '5.5490000',
          longitude: '95.3240000',
          photoUrl: 'https://example.test/nearer.jpg',
        },
      ]),
      { lat: 5.5483, lng: 95.3238, radiusKm: 20 },
    );

    expect(result.map((mosque) => mosque.id)).toEqual(['nearer', 'farther']);
    expect(result[0]).toMatchObject({
      latitude: 5.549,
      longitude: 95.324,
      photoUrl: 'https://example.test/nearer.jpg',
    });
    expect(result[0]?.distanceKm).toBeLessThan(result[1]?.distanceKm ?? Infinity);
  });

  it('excludes a bounding-box corner candidate outside the circular radius', async () => {
    const result = await findNearbyMosques(
      fakeDb([
        {
          id: 'corner',
          name: 'Masjid Corner',
          address: 'Jl. Corner',
          latitude: '5.7000000',
          longitude: '95.5000000',
          photoUrl: null,
        },
      ]),
      { lat: 5.5483, lng: 95.3238, radiusKm: 5 },
    );

    expect(result).toEqual([]);
  });

  it('keeps a valid high-latitude candidate inside the longitude prefilter', async () => {
    between.mockClear();

    const result = await findNearbyMosques(
      fakeDb([
        {
          id: 'high-latitude',
          name: 'Masjid High Latitude',
          address: 'Jl. Kutub',
          latitude: '89.0000000',
          longitude: '25.9000000',
          photoUrl: null,
        },
      ]),
      { lat: 89, lng: 0, radiusKm: 50 },
    );

    expect(result.map((mosque) => mosque.id)).toEqual(['high-latitude']);
    const longitudeBounds = between.mock.calls.find(
      ([, minimum, maximum]) =>
        typeof minimum === 'number' &&
        typeof maximum === 'number' &&
        minimum < 0 &&
        maximum > 0 &&
        maximum < 90,
    );
    expect(longitudeBounds?.[2]).toBeGreaterThanOrEqual(25.9);
  });

  it('returns an empty list when the query finds no candidates', async () => {
    await expect(
      findNearbyMosques(fakeDb([]), { lat: 5.5483, lng: 95.3238, radiusKm: 5 }),
    ).resolves.toEqual([]);
  });
});

describe('searchMosquesByKeyword', () => {
  it('returns the matching approved mosque without a distance', async () => {
    and.mockClear();
    asc.mockClear();
    eq.mockClear();
    ilike.mockClear();
    isNull.mockClear();
    or.mockClear();

    const result = await searchMosquesByKeyword(
      fakeDb([
        {
          id: 'baiturrahman',
          name: 'Masjid Raya Baiturrahman',
          address: 'Jl. Mohammad Jam, Banda Aceh',
          latitude: '5.5538000',
          longitude: '95.3171000',
          photoUrl: 'https://example.test/baiturrahman.jpg',
        },
      ]),
      'baiturrahman',
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Masjid Raya Baiturrahman');
    expect(result[0]).not.toHaveProperty('distanceKm');
    expect(ilike).toHaveBeenCalledWith(mosques.name, '%baiturrahman%');
    expect(ilike).toHaveBeenCalledWith(mosques.address, '%baiturrahman%');
    expect(or).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith(mosques.status, 'approved');
    expect(isNull).toHaveBeenCalledWith(mosques.deletedAt);
    expect(asc).toHaveBeenCalledWith(mosques.name);
  });
});

describe('findApprovedMosqueById', () => {
  it('returns the complete public detail for one approved mosque', async () => {
    and.mockClear();
    eq.mockClear();
    isNull.mockClear();

    const id = 'd77fa1bd-fc18-4f6f-b4fe-7982454ad9a1';
    const result = await findApprovedMosqueById(
      fakeDb([
        {
          id,
          name: 'Masjid Raya Baiturrahman',
          address: 'Jl. Mohammad Jam, Banda Aceh',
          latitude: '5.5538000',
          longitude: '95.3171000',
          photoUrl: 'https://example.test/baiturrahman.jpg',
          cityId: 'f5b9d62d-bf2f-4d51-8fc0-57c1f3a5af70',
          provinceId: 'a1120a58-e3ac-4b9f-843f-fb9cda8e8c70',
          status: 'approved',
          adminUserId: null,
        },
      ]),
      id,
    );

    expect(result).toEqual({
      id,
      name: 'Masjid Raya Baiturrahman',
      address: 'Jl. Mohammad Jam, Banda Aceh',
      latitude: 5.5538,
      longitude: 95.3171,
      photoUrl: 'https://example.test/baiturrahman.jpg',
      cityId: 'f5b9d62d-bf2f-4d51-8fc0-57c1f3a5af70',
      provinceId: 'a1120a58-e3ac-4b9f-843f-fb9cda8e8c70',
      status: 'approved',
      adminUserId: null,
    });
    expect(eq).toHaveBeenCalledWith(mosques.id, id);
    expect(eq).toHaveBeenCalledWith(mosques.status, 'approved');
    expect(isNull).toHaveBeenCalledWith(mosques.deletedAt);
  });

  it('returns null when no approved, non-deleted mosque matches the id', async () => {
    and.mockClear();
    eq.mockClear();
    isNull.mockClear();

    await expect(
      findApprovedMosqueById(fakeDb([]), '0d498bcf-ae10-4f3a-8624-e4c8168e4e9e'),
    ).resolves.toBeNull();

    expect(eq).toHaveBeenCalledWith(mosques.status, 'approved');
    expect(isNull).toHaveBeenCalledWith(mosques.deletedAt);
  });
});
