import { describe, expect, it } from 'vitest';
import {
  type BoqItemLike,
  calculateProgress,
  checkMeasurement,
  latestMeasurement,
  measuredWorkDone,
  measurementWarnings,
  percent,
} from './progress.js';

const items: BoqItemLike[] = [
  {
    id: 'a',
    itemNo: '1.1',
    description: 'Excavation',
    unit: 'm3',
    quantity: '100',
    rate: '1500',
    measurements: [
      { date: '2026-08-01', cumulativeQty: '40' },
      { date: '2026-09-01', cumulativeQty: '80' },
      { date: '2026-10-01', cumulativeQty: '100' },
    ],
  },
  {
    id: 'b',
    itemNo: '1.2',
    description: 'ABC base',
    unit: 'm3',
    quantity: '50.5',
    rate: '9800.50',
    measurements: [{ date: '2026-09-15', cumulativeQty: '10.25' }],
  },
  {
    id: 'v',
    itemNo: 'V1.1',
    description: 'Extra drain (pending variation)',
    unit: 'm',
    quantity: '10',
    rate: '5000',
    excluded: true,
    measurements: [{ date: '2026-09-01', cumulativeQty: '10' }],
  },
];

describe('calculateProgress', () => {
  it.each([
    // asOf, done a, done b, total done, physical %
    ['2026-07-31', '0', '0', '0.00', '0.00'],
    ['2026-08-01', '40', '0', '60000.00', '9.30'],
    ['2026-09-15', '80', '10.25', '220455.13', '34.18'],
    ['2026-12-31', '100', '10.25', '250455.13', '38.83'],
  ])('as of %s', (asOf, doneA, doneB, totalDone, pct) => {
    const r = calculateProgress(items, asOf);
    expect(r.items[0]!.done.toString()).toBe(doneA);
    expect(r.items[1]!.done.toString()).toBe(doneB);
    // 150,000 + 50.5 × 9800.50 = 494,925.25 (+ 0 for the excluded item)
    expect(r.totalAmount.toFixed(2)).toBe('644925.25');
    expect(r.totalDone.toFixed(2)).toBe(totalDone);
    expect(r.physicalPct.toFixed(2)).toBe(pct);
  });

  it('per item: amount, %, amount done, last measured', () => {
    const [a, b, v] = calculateProgress(items, '2026-09-20').items;
    expect([
      a!.amount.toFixed(2),
      a!.pct.toFixed(2),
      a!.amountDone.toFixed(2),
      a!.lastMeasuredOn,
    ]).toEqual(['150000.00', '80.00', '120000.00', '2026-09-01']);
    // 10.25 × 9800.50 = 100,455.125 → 100,455.13
    expect([b!.amount.toFixed(2), b!.pct.toFixed(2), b!.amountDone.toFixed(2)]).toEqual([
      '494925.25',
      '20.30',
      '100455.13',
    ]);
    expect(v!.excluded).toBe(true);
    expect(v!.amountDone.toFixed(2)).toBe('50000.00');
  });

  it('over-measured items can exceed 100%', () => {
    const r = calculateProgress(
      [
        {
          id: 'x',
          itemNo: '1',
          description: 'x',
          unit: 'nos',
          quantity: '4',
          rate: '100',
          measurements: [{ date: '2026-01-01', cumulativeQty: '5' }],
        },
      ],
      '2026-12-31',
    );
    expect(r.items[0]!.pct.toFixed(2)).toBe('125.00');
    expect(r.physicalPct.toFixed(2)).toBe('125.00');
  });

  it('an empty BOQ is 0%', () => {
    const r = calculateProgress([], '2026-10-01');
    expect(r.physicalPct.toFixed(2)).toBe('0.00');
    expect(r.totalAmount.toFixed(2)).toBe('0.00');
  });

  it('measuredWorkDone = Σ done × rate', () => {
    expect(measuredWorkDone(items, '2026-09-01').toFixed(2)).toBe('120000.00');
  });
});

describe('measurements', () => {
  const ms = [
    { date: '2026-08-01', cumulativeQty: '40' },
    { date: '2026-09-01', cumulativeQty: '80' },
  ];
  it.each([
    ['2026-10-01', '80', null],
    ['2026-10-01', '120', null],
    ['2026-10-01', '79.999', 'OUT_OF_ORDER'],
    ['2026-08-15', '60', null],
    ['2026-08-15', '30', 'OUT_OF_ORDER'],
    ['2026-08-15', '81', 'OUT_OF_ORDER'],
    ['2026-07-01', '40', null],
    ['2026-07-01', '41', 'OUT_OF_ORDER'],
    // same date: replaces the existing one
    ['2026-09-01', '70', null],
  ])('checkMeasurement on %s with %s → %s', (date, qty, expected) => {
    expect(checkMeasurement(ms, date, qty)).toBe(expected);
  });

  it('warns when above the BOQ quantity', () => {
    expect(measurementWarnings('100', '100')).toEqual([]);
    expect(measurementWarnings('100', '100.001')).toEqual(['OVER_QUANTITY']);
  });

  it('latestMeasurement picks the latest on or before the date', () => {
    expect(latestMeasurement(ms, '2026-08-31')?.cumulativeQty).toBe('40');
    expect(latestMeasurement(ms, '2026-07-31')).toBeNull();
  });

  it('percent rounds half-up and handles 0', () => {
    expect(percent('1', '3').toFixed(2)).toBe('33.33');
    expect(percent('2', '3').toFixed(2)).toBe('66.67');
    expect(percent('5', '0').toFixed(2)).toBe('0.00');
  });
});
