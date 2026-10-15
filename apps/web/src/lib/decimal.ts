import { Decimal } from 'decimal.js';

/** Exact sums / products of decimal strings for live form totals (never floats). */
export function toDec(value: string | null | undefined): Decimal {
  if (!value) return new Decimal(0);
  try {
    const d = new Decimal(value);
    return d.isFinite() ? d : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

export function sumStrings(values: (string | null | undefined)[]): string {
  return values.reduce((s, v) => s.plus(toDec(v)), new Decimal(0)).toString();
}

/** quantity × price rounded half-up to cents, as the API does. */
export function lineAmount(quantity: string | null | undefined, price: string | null | undefined) {
  return toDec(quantity).times(toDec(price)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
