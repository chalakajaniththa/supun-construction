'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type WorkerDto,
  type WorkerRateCreateInput,
  type WorkerRateDto,
  workerRateCreateSchema,
} from '@sc/shared';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { type DataTableColumn, DataTable } from '@/components/data-table/data-table';
import { DeleteButton } from '@/components/delete-button';
import { DateField, MoneyField } from '@/components/forms/fields';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { formatDate, formatMoney, todayInColombo } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/** Pay rate history (newest first) with "Add new rate". */
export function RateHistory({ worker }: { worker: WorkerDto }) {
  const t = useTranslations('workers.rates');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.sub('workers', worker.id, 'rates'),
    queryFn: ({ signal }) => api<WorkerRateDto[]>(`/workers/${worker.id}/rates`, { signal }),
  });
  const permanent = worker.type === 'PERMANENT';
  const empty: WorkerRateCreateInput = {
    effectiveFrom: todayInColombo(),
    dailyRate: '',
    monthlySalary: '',
    otHourlyRate: '',
  };
  const form = useForm<WorkerRateCreateInput, unknown, z.output<typeof workerRateCreateSchema>>({
    resolver: zodResolver(workerRateCreateSchema),
    defaultValues: empty,
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await api(`/workers/${worker.id}/rates`, { method: 'POST', body: values });
      await invalidate('workers');
      toast.success(t('added'));
      setOpen(false);
      form.reset(empty);
    } catch (err) {
      if (
        !applyServerErrors(err, form.setError, [
          'effectiveFrom',
          'dailyRate',
          'monthlySalary',
          'otHourlyRate',
        ])
      ) {
        toast.error(errorMessage(err));
      }
    }
  });

  const columns: DataTableColumn<WorkerRateDto>[] = [
    {
      id: 'from',
      header: t('effectiveFrom'),
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          {formatDate(row.original.effectiveFrom)}
          {row.original.id === worker.currentRate?.id ? (
            <StatusChip tone="info">{t('current')}</StatusChip>
          ) : null}
          {row.original.effectiveFrom.slice(0, 10) > todayInColombo() ? (
            <StatusChip tone="neutral">{t('future')}</StatusChip>
          ) : null}
        </span>
      ),
    },
    {
      id: 'pay',
      header: () => (
        <span className="block text-right">{permanent ? t('monthlySalary') : t('dailyRate')}</span>
      ),
      cell: ({ row }) => (
        <span className="block text-right tabular-nums">
          {formatMoney(permanent ? row.original.monthlySalary : row.original.dailyRate)}
        </span>
      ),
    },
    {
      id: 'ot',
      header: () => <span className="block text-right">{t('otHourlyRate')}</span>,
      cell: ({ row }) => (
        <span className="block text-right tabular-nums">
          {row.original.otHourlyRate ? formatMoney(row.original.otHourlyRate) : t('otDefault')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{tc('delete')}</span>,
      cell: ({ row }) =>
        (data?.length ?? 0) > 1 ? (
          <div className="flex justify-end">
            <DeleteButton
              variant="ghost"
              description={t('deleteConfirm', { date: formatDate(row.original.effectiveFrom) })}
              onDelete={async () => {
                await api(`/workers/${worker.id}/rates/${row.original.id}`, { method: 'DELETE' });
                await invalidate('workers');
              }}
            />
          </div>
        ) : null,
    },
  ];

  return (
    <Card data-testid="rate-history">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">{t('title')}</CardTitle>
          <CardDescription className="text-[0.95rem]">{t('description')}</CardDescription>
        </div>
        <Button
          size="lg"
          className="h-11 text-base"
          onClick={() => setOpen(true)}
          data-testid="add-rate"
        >
          <Plus aria-hidden />
          {t('add')}
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={data} isLoading={isLoading} getRowId={(r) => r.id} />
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('add')}</DialogTitle>
            <DialogDescription>{t('addDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate className="grid gap-5" data-testid="rate-form">
            <DateField
              control={form.control}
              name="effectiveFrom"
              label={t('effectiveFrom')}
              idPrefix="rate"
            />
            {permanent ? (
              <MoneyField
                control={form.control}
                name="monthlySalary"
                label={t('monthlySalary')}
                idPrefix="rate"
              />
            ) : (
              <MoneyField
                control={form.control}
                name="dailyRate"
                label={t('dailyRate')}
                idPrefix="rate"
              />
            )}
            <MoneyField
              control={form.control}
              name="otHourlyRate"
              label={t('otHourlyRate')}
              description={t('otHint')}
              idPrefix="rate"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 text-base"
                onClick={() => setOpen(false)}
              >
                {tc('cancel')}
              </Button>
              <Button
                type="submit"
                size="lg"
                className="h-11 min-w-32 text-base"
                disabled={form.formState.isSubmitting}
                data-testid="rate-submit"
              >
                {form.formState.isSubmitting ? tc('saving') : tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
