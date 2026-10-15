'use client';

import type { ProjectCostsDto, ProjectDetailDto, ProjectHealthDto } from '@sc/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useEnumLabel } from '@/components/forms/enum-select';
import { HealthFlags, ProgressBar, ProgressTriple } from '@/components/progress-triple';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

/** "Estimated" tag for labour that is not in a finalized payroll yet. */
export function EstimatedTag() {
  const t = useTranslations('health');
  return (
    <span title={t('estimatedHelp')} data-testid="estimated-tag">
      <StatusChip tone="warning" className="text-xs">
        {t('estimated')}
      </StatusChip>
    </span>
  );
}

/** Private projects without a BOQ: the owner sets the physical progress by hand. */
function ManualProgress({ project }: { project: ProjectDetailDto }) {
  const t = useTranslations('health');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const [value, setValue] = useState(() => Math.round(Number(project.progressPct ?? 0)));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api(`/projects/${project.id}`, {
        method: 'PATCH',
        body: { progressPct: String(value) },
      });
      await invalidate('projects');
      toast.success(t('progressSaved'));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-md border p-4" data-testid="manual-progress">
      <label htmlFor="manual-progress" className="font-medium">
        {t('manualProgress')}
      </label>
      <p className="text-sm text-muted-foreground">{t('manualHelp')}</p>
      <div className="flex flex-wrap items-center gap-4">
        <input
          id="manual-progress"
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="h-2 min-w-48 flex-1 accent-[var(--primary)]"
        />
        <span className="w-14 text-right text-lg font-semibold tabular-nums">{value}%</span>
        <Button
          size="lg"
          className="h-11 text-base"
          onClick={save}
          disabled={saving || value === Math.round(Number(project.progressPct ?? 0))}
          data-testid="save-progress"
        >
          {t('saveProgress')}
        </Button>
      </div>
    </div>
  );
}

/** Overview tab: the three health bars + flags, and budget vs actual cost by category. */
export function ProjectHealthPanel({ project }: { project: ProjectDetailDto }) {
  const t = useTranslations('health');
  const tc = useTranslations('costs');
  const enumLabel = useEnumLabel();
  const { data: h } = useApi<ProjectHealthDto>('projects', `/projects/${project.id}/health`);
  const { data: costs } = useApi<ProjectCostsDto>('projects', `/projects/${project.id}/costs`, {
    pageSize: 1,
  });
  return (
    <>
      <Card data-testid="project-health">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">{t('title')}</CardTitle>
          {h ? <HealthFlags flags={h.flags} /> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {h ? (
            <>
              <ProgressTriple
                timePct={h.timePct}
                budgetPct={h.budgetPct}
                physicalPct={h.physicalPct}
              />
              <p className="text-sm text-muted-foreground">
                {t('summary', {
                  end: formatDate(h.currentEndDate),
                  actual: formatMoney(h.actual),
                  budget: formatMoney(h.budget),
                })}{' '}
                {t(`physicalSource.${h.physicalSource}`)}
              </p>
              {h.physicalSource !== 'BOQ' && project.source === 'PRIVATE' ? (
                <ManualProgress key={project.progressPct ?? ''} project={project} />
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">{t('loading')}</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">{tc('budgetVsActual')}</CardTitle>
          {costs?.estimated ? <EstimatedTag /> : null}
        </CardHeader>
        <CardContent>
          {costs ? (
            <Table data-testid="budget-vs-actual">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-normal">{tc('category')}</TableHead>
                  <TableHead className="text-right whitespace-normal">{tc('budget')}</TableHead>
                  <TableHead className="text-right whitespace-normal">{tc('actual')}</TableHead>
                  <TableHead className="text-right whitespace-normal">{tc('variance')}</TableHead>
                  <TableHead className="w-48 whitespace-normal">{tc('used')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.byCategory.map((c) => {
                  const over = c.variance.startsWith('-');
                  return (
                    <TableRow key={c.category}>
                      <TableCell className="font-medium">
                        {enumLabel('BudgetCategory', c.category)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {formatMoney(c.budget)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {formatMoney(c.actual)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right whitespace-nowrap tabular-nums',
                          over && 'font-semibold text-destructive',
                        )}
                      >
                        {formatMoney(c.variance)}
                      </TableCell>
                      <TableCell>
                        {c.pct === null ? (
                          <span className="text-sm text-muted-foreground">{tc('noBudget')}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <ProgressBar
                              value={c.pct}
                              tone={Number(c.pct) > 100 ? 'danger' : 'primary'}
                              label={enumLabel('BudgetCategory', c.category)}
                            />
                            <span className="w-12 text-right text-sm tabular-nums">
                              {formatPercent(c.pct, 0)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell>{tc('total')}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(costs.total.budget)}
                  </TableCell>
                  <TableCell
                    className="text-right whitespace-nowrap tabular-nums"
                    data-testid="actual-total"
                  >
                    {formatMoney(costs.total.actual)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right whitespace-nowrap tabular-nums',
                      costs.total.variance.startsWith('-') && 'text-destructive',
                    )}
                  >
                    {formatMoney(costs.total.variance)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {costs.total.pct === null ? '—' : formatPercent(costs.total.pct, 0)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">{tc('varianceHelp')}</p>
        </CardContent>
      </Card>
    </>
  );
}
