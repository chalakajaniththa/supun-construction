import { sum } from '../../../common/money/money.js';
import { rs, total, type BuildContext, type ReportDoc } from '../model.js';
import { enumLabel, monthFilter } from './common.js';

export interface BusinessSummaryInput {
  month: string;
  projects: {
    code: string;
    name: string;
    status: string;
    /** actual cost in the month (CostingService) */
    spent: string;
    /** client payments in the month */
    received: string;
    receivable: string;
    retentionHeld: string;
  }[];
  /** expenses without a project in the month */
  overheadExpenses: string;
  payments: { kind: string; amount: string }[];
}

/** R11 — the month at a glance: money in, money out, per project, receivables, retention held. */
export function buildBusinessSummary(input: BusinessSummaryInput, { t }: BuildContext): ReportDoc {
  const received = total(input.payments.map((p) => p.amount));
  const spentProjects = total(input.projects.map((p) => p.spent));
  const spent = sum([spentProjects, input.overheadExpenses]).toFixed(2);
  const kinds = [...new Set(input.payments.map((p) => p.kind))].sort();
  const active = input.projects.filter(
    (p) => !sum([p.spent, p.received, p.receivable, p.retentionHeld]).isZero(),
  );
  return {
    title: t('reports.list.business-summary.name'),
    subtitle: monthFilter(t, input.month).value,
    filters: [],
    landscape: false,
    filename: `business-summary_${input.month}`,
    sections: [
      {
        kind: 'keyValue',
        title: t('reports.summary.atAGlance'),
        sheet: t('reports.summary.sheet'),
        items: [
          { label: t('reports.summary.received'), value: received, type: 'money', strong: true },
          ...kinds.map((k) => ({
            label: `  ${enumLabel(t, 'clientPaymentKind', k)}`,
            value: total(input.payments.filter((p) => p.kind === k).map((p) => p.amount)),
            type: 'money' as const,
          })),
          { label: t('reports.summary.spent'), value: spent, type: 'money', strong: true },
          { label: `  ${t('reports.summary.onProjects')}`, value: spentProjects, type: 'money' },
          {
            label: `  ${t('reports.summary.overhead')}`,
            value: input.overheadExpenses,
            type: 'money',
          },
          {
            label: t('reports.summary.receivable'),
            value: total(input.projects.map((p) => p.receivable)),
            type: 'money',
            strong: true,
          },
          {
            label: t('reports.summary.retentionHeld'),
            value: total(input.projects.map((p) => p.retentionHeld)),
            type: 'money',
            strong: true,
          },
        ],
      },
      {
        kind: 'table',
        title: t('reports.summary.perProject'),
        columns: [
          { key: 'code', label: t('reports.common.code'), type: 'text' },
          { key: 'name', label: t('reports.common.project'), type: 'text' },
          { key: 'status', label: t('reports.common.status'), type: 'text' },
          { key: 'spent', label: rs(t, t('reports.summary.spentMonth')), type: 'money' },
          { key: 'received', label: rs(t, t('reports.summary.receivedMonth')), type: 'money' },
          { key: 'receivable', label: rs(t, t('reports.summary.receivable')), type: 'money' },
          { key: 'retention', label: rs(t, t('reports.summary.retentionHeld')), type: 'money' },
        ],
        rows: active.map((p) => ({
          code: p.code,
          name: p.name,
          status: enumLabel(t, 'projectStatus', p.status),
          spent: p.spent,
          received: p.received,
          receivable: p.receivable,
          retention: p.retentionHeld,
        })),
        totals: {
          name: t('reports.common.total'),
          spent: total(active.map((p) => p.spent)),
          received: total(active.map((p) => p.received)),
          receivable: total(active.map((p) => p.receivable)),
          retention: total(active.map((p) => p.retentionHeld)),
        },
      },
    ],
  };
}
