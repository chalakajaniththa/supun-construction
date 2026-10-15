import {
  BUDGET_CATEGORIES,
  type AttendanceStatus,
  type BudgetCategory,
  type CostEntryKind,
  type ExpenseCategory,
  type PayrollSettings,
  type WorkerType,
} from '@sc/shared';
import {
  Decimal,
  type DecimalInput,
  dec,
  roundMoney,
  roundQty,
  sum,
} from '../../../common/money/money.js';
import {
  type CalcRate,
  dayFraction,
  estimateDayCost,
} from '../../payroll/calc/payroll.calculator.js';
import { percent } from '../../boq/calc/progress.js';

/**
 * Project actual cost by budget category (overview §7), for any date range:
 * - LABOUR: per worker. Months whose payroll is FINALIZED use the payroll line's project cost
 *   (spread evenly over that project's days of the month); other days are estimated from the
 *   rates (`estimated: true`).
 * - MATERIALS: purchase lines delivered to the project + store issues (qty × issue unit cost).
 * - EQUIPMENT: usage hours × internal hourly rate (or one day × daily rate when there is no hourly
 *   rate) + fuel cost on usage logs + EQUIPMENT_HIRE / FUEL / REPAIRS expenses.
 * - SUBCONTRACT / OVERHEAD / OTHER: expenses, by EXPENSE_TO_BUDGET.
 */

/** Which budget category an expense counts in. */
export const EXPENSE_TO_BUDGET: Record<ExpenseCategory, BudgetCategory> = {
  FUEL: 'EQUIPMENT',
  EQUIPMENT_HIRE: 'EQUIPMENT',
  REPAIRS: 'EQUIPMENT',
  SUBCONTRACT: 'SUBCONTRACT',
  UTILITIES: 'OVERHEAD',
  OFFICE: 'OVERHEAD',
  PERMITS_FEES: 'OVERHEAD',
  TRANSPORT: 'OTHER',
  MEALS: 'OTHER',
  SMALL_TOOLS: 'OTHER',
  OTHER: 'OTHER',
};

export interface LabourDay {
  date: string;
  status: AttendanceStatus;
  otHours: DecimalInput | null;
}

/** A finalized payroll line's share for this project in one month. */
export interface FinalizedShare {
  /** "YYYY-MM" */
  month: string;
  days: DecimalInput;
  cost: DecimalInput;
}

export interface LabourWorker {
  workerId: string;
  code: string;
  name: string;
  type: WorkerType;
  rates: readonly CalcRate[];
  /** Attendance on this project inside the range. */
  days: readonly LabourDay[];
  finalized: readonly FinalizedShare[];
}

export interface CostEntry {
  kind: CostEntryKind;
  date: string | null;
  description: string;
  reference: string | null;
  quantity: string | null;
  unit: string | null;
  amount: Decimal;
  estimated: boolean;
  refId: string | null;
}

export interface CostingInput {
  budget: Partial<Record<BudgetCategory, DecimalInput>>;
  settings: PayrollSettings;
  labour: readonly LabourWorker[];
  purchases: readonly {
    date: string;
    material: string;
    unit: string;
    quantity: DecimalInput;
    amount: DecimalInput;
    reference: string | null;
    refId: string;
  }[];
  issues: readonly {
    date: string;
    material: string;
    unit: string;
    quantity: DecimalInput;
    unitCost: DecimalInput;
    refId: string;
  }[];
  usage: readonly {
    date: string;
    assetId: string;
    assetCode: string;
    assetName: string;
    hoursUsed: DecimalInput;
    ratePerHour: DecimalInput | null;
    ratePerDay: DecimalInput | null;
    fuelLitres: DecimalInput | null;
    fuelCost: DecimalInput | null;
  }[];
  expenses: readonly {
    id: string;
    date: string;
    category: ExpenseCategory;
    description: string;
    amount: DecimalInput;
    supplier: string | null;
  }[];
}

export interface CategoryCost {
  category: BudgetCategory;
  budget: Decimal;
  actual: Decimal;
  variance: Decimal;
  pct: Decimal | null;
  estimated: boolean;
  entries: CostEntry[];
}

export interface CostingResult {
  byCategory: CategoryCost[];
  total: { budget: Decimal; actual: Decimal; variance: Decimal; pct: Decimal | null };
  estimated: boolean;
}

const present = (v: DecimalInput | null | undefined) => v !== null && v !== undefined && v !== '';

/** Labour cost of one worker on one project (an entry per worker). */
export function labourEntry(w: LabourWorker, settings: PayrollSettings): CostEntry | null {
  const finalized = new Map(w.finalized.map((f) => [f.month, f]));
  let amount = new Decimal(0);
  let days = new Decimal(0);
  let estimated = false;
  for (const d of w.days) {
    const fraction = dayFraction(d.status);
    if (fraction.isZero()) continue;
    days = days.plus(fraction);
    const share = finalized.get(d.date.slice(0, 7));
    if (share && dec(share.days).gt(0)) {
      amount = amount.plus(dec(share.cost).times(fraction).dividedBy(dec(share.days)));
    } else {
      estimated = true;
      amount = amount.plus(estimateDayCost(w.type, w.rates, d, settings));
    }
  }
  if (days.isZero()) return null;
  return {
    kind: 'LABOUR',
    date: null,
    description: w.name,
    reference: w.code,
    quantity: roundQty(days).toString(),
    unit: 'days',
    amount: roundMoney(amount),
    estimated,
    refId: w.workerId,
  };
}

export function calculateCosts(input: CostingInput): CostingResult {
  const entries = new Map<BudgetCategory, CostEntry[]>(BUDGET_CATEGORIES.map((c) => [c, []]));
  const add = (c: BudgetCategory, e: CostEntry) => entries.get(c)!.push(e);

  for (const w of input.labour) {
    const e = labourEntry(w, input.settings);
    if (e) add('LABOUR', e);
  }
  for (const p of input.purchases) {
    add('MATERIALS', {
      kind: 'PURCHASE',
      date: p.date,
      description: p.material,
      reference: p.reference,
      quantity: roundQty(dec(p.quantity)).toString(),
      unit: p.unit,
      amount: roundMoney(dec(p.amount)),
      estimated: false,
      refId: p.refId,
    });
  }
  for (const i of input.issues) {
    add('MATERIALS', {
      kind: 'ISSUE',
      date: i.date,
      description: i.material,
      reference: null,
      quantity: roundQty(dec(i.quantity)).toString(),
      unit: i.unit,
      amount: roundMoney(dec(i.quantity).times(dec(i.unitCost))),
      estimated: false,
      refId: i.refId,
    });
  }
  for (const u of input.usage) {
    const hourly = present(u.ratePerHour);
    const daily = !hourly && present(u.ratePerDay);
    const amount = hourly
      ? roundMoney(dec(u.hoursUsed).times(dec(u.ratePerHour)))
      : daily
        ? roundMoney(dec(u.ratePerDay))
        : new Decimal(0);
    add('EQUIPMENT', {
      kind: 'MACHINE',
      date: u.date,
      description: u.assetName,
      reference: u.assetCode,
      quantity: hourly || !daily ? roundQty(dec(u.hoursUsed)).toString() : '1',
      unit: hourly || !daily ? 'h' : 'day',
      amount,
      estimated: false,
      refId: u.assetId,
    });
    if (present(u.fuelCost) && dec(u.fuelCost).gt(0)) {
      add('EQUIPMENT', {
        kind: 'FUEL',
        date: u.date,
        description: u.assetName,
        reference: u.assetCode,
        quantity: present(u.fuelLitres) ? roundQty(dec(u.fuelLitres)).toString() : null,
        unit: present(u.fuelLitres) ? 'l' : null,
        amount: roundMoney(dec(u.fuelCost)),
        estimated: false,
        refId: u.assetId,
      });
    }
  }
  for (const x of input.expenses) {
    add(EXPENSE_TO_BUDGET[x.category], {
      kind: 'EXPENSE',
      date: x.date,
      description: x.description,
      reference: x.supplier,
      quantity: null,
      unit: x.category,
      amount: roundMoney(dec(x.amount)),
      estimated: false,
      refId: x.id,
    });
  }

  const byCategory: CategoryCost[] = BUDGET_CATEGORIES.map((category) => {
    const list = entries.get(category)!;
    if (category === 'LABOUR') list.sort((a, b) => b.amount.comparedTo(a.amount));
    else list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    const budget = roundMoney(dec(input.budget[category]));
    const actual = sum(list.map((e) => e.amount));
    return {
      category,
      budget,
      actual,
      variance: budget.minus(actual),
      pct: budget.isZero() ? null : percent(actual, budget),
      estimated: list.some((e) => e.estimated),
      entries: list,
    };
  });
  const budget = sum(byCategory.map((c) => c.budget));
  const actual = sum(byCategory.map((c) => c.actual));
  return {
    byCategory,
    total: {
      budget,
      actual,
      variance: budget.minus(actual),
      pct: budget.isZero() ? null : percent(actual, budget),
    },
    estimated: byCategory.some((c) => c.estimated),
  };
}
