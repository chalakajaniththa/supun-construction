import { z } from 'zod';

/** Money: decimal string with up to 2 decimals, e.g. "1250000.00", "-15.5". */
export const MONEY_REGEX = /^-?\d+(\.\d{1,2})?$/;
/** Quantity: decimal string with up to 3 decimals, e.g. "12.375". */
export const QTY_REGEX = /^-?\d+(\.\d{1,3})?$/;
/** Percentage / rate: decimal string with up to 4 decimals. */
export const RATE_REGEX = /^\d+(\.\d{1,4})?$/;

export function isMoneyString(value: string): boolean {
  return MONEY_REGEX.test(value);
}

export function isQtyString(value: string): boolean {
  return QTY_REGEX.test(value);
}

/** Accepts a string (or a finite number that is converted) and validates it as money. */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? String(v) : v.trim()))
  .refine(isMoneyString, { message: 'INVALID_MONEY' });

export const nonNegativeMoneySchema = moneySchema.refine((v) => !v.startsWith('-'), {
  message: 'NEGATIVE_NOT_ALLOWED',
});

export const qtySchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? String(v) : v.trim()))
  .refine(isQtyString, { message: 'INVALID_QUANTITY' });

export const nonNegativeQtySchema = qtySchema.refine((v) => !v.startsWith('-'), {
  message: 'NEGATIVE_NOT_ALLOWED',
});

/** Percentage 0–100 as a decimal string (up to 4 dp). */
export const percentSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? String(v) : v.trim()))
  .refine((v) => RATE_REGEX.test(v), { message: 'INVALID_NUMBER' })
  .refine((v) => Number(v) <= 100, { message: 'PERCENT_TOO_HIGH' });

/** Positive decimal (e.g. a multiplier like 1.5) as a string. */
export const positiveRateSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? String(v) : v.trim()))
  .refine((v) => RATE_REGEX.test(v), { message: 'INVALID_NUMBER' })
  .refine((v) => Number(v) > 0, { message: 'MUST_BE_POSITIVE' });
