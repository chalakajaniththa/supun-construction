/** Pay-rate history helpers (overview §6: the rate on a day is the latest row with effectiveFrom ≤ that day). */

export interface RateLike {
  effectiveFrom: Date | string;
}

const dayOf = (v: Date | string) =>
  typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10);

/**
 * The rate in force on `day` ("YYYY-MM-DD"): the row with the latest effectiveFrom that is on or
 * before that day, or null when the worker had no rate yet. Input order does not matter.
 */
export function pickRateOn<T extends RateLike>(rates: readonly T[], day: string): T | null {
  let best: T | null = null;
  let bestDay = '';
  for (const r of rates) {
    const d = dayOf(r.effectiveFrom);
    if (d <= day && d > bestDay) {
      best = r;
      bestDay = d;
    }
  }
  return best;
}
