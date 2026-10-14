import { describe, expect, it } from 'vitest';
import { isMoneyString, isQtyString, moneySchema, percentSchema, qtySchema } from './money';

describe('money helpers', () => {
  it.each([
    ['0', true],
    ['1250000.00', true],
    ['-15.5', true],
    ['10.123', false],
    ['1e5', false],
    ['', false],
    ['1,000', false],
    ['.5', false],
  ])('isMoneyString(%j) = %s', (input, expected) => {
    expect(isMoneyString(input)).toBe(expected);
  });

  it.each([
    ['12.375', true],
    ['12.3755', false],
    ['3', true],
  ])('isQtyString(%j) = %s', (input, expected) => {
    expect(isQtyString(input)).toBe(expected);
  });

  it('moneySchema trims and accepts numbers', () => {
    expect(moneySchema.parse(' 100.50 ')).toBe('100.50');
    expect(moneySchema.parse(42)).toBe('42');
    expect(moneySchema.safeParse('abc').success).toBe(false);
  });

  it('qtySchema rejects 4 decimals', () => {
    expect(qtySchema.safeParse('1.2345').success).toBe(false);
  });

  it('percentSchema enforces 0–100', () => {
    expect(percentSchema.parse('12.5')).toBe('12.5');
    expect(percentSchema.safeParse('101').success).toBe(false);
    expect(percentSchema.safeParse('-1').success).toBe(false);
  });
});
