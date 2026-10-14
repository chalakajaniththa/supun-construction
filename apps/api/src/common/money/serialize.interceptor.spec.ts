import { describe, expect, it } from 'vitest';
import { Decimal as PrismaDecimal } from '../../generated/prisma/internal/prismaNamespace.js';
import { serializeValue } from './serialize.interceptor.js';

describe('serializeValue', () => {
  it('converts nested decimals and bigints', () => {
    const date = new Date('2026-10-14T00:00:00Z');
    expect(
      serializeValue({
        amount: new PrismaDecimal('1500'),
        lines: [{ qty: new PrismaDecimal('2.125') }],
        size: 10n,
        date,
        name: 'x',
        nothing: null,
      }),
    ).toEqual({
      amount: '1500.00',
      lines: [{ qty: '2.125' }],
      size: '10',
      date,
      name: 'x',
      nothing: null,
    });
  });
});
