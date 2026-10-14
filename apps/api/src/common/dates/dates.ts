/** Calendar-day helpers. "Today" is always computed in Asia/Colombo (overview §4). */
export const TIME_ZONE = 'Asia/Colombo';

/** Today's date in Asia/Colombo as "YYYY-MM-DD". */
export function todayInColombo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "YYYY-MM-DD" + n days → "YYYY-MM-DD" (calendar arithmetic, no timezone involved). */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The year of a "YYYY-MM-DD" day. */
export function yearOf(day: string): number {
  return Number(day.slice(0, 4));
}
