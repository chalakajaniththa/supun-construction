/**
 * Wall-clock helpers for Asia/Colombo. Sri Lanka has a fixed offset (+05:30, no daylight saving),
 * so converting between a calendar day + "HH:mm" and an instant needs no time-zone database.
 */
export const COLOMBO_OFFSET = '+05:30';
const OFFSET_MS = (5 * 60 + 30) * 60_000;

/** "HH:mm" (00:00–23:59). */
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Default working hours used when a time is not given (overview: 08:00–17:00). */
export const DEFAULT_WORK_START = '08:00';
export const DEFAULT_WORK_END = '17:00';

/** "2026-10-14" + "08:00" → the instant 2026-10-14T02:30:00Z. */
export function colomboInstant(day: string, time = '00:00'): Date {
  return new Date(`${day}T${time}:00.000${COLOMBO_OFFSET}`);
}

/** The Colombo calendar day of an instant, "YYYY-MM-DD". */
export function colomboDay(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** The Colombo wall-clock time of an instant, "HH:mm". */
export function colomboTime(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

/** [start, end) of a Colombo calendar day as instants. */
export function colomboDayRange(day: string): { start: Date; end: Date } {
  const start = colomboInstant(day);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** "YYYY-MM-DD" + n days (calendar arithmetic). */
export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Every day from `from` to `to` inclusive (empty when to < from). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d);
  return out;
}

/** 0 = Sunday … 6 = Saturday, for a calendar day. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00.000Z`).getUTCDay();
}

/** The Monday on or before a day (weeks start on Monday). */
export function mondayOf(day: string): string {
  const wd = weekdayOf(day);
  return shiftDay(day, wd === 0 ? -6 : 1 - wd);
}

/** "2026-10" → first and last calendar day of that month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}
