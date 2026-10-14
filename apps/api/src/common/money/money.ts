import { Decimal } from 'decimal.js';

/**
 * Money & quantity helpers. Never use JS floats for money: everything goes through decimal.js.
 * Money is rounded half-up to 2 dp, quantities to 3 dp.
 */
export type DecimalInput = Decimal.Value | { toString(): string };

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function dec(value: DecimalInput | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  if (value instanceof Decimal) return value;
  if (typeof value === 'number' || typeof value === 'string') return new Decimal(value);
  return new Decimal(value.toString());
}

export function roundMoney(value: DecimalInput): Decimal {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function roundQty(value: DecimalInput): Decimal {
  return dec(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

/** "1234.5" → "1234.50" */
export function moneyString(value: DecimalInput | null | undefined): string {
  return roundMoney(dec(value)).toFixed(2);
}

/** Quantity string with up to 3 dp, trailing zeros trimmed: "12.500" → "12.5". */
export function qtyString(value: DecimalInput | null | undefined): string {
  return roundQty(dec(value)).toString();
}

export function sum(values: Iterable<DecimalInput | null | undefined>): Decimal {
  let total = new Decimal(0);
  for (const v of values) total = total.plus(dec(v));
  return total;
}

/** value × pct / 100, rounded to money. */
export function percentOf(value: DecimalInput, pct: DecimalInput): Decimal {
  return roundMoney(dec(value).times(dec(pct)).dividedBy(100));
}

export function minDecimal(...values: DecimalInput[]): Decimal {
  return Decimal.min(...values.map((v) => dec(v)));
}

export function maxDecimal(...values: DecimalInput[]): Decimal {
  return Decimal.max(...values.map((v) => dec(v)));
}

/** Duck-typed check that also recognises Prisma's bundled Decimal class. */
export function isDecimalLike(value: unknown): value is Decimal {
  if (value instanceof Decimal) return true;
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toFixed?: unknown }).toFixed === 'function' &&
    typeof (value as { decimalPlaces?: unknown }).decimalPlaces === 'function' &&
    typeof (value as { isNaN?: unknown }).isNaN === 'function'
  );
}

/**
 * JSON form of a decimal: money columns (≤ 2 dp) → exactly 2 dp ("1250.00");
 * quantities with 3 dp keep them ("12.375").
 */
export function decimalToJson(value: Decimal): string {
  const dp = value.decimalPlaces();
  return value.toFixed(Math.max(2, Math.min(dp, 3)));
}

export { Decimal };
