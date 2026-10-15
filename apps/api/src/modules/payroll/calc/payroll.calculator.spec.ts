import { DEFAULT_SETTINGS } from '@sc/shared';
import { describe, expect, it } from 'vitest';
import {
  type CalcAttendance,
  type PayrollCalcInput,
  advanceInstalments,
  allocateAdvanceDeduction,
  calculatePayrollLine,
  employedInMonth,
  estimateDayCost,
  workingDaysBetween,
} from './payroll.calculator.js';

const settings = DEFAULT_SETTINGS.payroll;
const P1 = 'p1';
const P2 = 'p2';

const day = (
  date: string,
  status: CalcAttendance['status'] = 'PRESENT',
  otHours = '0',
  projectId: string | null = P1,
): CalcAttendance => ({
  date,
  status,
  otHours,
  projectId,
});

function daily(over: Partial<PayrollCalcInput> = {}): PayrollCalcInput {
  return {
    worker: { type: 'DAILY', joinedDate: '2026-01-01', leftDate: null },
    year: 2026,
    month: 9,
    attendance: [],
    rates: [{ effectiveFrom: '2026-01-01', dailyRate: '4000' }],
    settings,
    advances: [],
    ...over,
  };
}

function permanent(over: Partial<PayrollCalcInput> = {}): PayrollCalcInput {
  return {
    ...daily(),
    worker: { type: 'PERMANENT', joinedDate: '2026-01-01', leftDate: null },
    rates: [{ effectiveFrom: '2026-01-01', monthlySalary: '78000' }],
    ...over,
  };
}

const s = (v: { toFixed: (n: number) => string }) => v.toFixed(2);

describe('calculatePayrollLine — daily-paid', () => {
  it.each([
    {
      name: 'full days',
      input: daily({ attendance: [day('2026-09-01'), day('2026-09-02'), day('2026-09-03')] }),
      basic: '12000.00',
      ot: '0.00',
      days: '3',
      half: 0,
    },
    {
      name: 'half days count 0.5',
      input: daily({
        rates: [{ effectiveFrom: '2026-01-01', dailyRate: '3000' }],
        attendance: [day('2026-09-01'), day('2026-09-02'), day('2026-09-03', 'HALF_DAY')],
      }),
      basic: '7500.00',
      ot: '0.00',
      days: '2.5',
      half: 1,
    },
    {
      name: 'absent and leave are unpaid',
      input: daily({
        attendance: [day('2026-09-01'), day('2026-09-02', 'ABSENT'), day('2026-09-03', 'LEAVE')],
      }),
      basic: '4000.00',
      ot: '0.00',
      days: '1',
      half: 0,
    },
    {
      name: 'a rate change mid-month',
      input: daily({
        rates: [
          { effectiveFrom: '2026-09-15', dailyRate: '3500' },
          { effectiveFrom: '2026-01-01', dailyRate: '3000' },
        ],
        attendance: ['2026-09-10', '2026-09-14', '2026-09-15', '2026-09-16'].map((d) => day(d)),
      }),
      basic: '13000.00',
      ot: '0.00',
      days: '4',
      half: 0,
    },
    {
      name: 'OT without otHourlyRate = daily / 8 × 1.5',
      input: daily({ attendance: [day('2026-09-01', 'PRESENT', '2')] }),
      basic: '4000.00',
      ot: '1500.00',
      days: '1',
      half: 0,
    },
    {
      name: 'OT with otHourlyRate',
      input: daily({
        rates: [{ effectiveFrom: '2026-01-01', dailyRate: '4000', otHourlyRate: '600' }],
        attendance: [day('2026-09-01', 'PRESENT', '2.5')],
      }),
      basic: '4000.00',
      ot: '1500.00',
      days: '1',
      half: 0,
    },
    {
      name: 'attendance of other months is ignored',
      input: daily({ attendance: [day('2026-08-31'), day('2026-09-30'), day('2026-10-01')] }),
      basic: '4000.00',
      ot: '0.00',
      days: '1',
      half: 0,
    },
    {
      name: 'an empty month',
      input: daily(),
      basic: '0.00',
      ot: '0.00',
      days: '0',
      half: 0,
    },
  ])('$name', ({ input, basic, ot, days, half }) => {
    const r = calculatePayrollLine(input);
    expect(s(r.basicPay)).toBe(basic);
    expect(s(r.otPay)).toBe(ot);
    expect(s(r.grossPay)).toBe((Number(basic) + Number(ot)).toFixed(2));
    expect(r.daysWorked.toString()).toBe(days);
    expect(r.halfDays).toBe(half);
    // no EPF / ETF for daily-paid workers
    expect(s(r.epfEmployee)).toBe('0.00');
    expect(s(r.epfEmployer)).toBe('0.00');
    expect(s(r.etfEmployer)).toBe('0.00');
    expect(s(r.netPay)).toBe(s(r.grossPay));
  });

  it('OT on an absent day is not paid', () => {
    const r = calculatePayrollLine(daily({ attendance: [day('2026-09-01', 'ABSENT', '3')] }));
    expect(s(r.otPay)).toBe('0.00');
    expect(r.otHours.toString()).toBe('0');
  });

  it('splits the labour cost per project and keeps Σ breakdown = gross', () => {
    const r = calculatePayrollLine(
      daily({
        rates: [{ effectiveFrom: '2026-01-01', dailyRate: '3333.33' }],
        attendance: [
          day('2026-09-01', 'PRESENT', '1', P1),
          day('2026-09-02', 'HALF_DAY', '0', P2),
          day('2026-09-03', 'PRESENT', '0', null),
        ],
      }),
    );
    expect(r.breakdown.map((b) => [b.projectId, b.days.toString(), b.cost.toFixed(2)])).toEqual([
      [P1, '1', '3958.33'], // 3333.33 + 1 × 3333.33 / 8 × 1.5 = 3958.329…
      [P2, '0.5', '1666.67'],
      [null, '1', '3333.33'],
    ]);
    const total = r.breakdown.reduce((a, b) => a.plus(b.cost), r.grossPay.minus(r.grossPay));
    expect(total.toFixed(2)).toBe(r.grossPay.toFixed(2));
  });

  it('flags a missing rate', () => {
    const r = calculatePayrollLine(daily({ rates: [], attendance: [day('2026-09-01')] }));
    expect(r.missingRate).toBe(true);
    expect(s(r.grossPay)).toBe('0.00');
  });
});

describe('calculatePayrollLine — permanent', () => {
  it('no-pay days, OT and EPF/ETF', () => {
    const r = calculatePayrollLine(
      permanent({
        attendance: [
          day('2026-09-01', 'PRESENT', '10'),
          day('2026-09-02', 'ABSENT', '0', null),
          day('2026-09-03', 'ABSENT', '0', null),
          day('2026-09-04', 'LEAVE', '0', null),
        ],
      }),
    );
    // 78000 / 26 = 3000 per day; 2 absences
    expect(r.noPayDays.toString()).toBe('2');
    expect(s(r.basicPay)).toBe('72000.00');
    // 78000 / 240 × 1.5 = 487.5 per hour × 10
    expect(s(r.otPay)).toBe('4875.00');
    expect(s(r.grossPay)).toBe('76875.00');
    // EPF/ETF on basic only (excluding OT)
    expect(s(r.epfEmployee)).toBe('5760.00');
    expect(s(r.epfEmployer)).toBe('8640.00');
    expect(s(r.etfEmployer)).toBe('2160.00');
    expect(s(r.netPay)).toBe('71115.00');
  });

  it.each([
    // salary, epf 8, epf 12, etf 3 — each rounded half-up to 2 dp
    ['55555.50', '4444.44', '6666.66', '1666.67'],
    ['61234.56', '4898.76', '7348.15', '1837.04'],
    ['100000.00', '8000.00', '12000.00', '3000.00'],
  ])('EPF/ETF rounding for %s', (salary, e8, e12, e3) => {
    const r = calculatePayrollLine(
      permanent({ rates: [{ effectiveFrom: '2026-01-01', monthlySalary: salary }] }),
    );
    expect(s(r.basicPay)).toBe(salary);
    expect([s(r.epfEmployee), s(r.epfEmployer), s(r.etfEmployer)]).toEqual([e8, e12, e3]);
  });

  it('uses the salary in force at the end of the month', () => {
    const r = calculatePayrollLine(
      permanent({
        rates: [
          { effectiveFrom: '2026-01-01', monthlySalary: '78000' },
          { effectiveFrom: '2026-09-20', monthlySalary: '83200' },
        ],
      }),
    );
    expect(s(r.basicPay)).toBe('83200.00');
  });

  it('joined mid-month: working days before joining are no-pay days', () => {
    // 1–14 Sep 2026 has 12 working days (Mon–Sat)
    const r = calculatePayrollLine(
      permanent({ worker: { type: 'PERMANENT', joinedDate: '2026-09-15', leftDate: null } }),
    );
    expect(r.noPayDays.toString()).toBe('12');
    expect(s(r.basicPay)).toBe('42000.00');
  });

  it('left mid-month: working days after leaving are no-pay days', () => {
    // 26–30 Sep 2026 has 4 working days
    const r = calculatePayrollLine(
      permanent({
        worker: { type: 'PERMANENT', joinedDate: '2025-01-01', leftDate: '2026-09-25' },
      }),
    );
    expect(r.noPayDays.toString()).toBe('4');
    expect(s(r.basicPay)).toBe('66000.00');
  });

  it('basic never goes below zero', () => {
    const absences = Array.from({ length: 30 }, (_, i) =>
      day(`2026-09-${String(i + 1).padStart(2, '0')}`, 'ABSENT', '0', null),
    );
    const r = calculatePayrollLine(permanent({ attendance: absences }));
    expect(s(r.basicPay)).toBe('0.00');
    expect(s(r.netPay)).toBe('0.00');
  });

  it('splits the employer cost (gross + EPF 12% + ETF 3%) by project days; days without a project are overhead', () => {
    const r = calculatePayrollLine(
      permanent({
        attendance: [
          day('2026-09-01', 'PRESENT', '0', P1),
          day('2026-09-02', 'PRESENT', '0', P1),
          day('2026-09-03', 'HALF_DAY', '0', P2),
          day('2026-09-04', 'HALF_DAY', '0', null),
        ],
      }),
    );
    // employer cost = 78000 + 9360 + 2340 = 89700 over 3 days
    expect(r.breakdown.map((b) => [b.projectId, b.days.toString(), b.cost.toFixed(2)])).toEqual([
      [P1, '2', '59800.00'],
      [P2, '0.5', '14950.00'],
      [null, '0.5', '14950.00'],
    ]);
  });

  it('an empty month still pays the salary (only ABSENT records are no-pay) — all overhead', () => {
    const r = calculatePayrollLine(permanent());
    expect(s(r.basicPay)).toBe('78000.00');
    expect(r.breakdown).toHaveLength(1);
    expect(r.breakdown[0]!.projectId).toBeNull();
    expect(s(r.breakdown[0]!.cost)).toBe('89700.00');
  });
});

describe('advances & deductions', () => {
  const adv = (id: string, date: string, balance: string, recoveryPerMonth: string | null) => ({
    id,
    date,
    balance,
    recoveryPerMonth,
  });

  it('deducts the instalments due, oldest advance first', () => {
    const r = calculatePayrollLine(
      daily({
        attendance: ['2026-09-01', '2026-09-02', '2026-09-03'].map((d) => day(d)),
        advances: [adv('b', '2026-08-20', '1500', null), adv('a', '2026-07-01', '10000', '2000')],
      }),
    );
    expect(s(r.advanceDue)).toBe('3500.00');
    expect(s(r.advanceDeduction)).toBe('3500.00');
    expect(s(r.netPay)).toBe('8500.00');
    expect(r.advanceAllocations.map((a) => [a.advanceId, s(a.amount)])).toEqual([
      ['a', '2000.00'],
      ['b', '1500.00'],
    ]);
  });

  it('an advance larger than pay: the deduction is capped so net ≥ 0, the rest stays open', () => {
    const r = calculatePayrollLine(
      daily({
        rates: [{ effectiveFrom: '2026-01-01', dailyRate: '3000' }],
        attendance: [day('2026-09-01')],
        advances: [adv('a', '2026-08-01', '10000', null)],
      }),
    );
    expect(s(r.advanceDeduction)).toBe('3000.00');
    expect(s(r.netPay)).toBe('0.00');
    expect(s(r.advanceBalance)).toBe('10000.00');
    expect(r.advanceAllocations).toEqual([{ advanceId: 'a', amount: expect.anything() }]);
    expect(s(r.advanceAllocations[0]!.amount)).toBe('3000.00');
  });

  it('the advance cap also leaves room for EPF and other deductions', () => {
    const r = calculatePayrollLine(
      permanent({ advances: [adv('a', '2026-08-01', '100000', null)], otherDeductions: '1000' }),
    );
    // 78000 − EPF 6240 − other 1000 = 70760 left for the advance
    expect(s(r.advanceDeduction)).toBe('70760.00');
    expect(s(r.netPay)).toBe('0.00');
  });

  it('an edited advance deduction is used (but never above the balance)', () => {
    const base = daily({
      attendance: ['2026-09-01', '2026-09-02'].map((d) => day(d)),
      advances: [adv('a', '2026-08-01', '5000', '1000')],
    });
    expect(s(calculatePayrollLine({ ...base, advanceDeduction: '2500' }).advanceDeduction)).toBe(
      '2500.00',
    );
    expect(s(calculatePayrollLine({ ...base, advanceDeduction: '0' }).advanceDeduction)).toBe(
      '0.00',
    );
    expect(s(calculatePayrollLine({ ...base, advanceDeduction: '9000' }).advanceDeduction)).toBe(
      '5000.00',
    );
  });

  it('other deductions reduce the net', () => {
    const r = calculatePayrollLine(
      daily({ attendance: [day('2026-09-01')], otherDeductions: '250.50' }),
    );
    expect(s(r.netPay)).toBe('3749.50');
  });

  it('advanceInstalments caps each instalment at its balance', () => {
    expect(
      advanceInstalments([
        adv('a', '2026-01-01', '500', '2000'),
        adv('b', '2026-01-02', '0', null),
      ]).toFixed(2),
    ).toBe('500.00');
  });

  it('allocateAdvanceDeduction: instalments first (oldest first), then the balances', () => {
    const advances = [
      adv('new', '2026-09-01', '3000', null),
      adv('old', '2026-06-01', '1000', '500'),
    ];
    const pairs = (amount: string) =>
      allocateAdvanceDeduction(advances, amount).map((o) => [o.advanceId, o.amount.toFixed(2)]);
    // capped below the instalments: oldest instalment first
    expect(pairs('700')).toEqual([
      ['old', '500.00'],
      ['new', '200.00'],
    ]);
    // exactly the instalments
    expect(pairs('3500')).toEqual([
      ['old', '500.00'],
      ['new', '3000.00'],
    ]);
    // more than the instalments: the rest of the oldest balance
    expect(pairs('3800')).toEqual([
      ['old', '800.00'],
      ['new', '3000.00'],
    ]);
    expect(allocateAdvanceDeduction([adv('a', '2026-01-01', '100', null)], '0')).toEqual([]);
  });
});

describe('helpers', () => {
  it('workingDaysBetween counts Mon–Sat', () => {
    expect(workingDaysBetween('2026-09-01', '2026-09-14')).toBe(12);
    expect(workingDaysBetween('2026-09-01', '2026-09-30')).toBe(26);
    expect(workingDaysBetween('2026-09-06', '2026-09-06')).toBe(0);
  });

  it.each([
    [{ joinedDate: '2026-09-30', leftDate: null }, true],
    [{ joinedDate: '2026-10-01', leftDate: null }, false],
    [{ joinedDate: '2025-01-01', leftDate: '2026-08-31' }, false],
    [{ joinedDate: '2025-01-01', leftDate: '2026-09-01' }, true],
  ])('employedInMonth %j → %s', (w, expected) => {
    expect(employedInMonth(w, 2026, 9)).toBe(expected);
  });

  it('estimateDayCost (daily: rate + OT; permanent: salary / 26 + EPF 12% + ETF 3% + OT)', () => {
    const rates = [{ effectiveFrom: '2026-01-01', dailyRate: '4000', monthlySalary: '78000' }];
    expect(
      estimateDayCost(
        'DAILY',
        rates,
        { date: '2026-09-01', status: 'PRESENT', otHours: '2' },
        settings,
      ).toFixed(2),
    ).toBe('5500.00');
    expect(
      estimateDayCost(
        'DAILY',
        rates,
        { date: '2026-09-01', status: 'ABSENT', otHours: '2' },
        settings,
      ).toFixed(2),
    ).toBe('0.00');
    // 3000 × 1.15 = 3450 ; half day 1725
    expect(
      estimateDayCost(
        'PERMANENT',
        rates,
        { date: '2026-09-01', status: 'PRESENT', otHours: '0' },
        settings,
      ).toFixed(2),
    ).toBe('3450.00');
    expect(
      estimateDayCost(
        'PERMANENT',
        rates,
        { date: '2026-09-01', status: 'HALF_DAY', otHours: '0' },
        settings,
      ).toFixed(2),
    ).toBe('1725.00');
  });
});
