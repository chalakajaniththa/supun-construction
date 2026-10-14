'use client';

import type { WorkerDto } from '@sc/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type DataTableColumn, DataTable } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/empty-state';
import { EnumFilter, useEnumLabel } from '@/components/forms/enum-select';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useListState } from '@/hooks/use-list-state';
import { useList } from '@/hooks/use-resource';
import { formatMoney } from '@/lib/format';

/** "Rs. 4,500.00 / day" or "Rs. 95,000.00 / month". */
export function useRateText() {
  const t = useTranslations('workers');
  return (w: Pick<WorkerDto, 'type' | 'currentRate'>) => {
    const r = w.currentRate;
    if (!r) return '—';
    return w.type === 'PERMANENT'
      ? t('perMonth', { amount: formatMoney(r.monthlySalary) })
      : t('perDay', { amount: formatMoney(r.dailyRate) });
  };
}

export function WorkersList() {
  const t = useTranslations('workers');
  const tc = useTranslations('common');
  const enumLabel = useEnumLabel();
  const rateText = useRateText();
  const router = useRouter();
  const list = useListState({
    type: undefined as string | undefined,
    skill: undefined as string | undefined,
    active: 'true' as string | undefined,
  });
  const { data, isLoading } = useList<WorkerDto>('workers', list.params);
  const filtered = Boolean(
    list.search || list.filters.type || list.filters.skill || list.filters.active !== 'true',
  );

  const columns: DataTableColumn<WorkerDto>[] = [
    {
      id: 'code',
      header: t('fields.code'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">{row.original.code}</span>
      ),
    },
    {
      id: 'name',
      header: t('fields.fullName'),
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            href={`/workers/${row.original.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.fullName}
          </Link>
          {row.original.nameSinhala ? (
            <p className="text-sm text-muted-foreground">{row.original.nameSinhala}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'skill',
      header: t('fields.skill'),
      cell: ({ row }) => enumLabel('WorkerSkill', row.original.skill),
    },
    {
      id: 'type',
      header: t('fields.type'),
      cell: ({ row }) => enumLabel('WorkerType', row.original.type),
    },
    {
      id: 'rate',
      header: () => <span className="block text-right">{t('fields.currentRate')}</span>,
      cell: ({ row }) => (
        <span className="block text-right whitespace-nowrap tabular-nums">
          {rateText(row.original)}
        </span>
      ),
    },
    {
      id: 'active',
      header: t('fields.active'),
      cell: ({ row }) =>
        row.original.active ? (
          <StatusChip tone="success">{tc('status.active')}</StatusChip>
        ) : (
          <StatusChip tone="neutral">{tc('status.inactive')}</StatusChip>
        ),
    },
  ];

  const addButton = (
    <Button asChild size="lg" className="h-11 text-base">
      <Link href="/workers/new" data-testid="add-worker">
        <Plus aria-hidden />
        {t('add')}
      </Link>
    </Button>
  );

  return (
    <DataTable
      columns={columns}
      data={data?.items}
      total={data?.total}
      page={list.page}
      onPageChange={list.setPage}
      search={list.search}
      onSearchChange={list.setSearch}
      isLoading={isLoading}
      getRowId={(w) => w.id}
      onRowClick={(w) => router.push(`/workers/${w.id}`)}
      toolbar={
        <>
          <EnumFilter
            enumName="WorkerType"
            value={list.filters.type}
            onChange={(v) => list.setFilter('type', v || undefined)}
            allLabel={t('allTypes')}
          />
          <EnumFilter
            enumName="WorkerSkill"
            value={list.filters.skill}
            onChange={(v) => list.setFilter('skill', v || undefined)}
            allLabel={t('allSkills')}
          />
          <div className="w-40">
            <Select
              value={list.filters.active ?? 'all'}
              onValueChange={(v) => list.setFilter('active', v === 'all' ? undefined : v)}
            >
              <SelectTrigger
                aria-label={t('fields.active')}
                className="h-10 w-full text-base data-[size=default]:h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t('onlyActive')}</SelectItem>
                <SelectItem value="false">{t('onlyInactive')}</SelectItem>
                <SelectItem value="all">{t('everyone')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      }
      emptyMessage={filtered ? undefined : <EmptyState message={t('empty')} action={addButton} />}
    />
  );
}
