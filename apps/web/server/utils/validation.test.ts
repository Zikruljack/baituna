import { describe, expect, it } from 'vitest';

import { createMosqueSchema, searchQuerySchema, updateMosqueSchema } from './validation';

const validBase = {
  name: 'Masjid Test',
  address: 'Jl. Test No. 1',
  cityId: '11111111-1111-4111-8111-111111111111',
  provinceId: '22222222-2222-4222-8222-222222222222',
};

describe('createMosqueSchema', () => {
  it('accepts valid latitude and longitude', () => {
    expect(
      createMosqueSchema.safeParse({
        ...validBase,
        latitude: '5.5500000',
        longitude: '95.3200000',
      }).success,
    ).toBe(true);
  });

  it('accepts boundary latitude and longitude values', () => {
    expect(
      createMosqueSchema.safeParse({
        ...validBase,
        latitude: '-90.0000000',
        longitude: '180.0000000',
      }).success,
    ).toBe(true);
  });

  it('rejects a latitude outside -90..90', () => {
    expect(
      createMosqueSchema.safeParse({
        ...validBase,
        latitude: '999.0000000',
        longitude: '95.3200000',
      }).success,
    ).toBe(false);
  });

  it('rejects a longitude outside -180..180', () => {
    expect(
      createMosqueSchema.safeParse({
        ...validBase,
        latitude: '5.5500000',
        longitude: '999.0000000',
      }).success,
    ).toBe(false);
  });
});

describe('updateMosqueSchema', () => {
  it('rejects an out-of-range latitude when provided', () => {
    expect(updateMosqueSchema.safeParse({ latitude: '-999.0000000' }).success).toBe(false);
  });

  it('accepts a partial update with only a valid longitude', () => {
    expect(updateMosqueSchema.safeParse({ longitude: '95.3200000' }).success).toBe(true);
  });
});

describe('searchQuerySchema', () => {
  it('trims a non-empty keyword', () => {
    expect(searchQuerySchema.parse({ q: '  baiturrahman  ' })).toEqual({ q: 'baiturrahman' });
  });

  it('rejects blank and oversized keywords', () => {
    expect(searchQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: 'a'.repeat(201) }).success).toBe(false);
  });
});

describe('createMosqueSchema — public registration fields', () => {
  const validRegistration = {
    ...validBase,
    latitude: '5.5500000',
    longitude: '95.3200000',
    submitterName: 'Budi Santoso',
    email: 'budi@gmail.com',
    password: 'password123',
  };

  it('accepts a valid submission with a known email provider', () => {
    expect(createMosqueSchema.safeParse(validRegistration).success).toBe(true);
  });

  it('rejects an email from an unrecognized domain', () => {
    expect(
      createMosqueSchema.safeParse({ ...validRegistration, email: 'budi@unknown-domain.xyz' })
        .success,
    ).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(
      createMosqueSchema.safeParse({ ...validRegistration, password: 'short1' }).success,
    ).toBe(false);
  });

  it('rejects an empty submitter name', () => {
    expect(
      createMosqueSchema.safeParse({ ...validRegistration, submitterName: '' }).success,
    ).toBe(false);
  });
});

describe('updateMosqueSchema — fridayPrayerTime', () => {
  it('accepts a valid HH:mm time', () => {
    expect(updateMosqueSchema.safeParse({ fridayPrayerTime: '12:30' }).success).toBe(true);
  });

  it('rejects an invalid time format', () => {
    expect(updateMosqueSchema.safeParse({ fridayPrayerTime: '25:99' }).success).toBe(false);
  });

  it('rejects a non-padded time', () => {
    expect(updateMosqueSchema.safeParse({ fridayPrayerTime: '9:5' }).success).toBe(false);
  });
});
