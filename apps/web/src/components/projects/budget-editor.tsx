'use client';

import { BUDGET_CATEGORIES, type BudgetDto, type BudgetLineDto } from '@sc/shared';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useEnumLabel } from '@/components/forms/enum-select';
import { MoneyInput } from '@/components/forms/money-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { budgetSum } from '@/lib/budget';
import { formatMoney } from '@/lib/format';

type Row = { amount: string; notes: string };
type Rows = Record<(typeof BUDGET_CATEGORIES)[number], Row>;

function toRows(lines: BudgetLineDto[]): Rows {
  return Object.fromEntries(
    BUDGET_CATEGORIES.map((c) => {
      const line = lines.find((l) => l.category === c);
      return [c, { amount: line ? line.amount : '', notes: line?.notes ?? '' }];
    }),
  ) as Rows;
}

/** The internal budget by category, edited in one table and saved at once (PUT /budget). */
export function BudgetEditor({ projectId, lines }: { projectId: string; lines: BudgetLineDto[] }) {
  const t = useTranslations('projects.budget');
  const tc = useTranslations('common');
  const enumLabel = useEnumLabel();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const [rows, setRows] = useState<Rows>(() => toRows(lines));
  const [lastLines, setLastLines] = useState(lines);
  if (lastLines !== lines) {
    setLastLines(lines);
    setRows(toRows(lines));
  }
  const save = useMutation({
    mutationFn: () =>
      api<BudgetDto>(`/projects/${projectId}/budget`, {
        method: 'PUT',
        body: {
          lines: BUDGET_CATEGORIES.filter((c) => rows[c].amount !== '').map((c) => ({
            category: c,
            amount: rows[c].amount,
            notes: rows[c].notes,
          })),
        },
      }),
    onSuccess: () => invalidate('projects'),
  });
  const total = budgetSum(BUDGET_CATEGORIES.map((c) => rows[c].amount));
  const set = (c: keyof Rows, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [c]: { ...r[c], ...patch } }));

  return (
    <Card data-testid="budget-editor">
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <CardDescription className="text-[0.95rem]">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await save.mutateAsync();
              toast.success(t('saved'));
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
        >
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-11 w-48 font-semibold">{t('category')}</TableHead>
                  <TableHead className="h-11 w-64 font-semibold">{t('amount')}</TableHead>
                  <TableHead className="h-11 font-semibold">{t('notes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BUDGET_CATEGORIES.map((c) => (
                  <TableRow key={c}>
                    <TableCell className="font-medium">
                      <label htmlFor={`budget-${c}`}>{enumLabel('BudgetCategory', c)}</label>
                    </TableCell>
                    <TableCell>
                      <MoneyInput
                        id={`budget-${c}`}
                        className="h-10"
                        value={rows[c].amount}
                        onChange={(v) => set(c, { amount: v })}
                        data-testid={`budget-amount-${c}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`${t('notes')} – ${enumLabel('BudgetCategory', c)}`}
                        className="h-10 text-base"
                        value={rows[c].notes}
                        maxLength={500}
                        onChange={(e) => set(c, { notes: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="text-base">
                  <TableCell className="font-semibold">{t('total')}</TableCell>
                  <TableCell
                    className="text-right font-semibold tabular-nums"
                    data-testid="budget-total"
                  >
                    {formatMoney(total)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              type="submit"
              size="lg"
              className="h-11 min-w-32 text-base"
              disabled={save.isPending}
              data-testid="budget-save"
            >
              {save.isPending ? tc('saving') : t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
