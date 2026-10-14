import { HttpStatus } from '@nestjs/common';
import type { ApiErrorBody } from '@sc/shared';

/** Postgres SQLSTATE for an exclusion-constraint violation (overlapping allocations). */
export const PG_EXCLUSION_VIOLATION = '23P01';
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';
export const PG_CHECK_VIOLATION = '23514';

interface ErrorLike {
  code?: unknown;
  originalCode?: unknown;
  meta?: Record<string, unknown>;
  message?: unknown;
  cause?: unknown;
}

function asErrorLike(value: unknown): ErrorLike | undefined {
  return typeof value === 'object' && value !== null ? (value as ErrorLike) : undefined;
}

/**
 * Finds a Postgres SQLSTATE anywhere in a Prisma / driver-adapter error.
 * With driver adapters, raw database errors surface as P2010 / P2034-like errors whose
 * `meta` carries `code` (e.g. "23P01") or `driverAdapterError.cause.originalCode`.
 */
export function findPgCode(err: unknown, depth = 0): string | undefined {
  const e = asErrorLike(err);
  if (!e || depth > 5) return undefined;
  if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) && !e.code.startsWith('P')) {
    return e.code;
  }
  const own = e.originalCode;
  for (const v of [own, e.meta?.originalCode, e.meta?.code]) {
    if (typeof v === 'string' && /^[0-9A-Z]{5}$/.test(v) && !v.startsWith('P')) return v;
  }
  const candidates = [e.cause, e.meta?.driverAdapterError, e.meta?.cause];
  for (const c of candidates) {
    const found = findPgCode(c, depth + 1);
    if (found) return found;
  }
  const kind = asErrorLike(e.cause)?.['kind' as keyof ErrorLike];
  if (kind === 'ExclusionConstraintViolation') return PG_EXCLUSION_VIOLATION;
  if (typeof e.message === 'string') {
    if (/exclusion constraint|23P01/i.test(e.message)) return PG_EXCLUSION_VIOLATION;
  }
  return undefined;
}

function constraintName(err: unknown): string | undefined {
  const e = asErrorLike(err);
  const fromMeta = e?.meta?.constraint ?? e?.meta?.target ?? e?.meta?.field_name;
  if (typeof fromMeta === 'string') return fromMeta;
  if (Array.isArray(fromMeta)) return fromMeta.join(',');
  const adapter = asErrorLike(e?.meta?.driverAdapterError);
  const cause = asErrorLike(adapter?.cause);
  const c = cause?.['constraint' as keyof ErrorLike];
  if (typeof c === 'object' && c !== null) {
    const fields = (c as { fields?: string[]; index?: string }).fields;
    return fields?.join(',') ?? (c as { index?: string }).index;
  }
  return undefined;
}

/**
 * Maps a Prisma (or raw Postgres) error to the API error body, or returns undefined when the
 * error is not a known database error.
 *   P2002 / 23505 → 409 DUPLICATE · P2025 → 404 NOT_FOUND · 23P01 → 409 ALLOCATION_OVERLAP
 *   P2003 / 23503 → 409 CONFLICT (still referenced / missing reference)
 */
export function mapPrismaError(err: unknown): ApiErrorBody | undefined {
  const e = asErrorLike(err);
  if (!e) return undefined;
  const prismaCode = typeof e.code === 'string' && /^P\d{4}$/.test(e.code) ? e.code : undefined;
  const pgCode = findPgCode(err);

  if (pgCode === PG_EXCLUSION_VIOLATION) {
    return {
      statusCode: HttpStatus.CONFLICT,
      code: 'ALLOCATION_OVERLAP',
      message: 'This allocation overlaps another allocation for the same worker or machine.',
    };
  }
  if (prismaCode === 'P2002' || pgCode === PG_UNIQUE_VIOLATION) {
    const target = constraintName(err);
    return {
      statusCode: HttpStatus.CONFLICT,
      code: 'DUPLICATE',
      message: 'A record with the same value already exists.',
      details: target ? { target } : undefined,
    };
  }
  if (prismaCode === 'P2025' || prismaCode === 'P2001') {
    return { statusCode: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Record not found.' };
  }
  if (prismaCode === 'P2003' || pgCode === PG_FOREIGN_KEY_VIOLATION) {
    return {
      statusCode: HttpStatus.CONFLICT,
      code: 'CONFLICT',
      message: 'This record is linked to other records.',
    };
  }
  if (pgCode === PG_CHECK_VIOLATION) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_FAILED',
      message: 'The values are not valid.',
    };
  }
  return undefined;
}
