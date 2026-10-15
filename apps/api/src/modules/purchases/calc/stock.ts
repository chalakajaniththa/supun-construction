import {
  type Decimal,
  type DecimalInput,
  dec,
  roundMoney,
  sum,
} from '../../../common/money/money.js';

/** Line amount = quantity × unit price, rounded to cents. */
export function lineAmount(quantity: DecimalInput, unitPrice: DecimalInput): Decimal {
  return roundMoney(dec(quantity).times(dec(unitPrice)));
}

/**
 * Weighted average cost of store purchases (overview §7): Σ amount / Σ quantity, rounded to
 * cents. 0 when nothing was bought.
 */
export function weightedAverageCost(
  lines: readonly { quantity: DecimalInput; amount: DecimalInput }[],
): Decimal {
  const qty = sum(lines.map((l) => l.quantity));
  if (qty.lte(0)) return dec(0);
  return roundMoney(sum(lines.map((l) => l.amount)).dividedBy(qty));
}

/** Store stock = Σ store purchases − Σ issues. */
export function stockLevel(purchasedQty: DecimalInput, issuedQty: DecimalInput): Decimal {
  return dec(purchasedQty).minus(dec(issuedQty));
}

/** Stock row for one material: quantities, average cost and stock value. */
export function stockRow(input: {
  purchasedQty: DecimalInput;
  purchasedAmount: DecimalInput;
  issuedQty: DecimalInput;
}): { stock: Decimal; averageCost: Decimal; value: Decimal } {
  const stock = stockLevel(input.purchasedQty, input.issuedQty);
  const averageCost = weightedAverageCost([
    { quantity: input.purchasedQty, amount: input.purchasedAmount },
  ]);
  return { stock, averageCost, value: roundMoney(stock.times(averageCost)) };
}
