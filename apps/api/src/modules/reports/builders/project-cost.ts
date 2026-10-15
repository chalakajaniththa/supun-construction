import type { BudgetCategory, CostCategoryDto, CostEntryDto } from '@sc/shared';
import { filePart, rs, total, type BuildContext, type ReportDoc, type Section } from '../model.js';
import { enumLabel, named, periodFilter } from './common.js';

export interface ProjectCostInput {
  project: { code: string; name: string; clientName: string | null };
  from?: string;
  to?: string;
  costs: {
    byCategory: (Omit<CostCategoryDto, 'count'> & { entries: CostEntryDto[] })[];
    total: { budget: string; actual: string; variance: string; pct: string | null };
    estimated: boolean;
  };
}

/** R1 — budget vs actual by category, then the entries behind each category. */
export function buildProjectCost(input: ProjectCostInput, { t, today }: BuildContext): ReportDoc {
  const { project, costs } = input;
  const cat = (c: BudgetCategory) => enumLabel(t, 'budgetCategory', c);
  const unit = (e: CostEntryDto) => {
    if (!e.unit) return '';
    if (e.kind === 'EXPENSE') return '';
    if (['days', 'h', 'day', 'l'].includes(e.unit)) return t(`costs.units.${e.unit}`);
    return e.unit;
  };
  const kind = (e: CostEntryDto) =>
    e.kind === 'EXPENSE' && e.unit
      ? enumLabel(t, 'expenseCategory', e.unit)
      : t(`costs.kinds.${e.kind}`);

  const sections: Section[] = [
    {
      kind: 'table',
      title: t('reports.projectCost.summary'),
      sheet: t('reports.projectCost.summary'),
      note: costs.estimated ? t('reports.projectCost.estimatedNote') : undefined,
      columns: [
        { key: 'category', label: t('reports.common.category'), type: 'text' },
        { key: 'budget', label: rs(t, t('reports.projectCost.budget')), type: 'money' },
        { key: 'actual', label: rs(t, t('reports.projectCost.actual')), type: 'money' },
        { key: 'variance', label: rs(t, t('reports.projectCost.variance')), type: 'money' },
        { key: 'pct', label: t('reports.projectCost.used'), type: 'pct' },
      ],
      rows: costs.byCategory.map((c) => ({
        category: c.estimated ? `${cat(c.category)} *` : cat(c.category),
        budget: c.budget,
        actual: c.actual,
        variance: c.variance,
        pct: c.pct,
      })),
      totals: {
        category: t('reports.common.total'),
        budget: costs.total.budget,
        actual: costs.total.actual,
        variance: costs.total.variance,
        pct: costs.total.pct,
      },
    },
  ];
  for (const c of costs.byCategory) {
    if (!c.entries.length) continue;
    sections.push({
      kind: 'table',
      title: cat(c.category),
      sheet: cat(c.category),
      columns: [
        { key: 'date', label: t('reports.common.date'), type: 'date' },
        { key: 'kind', label: t('reports.common.type'), type: 'text' },
        { key: 'description', label: t('reports.common.description'), type: 'text' },
        { key: 'reference', label: t('reports.common.reference'), type: 'text' },
        { key: 'quantity', label: t('reports.common.quantity'), type: 'qty' },
        { key: 'unit', label: t('reports.common.unit'), type: 'text' },
        { key: 'amount', label: rs(t, t('reports.common.amount')), type: 'money' },
      ],
      rows: c.entries.map((e) => ({
        date: e.date,
        kind: kind(e),
        description: e.estimated ? `${e.description} *` : e.description,
        reference: e.reference,
        quantity: e.quantity,
        unit: unit(e),
        amount: e.amount,
      })),
      totals: {
        description: t('reports.common.total'),
        amount: total(c.entries.map((e) => e.amount)),
      },
    });
  }
  const range =
    input.from || input.to ? `${input.from ?? ''}_${input.to ?? ''}` : today.slice(0, 7);
  return {
    title: t('reports.list.project-cost.name'),
    subtitle: named(project.name, project.code),
    filters: [
      ...(project.clientName
        ? [{ label: t('reports.common.client'), value: project.clientName }]
        : []),
      periodFilter(t, input.from, input.to),
    ],
    sections,
    landscape: false,
    filename: `project-cost_${filePart(project.code)}_${filePart(range)}`,
  };
}
