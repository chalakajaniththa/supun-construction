import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatQty,
  todayInColombo,
} from './format';

describe('formatMoney', () => {
  it.each([
    ['1250000', 'Rs. 1,250,000.00'],
    ['1250000.5', 'Rs. 1,250,000.50'],
    ['0', 'Rs. 0.00'],
    ['999.995', 'Rs. 1,000.00'],
    ['0.1', 'Rs. 0.10'],
    ['-1500.25', '-Rs. 1,500.25'],
    [1500, 'Rs. 1,500.00'],
    ['123456789012.34', 'Rs. 123,456,789,012.34'],
  ])('formatMoney(%j) = %s', (input, expected) => {
    expect(formatMoney(input)).toBe(expected);
  });

  it('handles empty and invalid input', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney('')).toBe('—');
    expect(formatMoney('abc')).toBe('—');
  });

  it('can omit the symbol', () => {
    expect(formatMoney('2500', { symbol: false })).toBe('2,500.00');
  });

  it('is exact where floats are not', () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004
    expect(formatMoney('0.30000000000000004')).toBe('Rs. 0.30');
    expect(formatMoney('1.005')).toBe('Rs. 1.01');
  });
});

describe('formatQty / formatPercent', () => {
  it.each([
    ['12.5', '12.5'],
    ['12.500', '12.5'],
    ['1250.3456', '1,250.346'],
    ['3', '3'],
  ])('formatQty(%j) = %s', (input, expected) => {
    expect(formatQty(input)).toBe(expected);
  });

  it('formats percentages', () => {
    expect(formatPercent('12.345')).toBe('12.3%');
    expect(formatPercent('100')).toBe('100%');
  });
});

describe('dates (Asia/Colombo)', () => {
  it('formats calendar days without timezone shifts', () => {
    expect(formatDate('2026-10-14')).toBe('14 Oct 2026');
    expect(formatDate('2026-10-14T00:00:00.000Z')).toBe('14 Oct 2026');
  });

  it('formats timestamps in Colombo time', () => {
    // 20:00 UTC on 13 Oct is 01:30 on 14 Oct in Colombo (+05:30)
    expect(formatDate('2026-10-13T20:00:00Z')).toBe('14 Oct 2026');
    expect(formatDateTime('2026-10-13T20:00:00Z')).toBe('14 Oct 2026, 01:30');
  });

  it('computes today in Colombo', () => {
    expect(todayInColombo(new Date('2026-10-13T19:00:00Z'))).toBe('2026-10-14');
    expect(todayInColombo(new Date('2026-10-13T18:00:00Z'))).toBe('2026-10-13');
  });

  it('handles empty values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
});
