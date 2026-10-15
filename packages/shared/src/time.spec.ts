import { describe, expect, it } from 'vitest';
import {
  colomboDay,
  colomboDayRange,
  colomboInstant,
  colomboTime,
  daysBetween,
  mondayOf,
  monthRange,
  shiftDay,
  weekdayOf,
} from './time';

describe('Colombo time helpers', () => {
  it('converts a day + time to an instant and back (+05:30)', () => {
    const i = colomboInstant('2026-10-14', '08:00');
    expect(i.toISOString()).toBe('2026-10-14T02:30:00.000Z');
    expect(colomboDay(i)).toBe('2026-10-14');
    expect(colomboTime(i)).toBe('08:00');
  });

  it('handles the hours around midnight (UTC day differs from Colombo day)', () => {
    const late = new Date('2026-10-14T20:00:00Z'); // 01:30 on the 15th in Colombo
    expect(colomboDay(late)).toBe('2026-10-15');
    expect(colomboTime(late)).toBe('01:30');
    const r = colomboDayRange('2026-10-15');
    expect(r.start.toISOString()).toBe('2026-10-14T18:30:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-15T18:30:00.000Z');
  });

  it('calendar arithmetic across month and year ends', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(daysBetween('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('weekday and the Monday of a week', () => {
    expect(weekdayOf('2026-10-18')).toBe(0); // Sunday
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(mondayOf('2026-10-15')).toBe('2026-10-12');
  });

  it('month ranges, including February in a leap year', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});
