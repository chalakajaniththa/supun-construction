import { describe, expect, it } from 'vitest';
import { type LedgerItem, buildStatement, supplierBalance } from './balance.js';

const item = (
  kind: LedgerItem['kind'],
  date: string,
  amount: string,
  createdAt = '2026-10-01T00:00:00Z',
): LedgerItem => ({
  kind,
  id: `${kind}-${date}-${amount}`,
  date,
  createdAt: new Date(createdAt),
  description: kind,
  reference: null,
  amount,
});

describe('supplierBalance', () => {
  it.each([
    [['100000.00', '50000.50'], ['2500'], ['60000'], '92500.5'],
    [[], [], [], '0'],
    [['1000'], [], ['1500'], '-500'],
  ])('%j + %j − %j = %s', (purchases, expenses, payments, expected) => {
    expect(supplierBalance(purchases, expenses, payments).toString()).toBe(expected);
  });
});

describe('buildStatement', () => {
  const items = [
    item('PAYMENT', '2026-09-20', '30000'),
    item('PURCHASE', '2026-09-01', '100000'),
    item('EXPENSE', '2026-10-02', '4500.50'),
    item('PURCHASE', '2026-10-02', '20000'),
    item('PAYMENT', '2026-10-02', '50000'),
    item('PURCHASE', '2026-10-20', '10000'),
  ];

  it('orders by date (purchase, expense, then payment on the same day) with a running balance', () => {
    const s = buildStatement(items);
    expect(s.rows.map((r) => [r.kind, r.balance.toString()])).toEqual([
      ['PURCHASE', '100000'],
      ['PAYMENT', '70000'],
      ['PURCHASE', '90000'],
      ['EXPENSE', '94500.5'],
      ['PAYMENT', '44500.5'],
      ['PURCHASE', '54500.5'],
    ]);
    expect(s.openingBalance.toString()).toBe('0');
    expect(s.totalDebit.toString()).toBe('134500.5');
    expect(s.totalCredit.toString()).toBe('80000');
    expect(s.closingBalance.toString()).toBe('54500.5');
  });

  it('turns earlier items into the opening balance and drops later ones', () => {
    const s = buildStatement(items, '2026-10-01', '2026-10-10');
    expect(s.openingBalance.toString()).toBe('70000');
    expect(s.rows).toHaveLength(3);
    expect(s.closingBalance.toString()).toBe('44500.5');
  });

  it('uses createdAt as the tie-breaker within a day and kind', () => {
    const s = buildStatement([
      item('PURCHASE', '2026-10-02', '2', '2026-10-02T10:00:00Z'),
      item('PURCHASE', '2026-10-02', '1', '2026-10-02T09:00:00Z'),
    ]);
    expect(s.rows.map((r) => r.debit.toString())).toEqual(['1', '2']);
  });
});
