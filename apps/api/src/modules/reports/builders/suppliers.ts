import type { StatementDto, SupplierBalanceDto } from '@sc/shared';
import { dateLabel, rs, total, type BuildContext, type ReportDoc } from '../model.js';
import { enumLabel, named, periodFilter } from './common.js';

/** R8 — one supplier's statement (with running balance). */
export function buildSupplierStatement(s: StatementDto, { t }: BuildContext): ReportDoc {
  return {
    title: t('reports.list.supplier-statement.name'),
    subtitle: named(s.supplier.name, s.supplier.code),
    filters: [periodFilter(t, s.from, s.to)],
    landscape: false,
    filename: `supplier-statement_${s.supplier.code}${s.from ? `_${s.from}` : ''}${s.to ? `_${s.to}` : ''}`,
    sections: [
      {
        kind: 'keyValue',
        sheet: t('reports.suppliers.statement'),
        items: [
          { label: t('reports.suppliers.opening'), value: s.openingBalance, type: 'money' },
          { label: t('reports.suppliers.debit'), value: s.totalDebit, type: 'money' },
          { label: t('reports.suppliers.credit'), value: s.totalCredit, type: 'money' },
          {
            label: t('reports.suppliers.closing'),
            value: s.closingBalance,
            type: 'money',
            strong: true,
          },
        ],
      },
      {
        kind: 'table',
        columns: [
          { key: 'date', label: t('reports.common.date'), type: 'date' },
          { key: 'kind', label: t('reports.common.type'), type: 'text' },
          { key: 'description', label: t('reports.common.description'), type: 'text' },
          { key: 'reference', label: t('reports.common.reference'), type: 'text' },
          { key: 'debit', label: rs(t, t('reports.suppliers.debit')), type: 'money' },
          { key: 'credit', label: rs(t, t('reports.suppliers.credit')), type: 'money' },
          { key: 'balance', label: rs(t, t('reports.suppliers.balance')), type: 'money' },
        ],
        rows: s.entries.map((e) => ({
          date: e.date,
          kind: t(`reports.suppliers.kinds.${e.kind}`),
          description: e.method
            ? `${e.description} (${enumLabel(t, 'paymentMethod', e.method)})`
            : e.description,
          reference: e.reference,
          debit: e.debit,
          credit: e.credit,
          balance: e.balance,
        })),
        totals: {
          description: t('reports.common.total'),
          debit: s.totalDebit,
          credit: s.totalCredit,
          balance: s.closingBalance,
        },
      },
    ],
  };
}

/** R8 without a supplier — what we owe each supplier. */
export function buildSupplierBalances(
  rows: SupplierBalanceDto[],
  { t, today }: BuildContext,
): ReportDoc {
  return {
    title: t('reports.suppliers.balancesTitle'),
    filters: [{ label: t('reports.suppliers.asOf'), value: dateLabel(today) }],
    landscape: false,
    filename: `supplier-balances_${today}`,
    sections: [
      {
        kind: 'table',
        sheet: t('reports.suppliers.balances'),
        columns: [
          { key: 'code', label: t('reports.common.code'), type: 'text' },
          { key: 'name', label: t('reports.common.name'), type: 'text' },
          { key: 'credit', label: rs(t, t('reports.suppliers.creditBought')), type: 'money' },
          { key: 'paid', label: rs(t, t('reports.suppliers.paid')), type: 'money' },
          { key: 'balance', label: rs(t, t('reports.suppliers.owed')), type: 'money' },
        ],
        rows: rows.map((r) => ({
          code: r.code,
          name: r.name,
          credit: r.credit,
          paid: r.paid,
          balance: r.balance,
        })),
        totals: {
          name: t('reports.common.total'),
          credit: total(rows.map((r) => r.credit)),
          paid: total(rows.map((r) => r.paid)),
          balance: total(rows.map((r) => r.balance)),
        },
      },
    ],
  };
}
