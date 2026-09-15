/**
 * The working week.
 *
 * One definition, because attendance and leave have to agree: a day that shows
 * as a weekly off on the attendance grid must also be a day nobody spends leave
 * on. When these two drifted apart, a Friday-to-Monday request charged four
 * days and the grid counted two of them as non-working.
 *
 * The week is Monday to Saturday with Sunday off. If that ever needs to vary by
 * organisation it belongs in Settings, read here — every caller already goes
 * through these helpers.
 */

/** Day-of-week numbers, UTC, that nobody is expected to work. 0 = Sunday. */
export const WEEKLY_OFF_DAYS: readonly number[] = [0];

/** Sunday. Saturday is a working day. */
export const isWeeklyOff = (date: Date): boolean =>
  WEEKLY_OFF_DAYS.includes(date.getUTCDay());

/** Midnight UTC on the given day — work dates are stored date-only. */
export const startOfUtcDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const dayKey = (d: Date): string => startOfUtcDay(d).toISOString().slice(0, 10);

/**
 * Working days in an inclusive range, skipping weekly offs and public holidays.
 *
 * This is what leave is counted in: a holiday or a Sunday inside a range costs
 * nobody a day of entitlement, because it was never theirs to spend.
 */
export function countWorkingDays(from: Date, to: Date, holidays: Date[] = []): number {
  const off = new Set(holidays.map(dayKey));
  let days = 0;

  for (
    let cursor = startOfUtcDay(from);
    cursor <= startOfUtcDay(to);
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    if (!isWeeklyOff(cursor) && !off.has(dayKey(cursor))) days += 1;
  }
  return days;
}
