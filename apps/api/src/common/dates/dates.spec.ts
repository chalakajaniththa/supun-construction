import { describe, expect, it } from 'vitest';
import { addDays, todayInColombo } from './dates.js';

describe('dates', () => {
  it('today is computed in Asia/Colombo (UTC+5:30)', () => {
    expect(todayInColombo(new Date('2026-10-14T18:29:00Z'))).toBe('2026-10-14');
    expect(todayInColombo(new Date('2026-10-14T18:31:00Z'))).toBe('2026-10-15');
  });

  it.each([
    ['2026-10-14', 1, '2026-10-15'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-10-14', 30, '2026-11-13'],
  ])('addDays(%s, %i) = %s', (day, n, expected) => expect(addDays(day, n)).toBe(expected));
});
