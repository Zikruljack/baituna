import { describe, expect, it } from 'vitest';

import { getCurrentOrNextFridayWib, isFriday, isPastWib } from './wib-date-client';

describe('isFriday', () => {
  it('identifies a known Friday', () => {
    // 2026-08-21 is a Friday.
    expect(isFriday('2026-08-21')).toBe(true);
  });

  it('rejects a known non-Friday', () => {
    // 2026-08-22 is a Saturday.
    expect(isFriday('2026-08-22')).toBe(false);
  });
});

describe('getCurrentOrNextFridayWib', () => {
  it('returns today when today is already Friday in WIB', () => {
    // 2026-08-21 10:00 WIB = 2026-08-21 03:00Z, still Friday in WIB.
    const now = new Date('2026-08-21T03:00:00Z');
    expect(getCurrentOrNextFridayWib(now)).toBe('2026-08-21');
  });

  it('rolls over to next Friday right after Friday ends in WIB (00:00 WIB boundary)', () => {
    // 2026-08-22 00:00 WIB = 2026-08-21 17:00Z — Friday has just ended in WIB.
    const now = new Date('2026-08-21T17:00:00Z');
    expect(getCurrentOrNextFridayWib(now)).toBe('2026-08-28');
  });

  it('handles a UTC date that has already rolled to Friday, but WIB has not yet', () => {
    // 2026-08-20 18:00Z = 2026-08-21 01:00 WIB — Friday in WIB, Thursday in UTC.
    const now = new Date('2026-08-20T18:00:00Z');
    expect(getCurrentOrNextFridayWib(now)).toBe('2026-08-21');
  });

  it('finds the next Friday from a mid-week date', () => {
    // 2026-08-19 is a Wednesday.
    const now = new Date('2026-08-19T03:00:00Z');
    expect(getCurrentOrNextFridayWib(now)).toBe('2026-08-21');
  });
});

describe('isPastWib', () => {
  it('treats a date before WIB-today as past', () => {
    const now = new Date('2026-08-21T03:00:00Z'); // 2026-08-21 10:00 WIB
    expect(isPastWib('2026-08-20', now)).toBe(true);
  });

  it('treats WIB-today itself as not past', () => {
    const now = new Date('2026-08-21T03:00:00Z'); // 2026-08-21 10:00 WIB
    expect(isPastWib('2026-08-21', now)).toBe(false);
  });

  it('treats a future date as not past', () => {
    const now = new Date('2026-08-21T03:00:00Z');
    expect(isPastWib('2026-08-28', now)).toBe(false);
  });

  it('flips at exactly 00:00 WIB, not 00:00 UTC', () => {
    // 2026-08-22 00:00 WIB = 2026-08-21 17:00Z. At this instant, 2026-08-21 is now past.
    const now = new Date('2026-08-21T17:00:00Z');
    expect(isPastWib('2026-08-21', now)).toBe(true);
    // One second earlier it was still WIB-today, not past.
    const justBefore = new Date('2026-08-21T16:59:59Z');
    expect(isPastWib('2026-08-21', justBefore)).toBe(false);
  });
});
