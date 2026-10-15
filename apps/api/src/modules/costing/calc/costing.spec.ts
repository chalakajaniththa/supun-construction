import { DEFAULT_SETTINGS } from '@sc/shared';
import { describe, expect, it } from 'vitest';
import { type CostingInput, EXPENSE_TO_BUDGET, calculateCosts, labourEntry } from './costing.js';
import { projectHealth, timeElapsedPct } from './health.js';

const settings = DEFAULT_SETTINGS.payroll;

const empty: CostingInput = {
  budget: {},
  settings,
  labour: [],
  purchases: [],
  issues: [],
  usage: [],
  expenses: [],
};

const cat = (r: ReturnType<typeof calculateCosts>, c: string) =>
  r.byCategory.find((x) => x.category === c)!;

describe('labour', () => {
  const daily = {
    workerId: 'w1',
    code: 'W-0001',
    name: 'Sunil',
    type: 'DAILY' as const,
    rates: [{ effectiveFrom: '2026-01-01', dailyRate: '4000' }],
    finalized: [],
  };

  it('daily worker without finalized payroll: estimated from rates (+ OT)', () => {
    const e = labourEntry(
      {
        ...daily,
        days: [
          { date: '2026-10-01', status: 'PRESENT', otHours: '2' },
          { date: '2026-10-02', status: 'HALF_DAY', otHours: '0' },
          { date: '2026-10-03', status: 'ABSENT', otHours: '0' },
        ],
      },
      settings,
    )!;
    expect(e.amount.toFixed(2)).toBe('7500.00'); // 4000 + 1500 OT + 2000
    expect(e.quantity).toBe('1.5');
    expect(e.estimated).toBe(true);
  });

  it('finalized month: the payroll project cost spread over its days (exact for a full month)', () => {
    const e = labourEntry(
      {
        ...daily,
        days: [
          { date: '2026-09-01', status: 'PRESENT', otHours: '0' },
          { date: '2026-09-02', status: 'PRESENT', otHours: '3' },
          { date: '2026-09-03', status: 'HALF_DAY', otHours: '0' },
        ],
        finalized: [{ month: '2026-09', days: '2.5', cost: '12250.00' }],
      },
      settings,
    )!;
    expect(e.amount.toFixed(2)).toBe('12250.00');
    expect(e.estimated).toBe(false);
  });

  it('partial range inside a finalized month gets its share of the days', () => {
    const e = labourEntry(
      {
        ...daily,
        days: [{ date: '2026-09-01', status: 'PRESENT', otHours: '0' }],
        finalized: [{ month: '2026-09', days: '3', cost: '10000.00' }],
      },
      settings,
    )!;
    expect(e.amount.toFixed(2)).toBe('3333.33');
  });

  it('mixes finalized and estimated months', () => {
    const e = labourEntry(
      {
        ...daily,
        days: [
          { date: '2026-09-30', status: 'PRESENT', otHours: '0' },
          { date: '2026-10-01', status: 'PRESENT', otHours: '0' },
        ],
        finalized: [{ month: '2026-09', days: '1', cost: '3800.00' }],
      },
      settings,
    )!;
    expect(e.amount.toFixed(2)).toBe('7800.00');
    expect(e.estimated).toBe(true);
  });

  it('permanent worker estimate includes employer EPF 12% + ETF 3%', () => {
    const e = labourEntry(
      {
        workerId: 'w2',
        code: 'W-0020',
        name: 'Supervisor',
        type: 'PERMANENT',
        rates: [{ effectiveFrom: '2026-01-01', monthlySalary: '78000' }],
        days: [{ date: '2026-10-01', status: 'PRESENT', otHours: '0' }],
        finalized: [],
      },
      settings,
    )!;
    expect(e.amount.toFixed(2)).toBe('3450.00');
  });

  it('no paid days → no entry', () => {
    expect(
      labourEntry(
        { ...daily, days: [{ date: '2026-10-01', status: 'LEAVE', otHours: '0' }] },
        settings,
      ),
    ).toBeNull();
  });
});

describe('calculateCosts', () => {
  const input: CostingInput = {
    ...empty,
    budget: { LABOUR: '10000', MATERIALS: '100000', EQUIPMENT: '20000', SUBCONTRACT: '5000' },
    labour: [
      {
        workerId: 'w1',
        code: 'W-0001',
        name: 'Sunil',
        type: 'DAILY',
        rates: [{ effectiveFrom: '2026-01-01', dailyRate: '4000' }],
        days: [{ date: '2026-10-01', status: 'PRESENT', otHours: '0' }],
        finalized: [],
      },
      {
        workerId: 'w2',
        code: 'W-0002',
        name: 'Ruwan',
        type: 'DAILY',
        rates: [{ effectiveFrom: '2026-01-01', dailyRate: '3000' }],
        days: [
          { date: '2026-10-01', status: 'PRESENT', otHours: '0' },
          { date: '2026-10-02', status: 'PRESENT', otHours: '0' },
        ],
        finalized: [],
      },
    ],
    purchases: [
      {
        date: '2026-10-01',
        material: 'Cement',
        unit: 'bag',
        quantity: '50',
        amount: '106000.00',
        reference: 'INV-1',
        refId: 'pu1',
      },
    ],
    issues: [
      {
        date: '2026-10-02',
        material: 'Sand',
        unit: 'cube',
        quantity: '1.5',
        unitCost: '18500.33',
        refId: 'is1',
      },
    ],
    usage: [
      {
        date: '2026-10-01',
        assetId: 'a1',
        assetCode: 'AST-001',
        assetName: 'JCB',
        hoursUsed: '6.5',
        ratePerHour: '6500',
        ratePerDay: null,
        fuelLitres: '30',
        fuelCost: '10950',
      },
      {
        date: '2026-10-02',
        assetId: 'a2',
        assetCode: 'AST-007',
        assetName: 'Cab',
        hoursUsed: '0',
        ratePerHour: null,
        ratePerDay: '7500',
        fuelLitres: null,
        fuelCost: null,
      },
      {
        date: '2026-10-02',
        assetId: 'a3',
        assetCode: 'AST-009',
        assetName: 'Mixer',
        hoursUsed: '4',
        ratePerHour: null,
        ratePerDay: null,
        fuelLitres: null,
        fuelCost: '0',
      },
    ],
    expenses: [
      {
        id: 'e1',
        date: '2026-10-01',
        category: 'EQUIPMENT_HIRE',
        description: 'Roller hire',
        amount: '15000',
        supplier: 'Hire Co',
      },
      {
        id: 'e2',
        date: '2026-10-02',
        category: 'SUBCONTRACT',
        description: 'Electrical',
        amount: '25000',
        supplier: null,
      },
      {
        id: 'e3',
        date: '2026-10-03',
        category: 'MEALS',
        description: 'Tea',
        amount: '1200',
        supplier: null,
      },
      {
        id: 'e4',
        date: '2026-10-03',
        category: 'PERMITS_FEES',
        description: 'Permit',
        amount: '3500',
        supplier: null,
      },
    ],
  };
  const r = calculateCosts(input);

  it('per category: actual, budget, variance, % used', () => {
    const rows = r.byCategory.map((c) => [
      c.category,
      c.budget.toFixed(2),
      c.actual.toFixed(2),
      c.variance.toFixed(2),
      c.pct?.toFixed(2) ?? null,
    ]);
    expect(rows).toEqual([
      ['LABOUR', '10000.00', '10000.00', '0.00', '100.00'],
      // 106,000 + 1.5 × 18,500.33 = 27,750.495 → 27,750.50
      ['MATERIALS', '100000.00', '133750.50', '-33750.50', '133.75'],
      // 6.5 × 6500 = 42,250 + fuel 10,950 + day rate 7,500 + mixer 0 + hire 15,000
      ['EQUIPMENT', '20000.00', '75700.00', '-55700.00', '378.50'],
      ['SUBCONTRACT', '5000.00', '25000.00', '-20000.00', '500.00'],
      ['OVERHEAD', '0.00', '3500.00', '-3500.00', null],
      ['OTHER', '0.00', '1200.00', '-1200.00', null],
    ]);
    expect(r.total.actual.toFixed(2)).toBe('249150.50');
    expect(r.total.budget.toFixed(2)).toBe('135000.00');
    expect(r.estimated).toBe(true);
  });

  it('category totals equal the sum of their entries', () => {
    for (const c of r.byCategory) {
      const s = c.entries.reduce((a, e) => a.plus(e.amount), c.actual.minus(c.actual));
      expect(s.toFixed(2)).toBe(c.actual.toFixed(2));
    }
  });

  it('labour entries per worker, biggest first; machine entries carry hours or days', () => {
    expect(cat(r, 'LABOUR').entries.map((e) => [e.reference, e.amount.toFixed(2)])).toEqual([
      ['W-0002', '6000.00'],
      ['W-0001', '4000.00'],
    ]);
    const eq = cat(r, 'EQUIPMENT').entries;
    expect(
      eq
        .filter((e) => e.kind === 'MACHINE')
        .map((e) => [e.reference, e.quantity, e.unit, e.amount.toFixed(2)]),
    ).toEqual([
      ['AST-007', '1', 'day', '7500.00'],
      ['AST-009', '4', 'h', '0.00'],
      ['AST-001', '6.5', 'h', '42250.00'],
    ]);
    expect(eq.filter((e) => e.kind === 'FUEL')).toHaveLength(1);
  });

  it('an empty project costs nothing and has no %', () => {
    const e = calculateCosts(empty);
    expect(e.total.actual.toFixed(2)).toBe('0.00');
    expect(e.total.pct).toBeNull();
    expect(e.estimated).toBe(false);
    expect(e.byCategory).toHaveLength(6);
  });

  it('every expense category maps to a budget category', () => {
    expect(Object.keys(EXPENSE_TO_BUDGET)).toHaveLength(11);
  });
});

describe('health', () => {
  it.each([
    ['2026-01-01', '0.00'],
    ['2026-01-10', '0.00'],
    ['2026-02-01', '22.00'],
    ['2026-04-11', '91.00'],
    ['2026-05-01', '100.00'],
  ])('time elapsed on %s', (today, pct) => {
    // 10 Jan → 20 Apr = 100 days
    expect(timeElapsedPct(today, '2026-01-10', '2026-04-20').toFixed(2)).toBe(pct);
  });

  it('a completed project is 100% elapsed', () => {
    expect(timeElapsedPct('2026-01-01', '2026-01-10', '2026-04-20', 'COMPLETED').toFixed(2)).toBe(
      '100.00',
    );
  });

  const base = {
    today: '2026-03-01',
    status: 'ONGOING' as const,
    startDate: '2026-01-01',
    currentEndDate: '2026-04-30', // 119 days; 59 elapsed → 49.58%
    budget: '1000000',
    actual: '400000',
    boqPct: '45',
    manualPct: null,
  };

  it.each([
    { name: 'healthy', over: {}, flags: [] },
    {
      name: 'over budget (and cost ahead of progress)',
      over: { actual: '1100000' },
      flags: ['OVER_BUDGET', 'COST_AHEAD_OF_PROGRESS'],
    },
    {
      name: 'cost ahead of progress by more than 15 points',
      over: { actual: '610000' },
      flags: ['COST_AHEAD_OF_PROGRESS'],
    },
    { name: 'exactly 15 points ahead is fine', over: { actual: '600000' }, flags: [] },
    { name: 'behind schedule', over: { boqPct: '30' }, flags: ['BEHIND_SCHEDULE'] },
    {
      name: 'all three',
      over: { boqPct: '10', actual: '1200000' },
      flags: ['OVER_BUDGET', 'COST_AHEAD_OF_PROGRESS', 'BEHIND_SCHEDULE'],
    },
    { name: 'no budget: no budget flags', over: { budget: '0', actual: '5000000' }, flags: [] },
    {
      name: 'completed projects are never behind schedule',
      over: { status: 'COMPLETED' as const, boqPct: '50' },
      flags: [],
    },
  ])('$name', ({ over, flags }) => {
    expect(projectHealth({ ...base, ...over }).flags).toEqual(flags);
  });

  it('falls back to the manual progress without a BOQ', () => {
    const h = projectHealth({ ...base, boqPct: null, manualPct: '60' });
    expect(h.physicalSource).toBe('MANUAL');
    expect(h.physicalPct.toFixed(2)).toBe('60.00');
    const none = projectHealth({ ...base, boqPct: null, manualPct: null });
    expect(none.physicalSource).toBe('NONE');
    expect(none.physicalPct.toFixed(2)).toBe('0.00');
  });

  it('reports the three bars', () => {
    const h = projectHealth(base);
    expect([h.timePct.toFixed(2), h.budgetPct?.toFixed(2), h.physicalPct.toFixed(2)]).toEqual([
      '49.58',
      '40.00',
      '45.00',
    ]);
  });
});
