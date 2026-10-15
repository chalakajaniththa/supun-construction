import { HEALTH_FLAG_THRESHOLD, type HealthFlag, type ProjectStatus } from '@sc/shared';
import { Decimal, type DecimalInput, dec } from '../../../common/money/money.js';
import { percent } from '../../boq/calc/progress.js';

/**
 * Project health (overview §7): three bars — time elapsed %, budget used %, physical progress % —
 * and the flags OVER_BUDGET (budget used > 100%), COST_AHEAD_OF_PROGRESS (budget used − physical
 * > 15 points) and BEHIND_SCHEDULE (time elapsed − physical > 15 points).
 */
export interface HealthInput {
  /** "YYYY-MM-DD" (Asia/Colombo). */
  today: string;
  status: ProjectStatus;
  startDate: string;
  /** revised end date, else planned end date */
  currentEndDate: string;
  budget: DecimalInput;
  actual: DecimalInput;
  /** BOQ physical progress % (null = the project has no BOQ). */
  boqPct: DecimalInput | null;
  /** Manual Project.progressPct (used when there is no BOQ). */
  manualPct: DecimalInput | null;
}

export interface HealthResult {
  timePct: Decimal;
  budgetPct: Decimal | null;
  physicalPct: Decimal;
  physicalSource: 'BOQ' | 'MANUAL' | 'NONE';
  flags: HealthFlag[];
}

const DAY_MS = 86_400_000;
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

/** today vs start → end, clamped 0–100 (a completed project is 100). */
export function timeElapsedPct(
  today: string,
  start: string,
  end: string,
  status?: ProjectStatus,
): Decimal {
  if (status === 'COMPLETED') return new Decimal(100);
  if (today <= start) return new Decimal(0);
  if (today >= end) return new Decimal(100);
  return percent(dayNumber(today) - dayNumber(start), dayNumber(end) - dayNumber(start));
}

export function projectHealth(input: HealthInput): HealthResult {
  const timePct = timeElapsedPct(input.today, input.startDate, input.currentEndDate, input.status);
  const budget = dec(input.budget);
  const budgetPct = budget.isZero() ? null : percent(input.actual, budget);
  const hasBoq = input.boqPct !== null && input.boqPct !== undefined;
  const hasManual =
    input.manualPct !== null && input.manualPct !== undefined && input.manualPct !== '';
  const physicalSource = hasBoq ? 'BOQ' : hasManual ? 'MANUAL' : 'NONE';
  const physicalPct = hasBoq
    ? dec(input.boqPct)
    : hasManual
      ? dec(input.manualPct)
      : new Decimal(0);

  const flags: HealthFlag[] = [];
  if (budgetPct && budgetPct.gt(100)) flags.push('OVER_BUDGET');
  if (budgetPct && budgetPct.minus(physicalPct).gt(HEALTH_FLAG_THRESHOLD)) {
    flags.push('COST_AHEAD_OF_PROGRESS');
  }
  if (input.status !== 'COMPLETED' && timePct.minus(physicalPct).gt(HEALTH_FLAG_THRESHOLD)) {
    flags.push('BEHIND_SCHEDULE');
  }
  return { timePct, budgetPct, physicalPct, physicalSource, flags };
}
