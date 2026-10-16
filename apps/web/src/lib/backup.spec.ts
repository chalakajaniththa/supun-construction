import { describe, expect, it } from 'vitest';
import { dailyTime, durationMinutes, formatBytes } from './backup';

describe('formatBytes', () => {
  it.each([
    [null, '—'],
    ['', '—'],
    ['-1', '—'],
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    ['569344', '556.0 KB'],
    [18_734_112, '17.9 MB'],
    [5 * 1024 ** 3, '5.0 GB'],
  ])('%s → %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});

describe('dailyTime', () => {
  it('reads daily schedules', () => {
    expect(dailyTime('0 23 * * *')).toBe('23:00');
    expect(dailyTime('30 6 * * *')).toBe('06:30');
  });
  it('returns null for other schedules', () => {
    expect(dailyTime('0 */6 * * *')).toBeNull();
    expect(dailyTime('0 23 * * 1-5')).toBeNull();
    expect(dailyTime('61 23 * * *')).toBeNull();
    expect(dailyTime(null)).toBeNull();
  });
});

describe('durationMinutes', () => {
  it('rounds to whole minutes (0 = under a minute)', () => {
    expect(durationMinutes('2026-10-16T08:00:00Z', '2026-10-16T08:00:05Z')).toBe(0);
    expect(durationMinutes('2026-10-16T08:00:00Z', '2026-10-16T08:00:40Z')).toBe(1);
    expect(durationMinutes('2026-10-16T08:00:00Z', '2026-10-16T08:03:40Z')).toBe(4);
    expect(durationMinutes('2026-10-16T08:00:00Z', null)).toBeNull();
  });
});
