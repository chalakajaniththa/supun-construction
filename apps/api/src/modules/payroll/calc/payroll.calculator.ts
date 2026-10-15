import {
  type AttendanceStatus,
  type PayrollSettings,
  type WorkerType,
  monthRange,
  weekdayOf,
} from '@sc/shared';
import {
  Decimal,
  type DecimalInput,
  dec,
  maxDecimal,
  minDecimal,
  roundMoney,
  roundQty,
  sum,
} from '../../../common/money/money.js';
import { pickRateOn } from '../../workers/rates.js';

/**
 * Monthly payroll for one worker (overview §7). Pure: everything it needs is passed in.
 *
 * DAILY:     basic = Σ(day fraction × daily rate on that day); OT = Σ(otHours × OT rate), where the
 *            OT rate is the worker's otHourlyRate or dailyRate / dailyStandardHours × otMultiplier.
 *            No EPF/ETF.
 * PERMANENT: basic = salary − noPayDays × salary / workingDaysPerMonth, where noPayDays = ABSENT
 *            records + working days (Mon–Sat) of the month before joining / after leaving.
 *            OT = otHours × salary / permanentOtDivisor × otMultiplier.
 *            EPF 8% (employee), EPF 12% + ETF 3% (employer) on basic, each rounded half-up to 2 dp.
 * Net = gross − EPF employee − advance deduction − other deductions (never below 0).
 */

export interface CalcAttendance {
  /** "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatus;
  otHours: DecimalInput | null;
  projectId: string | null;
}

export interface CalcRate {
  /** "YYYY-MM-DD" */
  effectiveFrom: string;
  dailyRate?: DecimalInput | null;
  monthlySalary?: DecimalInput | null;
  otHourlyRate?: DecimalInput | null;
}

export interface CalcAdvance {
  id: string;
  /** "YYYY-MM-DD" — advances are recovered oldest first. */
  date: string;
  /** What is still owed. */
  balance: DecimalInput;
  /** Instalment per month; null = recover everything at once. */
  recoveryPerMonth: DecimalInput | null;
}

export interface PayrollCalcInput {
  worker: { type: WorkerType; joinedDate: string; leftDate: string | null };
  year: number;
  month: number;
  attendance: readonly CalcAttendance[];
  rates: readonly CalcRate[];
  settings: PayrollSettings;
  advances: readonly CalcAdvance[];
  otherDeductions?: DecimalInput | null;
  /** The advance deduction edited in a draft; default = the instalments due. */
  advanceDeduction?: DecimalInput | null;
}

export interface BreakdownEntry {
  projectId: string | null;
  days: Decimal;
  otHours: Decimal;
  cost: Decimal;
}

export interface AdvanceAllocation {
  advanceId: string;
  amount: Decimal;
}

export interface PayrollCalcResult {
  workerType: WorkerType;
  daysWorked: Decimal;
  halfDays: number;
  otHours: Decimal;
  noPayDays: Decimal;
  basicPay: Decimal;
  otPay: Decimal;
  grossPay: Decimal;
  epfEmployee: Decimal;
  epfEmployer: Decimal;
  etfEmployer: Decimal;
  advanceDeduction: Decimal;
  otherDeductions: Decimal;
  netPay: Decimal;
  /** What the advances could take this month (instalments due, before the net-pay cap). */
  advanceDue: Decimal;
  /** Σ open advance balances. */
  advanceBalance: Decimal;
  advanceAllocations: AdvanceAllocation[];
  /** Labour cost per project (DAILY: gross; PERMANENT: gross + EPF 12% + ETF 3%). */
  breakdown: BreakdownEntry[];
  /** A day had no pay rate (paid as 0). */
  missingRate: boolean;
}

const ZERO = new Decimal(0);

/** PRESENT = 1 day, HALF_DAY = 0.5, anything else 0. */
export function dayFraction(status: AttendanceStatus): Decimal {
  if (status === 'PRESENT') return new Decimal(1);
  if (status === 'HALF_DAY') return new Decimal(0.5);
  return ZERO;
}

/** value × pct / 100 rounded half-up to cents. */
function pctOf(value: Decimal, pct: DecimalInput): Decimal {
  return roundMoney(value.times(dec(pct)).dividedBy(100));
}

/** OT hourly rate of a daily-paid worker on a day. */
export function dailyOtRate(rate: CalcRate | null, settings: PayrollSettings): Decimal {
  if (!rate) return ZERO;
  if (rate.otHourlyRate !== null && rate.otHourlyRate !== undefined && rate.otHourlyRate !== '') {
    return dec(rate.otHourlyRate);
  }
  return dec(rate.dailyRate)
    .dividedBy(settings.dailyStandardHours)
    .times(dec(settings.otMultiplier));
}

/** OT hourly rate of a permanent worker. */
export function permanentOtRate(salary: DecimalInput, settings: PayrollSettings): Decimal {
  return dec(salary).dividedBy(settings.permanentOtDivisor).times(dec(settings.otMultiplier));
}

/** Mon–Sat days of [from, to] (inclusive). */
export function workingDaysBetween(from: string, to: string): number {
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to;) {
    if (weekdayOf(d.toISOString().slice(0, 10)) !== 0) n++;
    d = new Date(d.getTime() + 86_400_000);
  }
  return n;
}

/** Rounds every cost and puts the rounding difference on the biggest one, so Σ cost = total. */
function settleBreakdown(raw: BreakdownEntry[], total: Decimal): BreakdownEntry[] {
  const rows = raw.map((r) => ({ ...r, cost: roundMoney(r.cost) }));
  if (!rows.length) return rows;
  const diff = total.minus(sum(rows.map((r) => r.cost)));
  if (!diff.isZero()) {
    let big = rows[0]!;
    for (const r of rows) if (r.cost.gt(big.cost)) big = r;
    big.cost = big.cost.plus(diff);
  }
  return rows;
}

/** The instalment of one advance this month: recoveryPerMonth (or everything), capped at the balance. */
function instalment(a: CalcAdvance): Decimal {
  const balance = maxDecimal(dec(a.balance), 0);
  const per =
    a.recoveryPerMonth === null || a.recoveryPerMonth === '' ? null : dec(a.recoveryPerMonth);
  return per === null ? balance : minDecimal(per, balance);
}

/**
 * Splits `amount` over the open advances: first each advance's instalment (oldest first), then —
 * when more is deducted than the instalments — the rest of the balances, oldest first.
 */
export function allocateAdvanceDeduction(
  advances: readonly CalcAdvance[],
  amount: DecimalInput,
): AdvanceAllocation[] {
  let left = dec(amount);
  const taken = new Map<string, Decimal>();
  const sorted = [...advances].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const fill = (limit: (a: CalcAdvance) => Decimal) => {
    for (const a of sorted) {
      if (left.lte(0)) return;
      const already = taken.get(a.id) ?? ZERO;
      const take = minDecimal(left, maxDecimal(limit(a).minus(already), 0));
      if (take.gt(0)) {
        taken.set(a.id, already.plus(take));
        left = left.minus(take);
      }
    }
  };
  fill(instalment);
  fill((a) => maxDecimal(dec(a.balance), 0));
  return sorted
    .filter((a) => taken.has(a.id))
    .map((a) => ({ advanceId: a.id, amount: taken.get(a.id)! }));
}

/** The instalments due this month: per advance recoveryPerMonth (or all of it), capped at its balance. */
export function advanceInstalments(advances: readonly CalcAdvance[]): Decimal {
  return sum(advances.map(instalment));
}

export function calculatePayrollLine(input: PayrollCalcInput): PayrollCalcResult {
  const { worker, settings } = input;
  const month = `${input.year}-${String(input.month).padStart(2, '0')}`;
  const { from, to } = monthRange(month);
  const attendance = input.attendance.filter((a) => a.date >= from && a.date <= to);

  let daysWorked = ZERO;
  let halfDays = 0;
  let otHours = ZERO;
  let absentDays = 0;
  let missingRate = false;
  // projectId ('' = none) → raw days / OT / cost
  const perProject = new Map<string, { days: Decimal; otHours: Decimal; cost: Decimal }>();
  const bucket = (projectId: string | null) => {
    const key = projectId ?? '';
    let b = perProject.get(key);
    if (!b) {
      b = { days: ZERO, otHours: ZERO, cost: ZERO };
      perProject.set(key, b);
    }
    return b;
  };

  let rawBasic = ZERO;
  let rawOt = ZERO;
  for (const a of attendance) {
    const fraction = dayFraction(a.status);
    if (a.status === 'HALF_DAY') halfDays++;
    if (a.status === 'ABSENT') absentDays++;
    const ot = fraction.gt(0) ? dec(a.otHours) : ZERO;
    daysWorked = daysWorked.plus(fraction);
    otHours = otHours.plus(ot);
    if (fraction.isZero() && ot.isZero()) continue;
    const b = bucket(a.projectId);
    b.days = b.days.plus(fraction);
    b.otHours = b.otHours.plus(ot);
    if (worker.type === 'DAILY') {
      const rate = pickRateOn(input.rates, a.date);
      if (!rate || rate.dailyRate === null || rate.dailyRate === undefined) missingRate = true;
      const basic = fraction.times(dec(rate?.dailyRate));
      const otPay = ot.times(dailyOtRate(rate, settings));
      rawBasic = rawBasic.plus(basic);
      rawOt = rawOt.plus(otPay);
      b.cost = b.cost.plus(basic).plus(otPay);
    }
  }

  let basicPay: Decimal;
  let otPay: Decimal;
  let noPayDays = ZERO;
  let epfEmployee = ZERO;
  let epfEmployer = ZERO;
  let etfEmployer = ZERO;

  if (worker.type === 'DAILY') {
    basicPay = roundMoney(rawBasic);
    otPay = roundMoney(rawOt);
  } else {
    // Salary in force at the end of the month (or on the last day worked).
    const lastDay = worker.leftDate && worker.leftDate < to ? worker.leftDate : to;
    const rate = pickRateOn(input.rates, lastDay);
    const salary = dec(rate?.monthlySalary);
    if (!rate || rate.monthlySalary === null || rate.monthlySalary === undefined)
      missingRate = true;
    // Working days outside the employment period count as no-pay days.
    let outside = 0;
    if (worker.joinedDate > from) {
      const before = worker.joinedDate > to ? to : shiftBack(worker.joinedDate);
      outside += workingDaysBetween(from, before);
    }
    if (worker.leftDate && worker.leftDate < to) {
      const after = worker.leftDate < from ? from : shiftForward(worker.leftDate);
      outside += workingDaysBetween(after, to);
    }
    noPayDays = new Decimal(absentDays + outside);
    const perDay = salary.dividedBy(settings.workingDaysPerMonth);
    basicPay = maxDecimal(roundMoney(salary.minus(noPayDays.times(perDay))), 0);
    otPay = roundMoney(otHours.times(permanentOtRate(salary, settings)));
    epfEmployee = pctOf(basicPay, settings.epfEmployeePct);
    epfEmployer = pctOf(basicPay, settings.epfEmployerPct);
    etfEmployer = pctOf(basicPay, settings.etfEmployerPct);
  }

  const grossPay = basicPay.plus(otPay);

  // Labour cost per project.
  let breakdown: BreakdownEntry[];
  if (worker.type === 'DAILY') {
    breakdown = settleBreakdown(
      [...perProject.entries()].map(([k, v]) => ({ projectId: k || null, ...v })),
      grossPay,
    );
  } else {
    const employerCost = grossPay.plus(epfEmployer).plus(etfEmployer);
    const totalDays = sum([...perProject.values()].map((v) => v.days));
    if (totalDays.isZero()) {
      breakdown = employerCost.isZero()
        ? []
        : [{ projectId: null, days: ZERO, otHours, cost: employerCost }];
    } else {
      breakdown = settleBreakdown(
        [...perProject.entries()]
          .filter(([, v]) => v.days.gt(0))
          .map(([k, v]) => ({
            projectId: k || null,
            days: v.days,
            otHours: v.otHours,
            cost: employerCost.times(v.days).dividedBy(totalDays),
          })),
        employerCost,
      );
    }
  }

  // Deductions.
  const otherDeductions = roundMoney(dec(input.otherDeductions));
  const advanceBalance = sum(input.advances.map((a) => maxDecimal(dec(a.balance), 0)));
  const advanceDue = advanceInstalments(input.advances);
  const room = maxDecimal(grossPay.minus(epfEmployee).minus(otherDeductions), 0);
  const wanted =
    input.advanceDeduction === null || input.advanceDeduction === undefined
      ? advanceDue
      : minDecimal(dec(input.advanceDeduction), advanceBalance);
  const advanceDeduction = roundMoney(minDecimal(maxDecimal(wanted, 0), room));
  const netPay = maxDecimal(
    grossPay.minus(epfEmployee).minus(advanceDeduction).minus(otherDeductions),
    0,
  );

  return {
    workerType: worker.type,
    daysWorked: roundQty(daysWorked),
    halfDays,
    otHours: roundQty(otHours),
    noPayDays,
    basicPay,
    otPay,
    grossPay,
    epfEmployee,
    epfEmployer,
    etfEmployer,
    advanceDeduction,
    otherDeductions,
    netPay,
    advanceDue,
    advanceBalance,
    advanceAllocations: allocateAdvanceDeduction(input.advances, advanceDeduction),
    breakdown,
    missingRate,
  };
}

function shiftBack(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}
function shiftForward(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** True when the worker was employed on at least one day of the month. */
export function employedInMonth(
  worker: { joinedDate: string; leftDate: string | null },
  year: number,
  month: number,
): boolean {
  const { from, to } = monthRange(`${year}-${String(month).padStart(2, '0')}`);
  return worker.joinedDate <= to && (!worker.leftDate || worker.leftDate >= from);
}

/**
 * Estimated labour cost of one attendance day from the rates (used by costing before the month's
 * payroll is finalized). PERMANENT: salary / workingDaysPerMonth per day + EPF 12% + ETF 3%, plus OT.
 */
export function estimateDayCost(
  type: WorkerType,
  rates: readonly CalcRate[],
  a: Pick<CalcAttendance, 'date' | 'status' | 'otHours'>,
  settings: PayrollSettings,
): Decimal {
  const fraction = dayFraction(a.status);
  if (fraction.isZero()) return ZERO;
  const ot = dec(a.otHours);
  const rate = pickRateOn(rates, a.date);
  if (type === 'DAILY') {
    return fraction.times(dec(rate?.dailyRate)).plus(ot.times(dailyOtRate(rate, settings)));
  }
  const salary = dec(rate?.monthlySalary);
  const employerPct = dec(settings.epfEmployerPct).plus(dec(settings.etfEmployerPct));
  const basic = fraction.times(salary.dividedBy(settings.workingDaysPerMonth));
  return basic
    .times(employerPct.plus(100))
    .dividedBy(100)
    .plus(ot.times(permanentOtRate(salary, settings)));
}
