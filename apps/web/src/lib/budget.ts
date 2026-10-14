import { isMoneyString } from '@sc/shared';
import { Decimal } from 'decimal.js';

/** Exact total of typed money amounts (decimal.js, never floats). Blank / invalid values are skipped. */
export function budgetSum(amounts: string[]): string {
  return amounts
    .filter((a) => a !== '' && isMoneyString(a))
    .reduce((acc, a) => acc.plus(a), new Decimal(0))
    .toFixed(2);
}
