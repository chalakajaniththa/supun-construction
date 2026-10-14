import { describe, expect, it } from 'vitest';
import { pickRateOn } from './rates.js';

const rates = [
  { id: 'b', effectiveFrom: new Date('2026-09-01T00:00:00Z'), dailyRate: '3800' },
  { id: 'a', effectiveFrom: new Date('2026-01-15T00:00:00Z'), dailyRate: '3500' },
  { id: 'c', effectiveFrom: '2026-11-01', dailyRate: '4000' },
];

describe('pickRateOn', () => {
  it.each([
    ['2026-01-14', null],
    ['2026-01-15', 'a'],
    ['2026-08-31', 'a'],
    ['2026-09-01', 'b'],
    ['2026-10-31', 'b'],
    ['2026-11-01', 'c'],
    ['2030-01-01', 'c'],
  ])('on %s → %s', (day, id) => {
    expect(pickRateOn(rates, day)?.id ?? null).toBe(id);
  });

  it('no rates → null', () => {
    expect(pickRateOn([], '2026-10-14')).toBeNull();
  });
});
