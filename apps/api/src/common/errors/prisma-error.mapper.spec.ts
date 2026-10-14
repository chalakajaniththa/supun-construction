import { describe, expect, it } from 'vitest';
import { findPgCode, mapPrismaError } from './prisma-error.mapper.js';

describe('mapPrismaError', () => {
  it.each([
    [{ code: 'P2002', meta: { target: ['code'] } }, 409, 'DUPLICATE'],
    [{ code: 'P2025', meta: {} }, 404, 'NOT_FOUND'],
    [{ code: 'P2003', meta: {} }, 409, 'CONFLICT'],
    // raw postgres error (e.g. from pg directly)
    [
      { code: '23P01', message: 'conflicting key value violates exclusion constraint' },
      409,
      'ALLOCATION_OVERLAP',
    ],
    [{ code: '23505' }, 409, 'DUPLICATE'],
    [{ code: '23514' }, 400, 'VALIDATION_FAILED'],
    // driver adapter error shape: P2010 raw query failed with the SQLSTATE in meta
    [{ code: 'P2010', meta: { code: '23P01', message: 'exclusion' } }, 409, 'ALLOCATION_OVERLAP'],
    [
      {
        code: 'P2034',
        meta: { driverAdapterError: { cause: { originalCode: '23P01', kind: 'postgres' } } },
      },
      409,
      'ALLOCATION_OVERLAP',
    ],
    // nested cause
    [{ message: 'x', cause: { code: '23P01' } }, 409, 'ALLOCATION_OVERLAP'],
  ])('maps %j → %i %s', (err, status, code) => {
    const body = mapPrismaError(err);
    expect(body?.statusCode).toBe(status);
    expect(body?.code).toBe(code);
  });

  it('includes the unique target in details', () => {
    expect(mapPrismaError({ code: 'P2002', meta: { target: ['username'] } })?.details).toEqual({
      target: 'username',
    });
  });

  it('detects an exclusion violation from the message only', () => {
    expect(findPgCode(new Error('violates exclusion constraint "worker_alloc_no_overlap"'))).toBe(
      '23P01',
    );
  });

  it.each([undefined, null, 'oops', new Error('boom'), { code: 'P1001' }])(
    'returns undefined for unrelated error %j',
    (err) => {
      expect(mapPrismaError(err)).toBeUndefined();
    },
  );
});
