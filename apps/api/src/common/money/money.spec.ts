import { describe, expect, it } from 'vitest';
import { Decimal as PrismaDecimal } from '../../generated/prisma/internal/prismaNamespace.js';
import {
  Decimal,
  dec,
  decimalToJson,
  isDecimalLike,
  maxDecimal,
  minDecimal,
  moneyString,
  percentOf,
  qtyString,
  roundMoney,
  sum,
} from './money.js';

describe('money utils', () => {
  it('avoids float errors', () => {
    expect(sum(['0.1', '0.2']).toString()).toBe('0.3');
    expect(moneyString(dec('0.1').plus('0.2'))).toBe('0.30');
  });

  it.each([
    ['1.005', '1.01'],
    ['1.004', '1.00'],
    ['-1.005', '-1.01'],
    ['2.5', '2.50'],
    ['1250000', '1250000.00'],
  ])('roundMoney(%s) = %s (half-up)', (input, expected) => {
    expect(roundMoney(input).toFixed(2)).toBe(expected);
  });

  it('qtyString keeps up to 3 dp', () => {
    expect(qtyString('12.3456')).toBe('12.346');
    expect(qtyString('12.500')).toBe('12.5');
  });

  it('dec handles null/empty as zero', () => {
    expect(dec(null).toString()).toBe('0');
    expect(dec('').toString()).toBe('0');
    expect(dec(undefined).toString()).toBe('0');
  });

  it('percentOf rounds to money', () => {
    expect(percentOf('55000', '8').toFixed(2)).toBe('4400.00');
    expect(percentOf('33333.33', '12').toFixed(2)).toBe('4000.00');
    expect(percentOf('100.10', '3').toFixed(2)).toBe('3.00');
  });

  it('min / max', () => {
    expect(minDecimal('5', '2.5', '10').toString()).toBe('2.5');
    expect(maxDecimal('5', '2.5', '10').toString()).toBe('10');
  });

  it('recognises decimal.js and Prisma Decimal instances', () => {
    expect(isDecimalLike(new Decimal(1))).toBe(true);
    expect(isDecimalLike(new PrismaDecimal('1.5'))).toBe(true);
    expect(isDecimalLike({ toFixed: () => '1' })).toBe(false);
    expect(isDecimalLike('1.5')).toBe(false);
  });

  it.each([
    ['1250000', '1250000.00'],
    ['12.5', '12.50'],
    ['12.375', '12.375'],
    ['0', '0.00'],
  ])('decimalToJson(%s) = %s', (input, expected) => {
    expect(decimalToJson(new PrismaDecimal(input))).toBe(expected);
  });
});
