import { describe, expect, it } from 'vitest';

import { ACEH_CITY_NAMES, ACEH_PROVINCE } from './aceh-regions.ts';

const EXPECTED_ACEH_CITY_NAMES = [
  'Aceh Barat',
  'Aceh Barat Daya',
  'Aceh Besar',
  'Aceh Jaya',
  'Aceh Selatan',
  'Aceh Singkil',
  'Aceh Tamiang',
  'Aceh Tengah',
  'Aceh Tenggara',
  'Aceh Timur',
  'Aceh Utara',
  'Banda Aceh',
  'Bener Meriah',
  'Bireuen',
  'Gayo Lues',
  'Langsa',
  'Lhokseumawe',
  'Nagan Raya',
  'Pidie',
  'Pidie Jaya',
  'Sabang',
  'Simeulue',
  'Subulussalam',
];

describe('Aceh canonical Region dataset', () => {
  it('contains exactly 23 uniquely named Cities', () => {
    expect(ACEH_PROVINCE).toBe('Aceh');
    expect(ACEH_CITY_NAMES).toHaveLength(23);
    expect(new Set(ACEH_CITY_NAMES)).toHaveLength(23);
    expect([...ACEH_CITY_NAMES].sort()).toEqual([...EXPECTED_ACEH_CITY_NAMES].sort());
  });

  it.each(['Banda Aceh', 'Langsa', 'Lhokseumawe', 'Sabang', 'Subulussalam'])(
    'includes %s',
    (cityName) => {
      expect(ACEH_CITY_NAMES).toContain(cityName);
    },
  );
});
