import {
  Decimal,
  type DecimalInput,
  dec,
  roundMoney,
  roundQty,
  sum,
} from '../../../common/money/money.js';

/**
 * BOQ progress (overview §7): physical progress % = Σ(done qty × rate) / Σ(BOQ qty × rate), where
 * "done" is the latest cumulative measurement on or before the as-of date. Items of a variation
 * that is not APPROVED are listed but not counted.
 */

export interface MeasurementLike {
  /** "YYYY-MM-DD" */
  date: string;
  cumulativeQty: DecimalInput;
}

export interface BoqItemLike {
  id: string;
  itemNo: string;
  description: string;
  unit: string;
  quantity: DecimalInput;
  rate: DecimalInput;
  /** Belongs to a variation that is not approved (yet). */
  excluded?: boolean;
  measurements: readonly MeasurementLike[];
}

export interface ItemProgress {
  boqItemId: string;
  itemNo: string;
  description: string;
  unit: string;
  quantity: Decimal;
  rate: Decimal;
  amount: Decimal;
  done: Decimal;
  pct: Decimal;
  amountDone: Decimal;
  lastMeasuredOn: string | null;
  excluded: boolean;
}

export interface ProgressResult {
  items: ItemProgress[];
  totalAmount: Decimal;
  totalDone: Decimal;
  physicalPct: Decimal;
}

/** quantity × rate rounded to cents. */
export function itemAmount(quantity: DecimalInput, rate: DecimalInput): Decimal {
  return roundMoney(dec(quantity).times(dec(rate)));
}

/** The latest measurement on or before `asOf`, or null. */
export function latestMeasurement<T extends MeasurementLike>(
  measurements: readonly T[],
  asOf: string,
): T | null {
  let best: T | null = null;
  for (const m of measurements) {
    if (m.date <= asOf && (!best || m.date > best.date)) best = m;
  }
  return best;
}

/** a / b × 100 rounded to 2 dp (0 when b is 0). */
export function percent(a: DecimalInput, b: DecimalInput): Decimal {
  const bottom = dec(b);
  if (bottom.isZero()) return new Decimal(0);
  return dec(a).times(100).dividedBy(bottom).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function calculateProgress(items: readonly BoqItemLike[], asOf: string): ProgressResult {
  const rows: ItemProgress[] = items.map((it) => {
    const last = latestMeasurement(it.measurements, asOf);
    const quantity = dec(it.quantity);
    const rate = dec(it.rate);
    const done = roundQty(dec(last?.cumulativeQty));
    return {
      boqItemId: it.id,
      itemNo: it.itemNo,
      description: it.description,
      unit: it.unit,
      quantity,
      rate,
      amount: itemAmount(quantity, rate),
      done,
      pct: percent(done, quantity),
      amountDone: itemAmount(done, rate),
      lastMeasuredOn: last?.date ?? null,
      excluded: Boolean(it.excluded),
    };
  });
  const counted = rows.filter((r) => !r.excluded);
  const totalAmount = sum(counted.map((r) => r.amount));
  const totalDone = sum(counted.map((r) => r.amountDone));
  return { items: rows, totalAmount, totalDone, physicalPct: percent(totalDone, totalAmount) };
}

/** Σ(latest measurement ≤ asOf × rate) — the default cumulative work done of a bill. */
export function measuredWorkDone(items: readonly BoqItemLike[], asOf: string): Decimal {
  return calculateProgress(items, asOf).totalDone;
}

export type MeasurementProblem = 'OUT_OF_ORDER' | null;

/**
 * Checks a new cumulative measurement against the item's other measurements: it may not be
 * below an earlier one or above a later one (progress cannot go backwards in date order).
 * A measurement on the same date is replaced, so it is ignored here.
 */
export function checkMeasurement(
  existing: readonly MeasurementLike[],
  date: string,
  cumulativeQty: DecimalInput,
): MeasurementProblem {
  const qty = dec(cumulativeQty);
  for (const m of existing) {
    if (m.date < date && dec(m.cumulativeQty).gt(qty)) return 'OUT_OF_ORDER';
    if (m.date > date && dec(m.cumulativeQty).lt(qty)) return 'OUT_OF_ORDER';
  }
  return null;
}

/** OVER_QUANTITY when the cumulative quantity is above the BOQ quantity. */
export function measurementWarnings(
  quantity: DecimalInput,
  cumulativeQty: DecimalInput,
): 'OVER_QUANTITY'[] {
  return dec(cumulativeQty).gt(dec(quantity)) ? ['OVER_QUANTITY'] : [];
}
