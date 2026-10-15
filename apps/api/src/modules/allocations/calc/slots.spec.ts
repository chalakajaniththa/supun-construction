import { describe, expect, it } from 'vitest';
import { buildSlots, findConflicts, overlaps, slotWindow } from './slots.js';

const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`);

describe('buildSlots', () => {
  it('makes one slot per day per resource in Colombo time', () => {
    const slots = buildSlots({
      resourceIds: ['a', 'b'],
      fromDate: '2026-10-12',
      toDate: '2026-10-14',
      startTime: '08:00',
      endTime: '17:00',
    });
    expect(slots).toHaveLength(6);
    expect(slots[0]).toEqual({
      resourceId: 'a',
      start: new Date('2026-10-12T02:30:00.000Z'),
      end: new Date('2026-10-12T11:30:00.000Z'),
    });
  });

  it('defaults to a single day and removes duplicate resources', () => {
    const slots = buildSlots({
      resourceIds: ['a', 'a'],
      fromDate: '2026-10-14',
      startTime: '13:00',
      endTime: '17:00',
    });
    expect(slots).toHaveLength(1);
  });

  it('skips Sundays in a range but not a single Sunday', () => {
    // 2026-10-18 is a Sunday
    const week = buildSlots({
      resourceIds: ['a'],
      fromDate: '2026-10-12',
      toDate: '2026-10-18',
      startTime: '08:00',
      endTime: '17:00',
      skipSundays: true,
    });
    expect(week).toHaveLength(6);
    const sunday = buildSlots({
      resourceIds: ['a'],
      fromDate: '2026-10-18',
      startTime: '08:00',
      endTime: '17:00',
      skipSundays: true,
    });
    expect(sunday).toHaveLength(1);
  });

  it('crosses a month boundary', () => {
    const slots = buildSlots({
      resourceIds: ['a'],
      fromDate: '2026-10-30',
      toDate: '2026-11-02',
      startTime: '08:00',
      endTime: '12:00',
    });
    expect(slots.map((s) => s.start.toISOString().slice(0, 10))).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});

describe('overlaps / findConflicts', () => {
  it.each([
    ['10:00', '12:00', '11:00', '13:00', true],
    ['10:00', '12:00', '12:00', '14:00', false],
    ['10:00', '12:00', '08:00', '10:00', false],
    ['10:00', '12:00', '09:00', '17:00', true],
    ['10:00', '12:00', '10:30', '11:00', true],
  ])('%s–%s vs %s–%s → %s', (a1, a2, b1, b2, expected) => {
    const d = '2026-10-14';
    expect(overlaps(at(d, a1), at(d, a2), at(d, b1), at(d, b2))).toBe(expected);
  });

  it('only compares the same resource and lists every clash', () => {
    const d = '2026-10-14';
    const slots = [
      { resourceId: 'a', start: at(d, '08:00'), end: at(d, '17:00') },
      { resourceId: 'b', start: at(d, '08:00'), end: at(d, '17:00') },
    ];
    const existing = [
      { id: 'x', resourceId: 'a', startAt: at(d, '07:00'), endAt: at(d, '09:00') },
      { id: 'y', resourceId: 'a', startAt: at(d, '13:00'), endAt: at(d, '15:00') },
      { id: 'z', resourceId: 'c', startAt: at(d, '08:00'), endAt: at(d, '17:00') },
      { id: 'w', resourceId: 'b', startAt: at(d, '17:00'), endAt: at(d, '19:00') },
    ];
    expect(findConflicts(slots, existing).map((c) => c.booking.id)).toEqual(['x', 'y']);
  });

  it('slotWindow spans all slots', () => {
    const w = slotWindow([
      { resourceId: 'a', start: at('2026-10-14', '08:00'), end: at('2026-10-14', '12:00') },
      { resourceId: 'a', start: at('2026-10-13', '13:00'), end: at('2026-10-13', '17:00') },
    ]);
    expect(w).toEqual({ from: at('2026-10-13', '13:00'), to: at('2026-10-14', '12:00') });
    expect(slotWindow([])).toBeNull();
  });
});
