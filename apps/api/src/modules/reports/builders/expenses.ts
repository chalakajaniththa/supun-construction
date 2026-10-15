import type { ExpenseCategory } from '@sc/shared';
import { rs, total, type BuildContext, type ReportDoc } from '../model.js';
import { enumLabel, named, periodFilter } from './common.js';

export interface ExpenseReportRow {
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  paidBy: string;
  project: { code: string; name: string } | null;
  asset: { code: string; name: string } | null;
  supplier: { name: string } | null;
}

export interface ExpensesReportInput {
  from: string;
  to: string;
  project: { code: string; name: string } | null;
  category: ExpenseCategory | null;
  expenses: ExpenseReportRow[];
}

function groupTotals<K extends string>(rows: ExpenseReportRow[], key: (r: ExpenseReportRow) => K) {
  const m = new Map<K, { count: number; amounts: string[] }>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k) ?? { count: 0, amounts: [] };
    g.count++;
    g.amounts.push(r.amount);
    m.set(k, g);
  }
  return [...m.entries()].map(([k, g]) => ({ key: k, count: g.count, amount: total(g.amounts) }));
}

/** R7 — expenses in a date range: by category, by project and the full list. */
export function buildExpenses(input: ExpensesReportInput, { t }: BuildContext): ReportDoc {
  const rows = input.expenses;
  const byCategory = groupTotals(rows, (r) => r.category).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  const noProject = t('reports.common.noProject');
  const byProject = groupTotals(rows, (r) =>
    r.project ? named(r.project.name, r.project.code) : noProject,
  );
  const all = total(rows.map((r) => r.amount));
  return {
    title: t('reports.list.expenses.name'),
    filters: [
      periodFilter(t, input.from, input.to),
      {
        label: t('reports.common.project'),
        value: input.project
          ? named(input.project.name, input.project.code)
          : t('reports.common.allProjects'),
      },
      ...(input.category
        ? [
            {
              label: t('reports.common.category'),
              value: enumLabel(t, 'expenseCategory', input.category),
            },
          ]
        : []),
    ],
    landscape: false,
    filename: `expenses_${input.from}_${input.to}${input.project ? `_${input.project.code}` : ''}`,
    sections: [
      {
        kind: 'table',
        title: t('reports.expenses.byCategory'),
        sheet: t('reports.expenses.summary'),
        columns: [
          { key: 'category', label: t('reports.common.category'), type: 'text' },
          { key: 'count', label: t('reports.common.count'), type: 'int' },
          { key: 'amount', label: rs(t, t('reports.common.amount')), type: 'money' },
        ],
        rows: byCategory.map((g) => ({
          category: enumLabel(t, 'expenseCategory', g.key),
          count: g.count,
          amount: g.amount,
        })),
        totals: { category: t('reports.common.total'), count: rows.length, amount: all },
      },
      {
        kind: 'table',
        title: t('reports.expenses.byProject'),
        columns: [
          { key: 'project', label: t('reports.common.project'), type: 'text' },
          { key: 'count', label: t('reports.common.count'), type: 'int' },
          { key: 'amount', label: rs(t, t('reports.common.amount')), type: 'money' },
        ],
        rows: byProject.map((g) => ({ project: g.key, count: g.count, amount: g.amount })),
        totals: { project: t('reports.common.total'), count: rows.length, amount: all },
      },
      {
        kind: 'table',
        title: t('reports.expenses.list'),
        sheet: t('reports.expenses.list'),
        columns: [
          { key: 'date', label: t('reports.common.date'), type: 'date' },
          { key: 'category', label: t('reports.common.category'), type: 'text' },
          { key: 'description', label: t('reports.common.description'), type: 'text' },
          { key: 'project', label: t('reports.common.project'), type: 'text' },
          { key: 'paidBy', label: t('reports.expenses.paidBy'), type: 'text' },
          { key: 'supplier', label: t('reports.common.supplier'), type: 'text' },
          { key: 'amount', label: rs(t, t('reports.common.amount')), type: 'money' },
        ],
        rows: rows.map((r) => ({
          date: r.date,
          category: enumLabel(t, 'expenseCategory', r.category),
          description: r.asset
            ? `${r.description} — ${named(r.asset.name, r.asset.code)}`
            : r.description,
          project: r.project ? r.project.code : '',
          paidBy: enumLabel(t, 'expensePaidBy', r.paidBy),
          supplier: r.supplier?.name ?? '',
          amount: r.amount,
        })),
        totals: { description: t('reports.common.total'), amount: all },
      },
    ],
  };
}
