import { Decimal } from 'decimal.js';

export const TIME_ZONE = 'Asia/Colombo';

type DecimalLike = string | number | { toString(): string } | null | undefined;

function toDecimal(value: DecimalLike): Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const d = new Decimal(typeof value === 'object' ? value.toString() : value);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

/** "1234567.5" → "1,234,567.50" (exact, half-up). */
function group(fixed: string): string {
  const negative = fixed.startsWith('-');
  const [int = '0', frac] = (negative ? fixed.slice(1) : fixed).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${frac !== undefined ? `.${frac}` : ''}`;
}

/** Money as "Rs. 1,250,000.00". Never uses floats. Empty / invalid → "—". */
export function formatMoney(value: DecimalLike, opts: { symbol?: boolean } = {}): string {
  const d = toDecimal(value);
  if (!d) return '—';
  const text = group(d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2));
  if (opts.symbol === false) return text;
  return text.startsWith('-') ? `-Rs. ${text.slice(1)}` : `Rs. ${text}`;
}

/** Quantity with up to 3 decimals, grouped: "1,250.5". */
export function formatQty(value: DecimalLike, maxDecimals = 3): string {
  const d = toDecimal(value);
  if (!d) return '—';
  const rounded = d.toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_UP);
  return group(rounded.toFixed());
}

/** Percentage with up to 1 decimal: "12.5%". */
export function formatPercent(value: DecimalLike, decimals = 1): string {
  const d = toDecimal(value);
  if (!d) return '—';
  return `${d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed()}%`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/;

/**
 * "14 Oct 2026". Calendar days from the API (DATE columns, "2026-10-14" or midnight UTC) are shown
 * as that day; real timestamps are shown in Asia/Colombo.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const isDay = typeof value === 'string' && DATE_ONLY.test(value);
  const date =
    typeof value === 'string' ? new Date(isDay ? `${value.slice(0, 10)}T00:00:00Z` : value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: isDay ? 'UTC' : TIME_ZONE,
  }).format(date);
}

/** "14 Oct 2026, 09:30" in Asia/Colombo. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(date);
}

/** Today's calendar day in Asia/Colombo as "YYYY-MM-DD". */
export function todayInColombo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
