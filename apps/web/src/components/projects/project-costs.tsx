'use client';

import {
  BUDGET_CATEGORIES,
  type BudgetCategory,
  type CostEntryDto,
  type ProjectCostsDto,
} from '@sc/shared';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ExpensesList } from '@/components/daily/expenses-list';
import { DateInput } from '@/components/forms/date-input';
import { useEnumLabel } from '@/components/forms/enum-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApi } from '@/hooks/use-resource';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EstimatedTag } from './project-health';

const PAGE_SIZE = 20;

function entryHref(e: CostEntryDto): string | null {
  if (!e.refId) return null;
  if (e.kind === 'LABOUR') return `/workers/${e.refId}`;
  if (e.kind === 'MACHINE' || e.kind === 'FUEL') return `/assets/${e.refId}`;
  return null;
}

/** Costs tab: totals per budget category for a date range, and the entries behind each total. */
export function ProjectCosts({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const t = useTranslations('costs');
  const enumLabel = useEnumLabel();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState<BudgetCategory>('LABOUR');
  const [page, setPage] = useState(1);
  const { data } = useApi<ProjectCostsDto>('projects', `/projects/${projectId}/costs`, {
    from: from || undefined,
    to: to || undefined,
    category,
    page,
    pageSize: PAGE_SIZE,
  });
  const unitLabel = (e: CostEntryDto) => {
    if (!e.unit) return '';
    if (e.kind === 'EXPENSE') return enumLabel('ExpenseCategory', e.unit);
    if (e.unit === 'days' || e.unit === 'h' || e.unit === 'day' || e.unit === 'l')
      return t(`units.${e.unit}`);
    return e.unit;
  };
  const pages = data ? Math.max(1, Math.ceil(data.entries.total / PAGE_SIZE)) : 1;
  const selected = data?.byCategory.find((c) => c.category === category);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="cost-from" className="text-sm font-medium">
              {t('from')}
            </label>
            <DateInput
              id="cost-from"
              value={from}
              onChange={(v) => {
                setFrom(v);
                setPage(1);
              }}
              className="h-11 w-48 text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cost-to" className="text-sm font-medium">
              {t('to')}
            </label>
            <DateInput
              id="cost-to"
              value={to}
              onChange={(v) => {
                setTo(v);
                setPage(1);
              }}
              className="h-11 w-48 text-base"
            />
          </div>
          {from || to ? (
            <Button
              variant="ghost"
              size="lg"
              className="h-11 text-base"
              onClick={() => {
                setFrom('');
                setTo('');
                setPage(1);
              }}
            >
              <X aria-hidden />
              {t('allTime')}
            </Button>
          ) : null}
          <p className="ml-auto text-right">
            <span className="block text-sm text-muted-foreground">{t('totalSpent')}</span>
            <span className="text-2xl font-semibold tabular-nums" data-testid="costs-total">
              {data ? formatMoney(data.total.actual) : '—'}
            </span>
          </p>
        </CardContent>
      </Card>

      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        role="tablist"
        aria-label={t('category')}
      >
        {BUDGET_CATEGORIES.map((c) => {
          const row = data?.byCategory.find((x) => x.category === c);
          const active = c === category;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setCategory(c);
                setPage(1);
              }}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50',
                active && 'border-primary ring-2 ring-primary/30',
              )}
              data-testid={`cost-cat-${c}`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-medium">{enumLabel('BudgetCategory', c)}</span>
                {row?.estimated ? <EstimatedTag /> : null}
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {row ? formatMoney(row.actual) : '—'}
              </span>
              <span className="text-sm text-muted-foreground">
                {row && row.budget !== '0.00'
                  ? t('ofBudget', { budget: formatMoney(row.budget) })
                  : t('noBudget')}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('entriesTitle', { category: enumLabel('BudgetCategory', category) })}
          </CardTitle>
          {category === 'LABOUR' ? (
            <p className="text-muted-foreground">{t('labourHelp')}</p>
          ) : null}
        </CardHeader>
        <CardContent>
          {!data?.entries.items.length ? (
            <p className="py-6 text-center text-muted-foreground">{t('noEntries')}</p>
          ) : (
            <>
              <Table data-testid="cost-entries">
                <TableHeader>
                  <TableRow>
                    {category !== 'LABOUR' ? (
                      <TableHead className="whitespace-normal">{t('date')}</TableHead>
                    ) : null}
                    <TableHead className="whitespace-normal">{t('description')}</TableHead>
                    <TableHead className="whitespace-normal">{t('reference')}</TableHead>
                    <TableHead className="text-right whitespace-normal">{t('quantity')}</TableHead>
                    <TableHead className="text-right whitespace-normal">{t('amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.items.map((e, i) => {
                    const href = entryHref(e);
                    return (
                      <TableRow key={`${e.refId}-${e.date}-${i}`}>
                        {category !== 'LABOUR' ? (
                          <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                        ) : null}
                        <TableCell className="whitespace-normal">
                          {href ? (
                            <Link href={href} className="font-medium hover:underline">
                              {e.description}
                            </Link>
                          ) : (
                            <span className="font-medium">{e.description}</span>
                          )}
                          <span className="block text-sm text-muted-foreground">
                            {t(`kinds.${e.kind}`)}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-normal text-muted-foreground">
                          {e.reference ?? '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {e.quantity
                            ? `${formatQty(e.quantity)} ${unitLabel(e)}`
                            : unitLabel(e) || '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {formatMoney(e.amount)}
                          {e.estimated ? (
                            <span className="ml-2">
                              <EstimatedTag />
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground">
                  {t('entriesCount', {
                    n: data.entries.total,
                    total: formatMoney(selected?.actual),
                  })}
                </p>
                {pages > 1 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-10"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      {t('prev')}
                    </Button>
                    <span className="tabular-nums">
                      {page} / {pages}
                    </span>
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-10"
                      disabled={page >= pages}
                      onClick={() => setPage(page + 1)}
                    >
                      {t('next')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('expensesTitle')}</h2>
        <p className="text-muted-foreground">{t('expensesHelp')}</p>
        <ExpensesList projectId={projectId} projectName={projectName} />
      </section>
    </div>
  );
}
