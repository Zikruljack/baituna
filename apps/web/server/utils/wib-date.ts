export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Shifts a Date by the WIB offset so its UTC getters read as WIB wall-clock
 * fields. Indonesia's western zone (WIB) has been a fixed UTC+7 with no DST
 * since 1988, so a constant offset is exact — no timezone library needed.
 */
export function toWibDate(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses a `YYYY-MM-DD` string as a UTC midnight Date (no time component). */
function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isFriday(isoDate: string): boolean {
  return parseIsoDate(isoDate).getUTCDay() === 5;
}

/**
 * Returns today's date (WIB) if today is Friday, otherwise the next
 * upcoming Friday — both as `YYYY-MM-DD`. The WIB "today" is derived by
 * shifting `now` into WIB wall-clock time before reading its date fields,
 * so the rollover happens at 00:00 WIB, not 00:00 UTC or the caller's zone.
 */
export function getCurrentOrNextFridayWib(now: Date): string {
  const wibNow = toWibDate(now);
  const wibToday = new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()));
  const currentDay = wibToday.getUTCDay();
  const daysUntilFriday = (5 - currentDay + 7) % 7;

  const target = new Date(wibToday);
  target.setUTCDate(target.getUTCDate() + daysUntilFriday);

  return toIsoDate(target);
}

/**
 * True when `isoDate` is strictly before WIB-today, where WIB-today is
 * derived from `now` the same way `getCurrentOrNextFridayWib` does — so
 * the two functions agree on exactly when "today" changes.
 */
export function isPastWib(isoDate: string, now: Date): boolean {
  const wibNow = toWibDate(now);
  const wibToday = new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()));
  const target = parseIsoDate(isoDate);

  return target.getTime() < wibToday.getTime();
}
