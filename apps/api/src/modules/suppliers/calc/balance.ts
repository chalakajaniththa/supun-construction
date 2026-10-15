import type { StatementEntryKind } from '@sc/shared';
import { type Decimal, type DecimalInput, dec, sum } from '../../../common/money/money.js';

/**
 * Supplier balance (overview §7): Σ CREDIT purchases + Σ CREDIT expenses − Σ payments.
 * Positive = we owe the supplier.
 */
export function supplierBalance(
  creditPurchases: readonly DecimalInput[],
  creditExpenses: readonly DecimalInput[],
  payments: readonly DecimalInput[],
): Decimal {
  return sum(creditPurchases).plus(sum(creditExpenses)).minus(sum(payments));
}

export interface LedgerItem {
  kind: StatementEntryKind;
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Tie-breaker inside a day. */
  createdAt: Date;
  description: string;
  reference: string | null;
  amount: DecimalInput;
  method?: string;
}

const KIND_ORDER: Record<StatementEntryKind, number> = { PURCHASE: 0, EXPENSE: 1, PAYMENT: 2 };

export interface StatementRow extends Omit<LedgerItem, 'amount' | 'createdAt'> {
  debit: Decimal;
  credit: Decimal;
  balance: Decimal;
}

/**
 * Chronological statement with a running balance. Items before `from` make up the opening
 * balance; items after `to` are left out. Purchases / expenses are debits (owed more), payments
 * credits.
 */
export function buildStatement(
  items: readonly LedgerItem[],
  from?: string | null,
  to?: string | null,
): {
  openingBalance: Decimal;
  rows: StatementRow[];
  totalDebit: Decimal;
  totalCredit: Decimal;
  closingBalance: Decimal;
} {
  const sorted = [...items].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const signed = (i: LedgerItem) => (i.kind === 'PAYMENT' ? dec(i.amount).neg() : dec(i.amount));
  let balance = dec(0);
  for (const i of sorted) if (from && i.date < from) balance = balance.plus(signed(i));
  const openingBalance = balance;
  const rows: StatementRow[] = [];
  let totalDebit = dec(0);
  let totalCredit = dec(0);
  for (const i of sorted) {
    if ((from && i.date < from) || (to && i.date > to)) continue;
    const debit = i.kind === 'PAYMENT' ? dec(0) : dec(i.amount);
    const credit = i.kind === 'PAYMENT' ? dec(i.amount) : dec(0);
    balance = balance.plus(debit).minus(credit);
    totalDebit = totalDebit.plus(debit);
    totalCredit = totalCredit.plus(credit);
    rows.push({
      kind: i.kind,
      id: i.id,
      date: i.date,
      description: i.description,
      reference: i.reference,
      method: i.method,
      debit,
      credit,
      balance,
    });
  }
  return { openingBalance, rows, totalDebit, totalCredit, closingBalance: balance };
}
