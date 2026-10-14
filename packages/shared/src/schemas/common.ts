import { z } from 'zod';
import { nonNegativeMoneySchema, nonNegativeQtySchema, percentSchema } from '../money';

/**
 * Building blocks for the entity schemas (create / update bodies and list queries).
 *
 * Optional fields accept '' / null / undefined from forms:
 *   ''  or null → null   (clears the value)
 *   undefined   → undefined (PATCH: "leave unchanged")
 */

/** Calendar day "YYYY-MM-DD" (a real date). Error code: INVALID_DATE. */
export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDay(value: string): boolean {
  if (!DATE_ONLY_REGEX.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const dateOnlySchema = z
  .string({ error: 'REQUIRED' })
  .trim()
  .min(1, 'REQUIRED')
  .refine(isValidDay, { message: 'INVALID_DATE' });

/** '' / null → null, undefined stays undefined ("unchanged" in a PATCH). */
const emptyToNull = <T>(v: T | '' | null | undefined): T | null | undefined =>
  v === undefined ? undefined : v === '' || v === null ? null : v;

/** Optional text: trimmed; '' → null. */
export const optionalText = (max: number) =>
  z.string().trim().max(max, 'TOO_LONG').nullable().optional().transform(emptyToNull);

/** Required text: trimmed, at least 1 char. */
export const requiredText = (max: number) =>
  z.string({ error: 'REQUIRED' }).trim().min(1, 'REQUIRED').max(max, 'TOO_LONG');

const optional = <S extends z.ZodType>(schema: S) =>
  z
    .union([z.literal(''), schema])
    .nullable()
    .optional()
    .transform(emptyToNull);

export const optionalDate = optional(dateOnlySchema);
export const optionalMoney = optional(nonNegativeMoneySchema);
export const optionalQty = optional(nonNegativeQtySchema);
export const optionalPercent = optional(percentSchema);
export const optionalEmail = optional(z.email('INVALID_EMAIL').max(200, 'TOO_LONG'));
export const optionalUuid = optional(z.uuid('INVALID'));

/** Query-string boolean: "true" / "false" (anything else is rejected). */
export const queryBoolean = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

/** Converts a "YYYY-MM-DD" day to the Date Prisma stores in a DATE column (UTC midnight). */
export function dayToDate(day: string): Date;
export function dayToDate(day: string | null): Date | null;
export function dayToDate(day: string | null | undefined): Date | null | undefined;
export function dayToDate(day: string | null | undefined): Date | null | undefined {
  if (day === undefined) return undefined;
  if (day === null) return null;
  return new Date(`${day}T00:00:00.000Z`);
}

/** "2026-10-14T00:00:00.000Z" (or a Date) → "2026-10-14". */
export function toDay(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** A required enum field whose "missing" error is REQUIRED (for selects in forms). */
export function enumField<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values, { error: 'REQUIRED' });
}

/** Optional whole number from a form ('' → null). */
export function optionalInt(min: number, max: number) {
  return z
    .union([
      z.literal(''),
      z.coerce.number().int('INVALID_NUMBER').min(min, 'INVALID_NUMBER').max(max, 'INVALID_NUMBER'),
    ])
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === '' || v === null ? null : v));
}

/** true when b is on or after a (both "YYYY-MM-DD"; missing values pass). */
export function isOnOrAfter(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true;
  return b >= a;
}
