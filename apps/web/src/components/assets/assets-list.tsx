'use client';

import type { AssetDto } from '@sc/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type DataTableColumn, DataTable } from '@/components/data-table/data-table';
import { ExpiryBadge } from '@/components/documents/expiry-badge';
import { EmptyState } from '@/components/empty-state';
import { EnumFilter, useEnumLabel } from '@/components/forms/enum-select';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { useListState } from '@/hooks/use-list-state';
import { useList } from '@/hooks/use-resource';

export function AssetsList() {
  const t = useTranslations('assets');
  const enumLabel = useEnumLabel();
  const router = useRouter();
  const list = useListState({
    category: undefined as string | undefined,
    status: undefined as string | undefined,
  });
  const { data, isLoading } = useList<AssetDto>('assets', list.params);
  const filtered = Boolean(list.search || list.filters.category || list.filters.status);

  const columns: DataTableColumn<AssetDto>[] = [
    {
      id: 'code',
      header: t('fields.code'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">{row.original.code}</span>
      ),
    },
    {
      id: 'name',
      header: t('fields.name'),
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            href={`/assets/${row.original.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {[row.original.make, row.original.model].filter(Boolean).join(' ')}
          </p>
        </div>
      ),
    },
    {
      id: 'category',
      header: t('fields.category'),
      cell: ({ row }) => enumLabel('AssetCategory', row.original.category),
    },
    {
      id: 'reg',
      header: t('fields.registrationNo'),
      cell: ({ row }) => row.original.registrationNo ?? '—',
    },
    {
      id: 'status',
      header: t('fields.status'),
      cell: ({ row }) => (
        <StatusChip status={row.original.status}>
          {enumLabel('AssetStatus', row.original.status)}
        </StatusChip>
      ),
    },
    {
      id: 'expiry',
      header: t('fields.nextExpiry'),
      cell: ({ row }) => <ExpiryBadge expiry={row.original.nextExpiry} />,
    },
  ];

  const addButton = (
    <Button asChild size="lg" className="h-11 text-base">
      <Link href="/assets/new" data-testid="add-asset">
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
      getRowId={(a) => a.id}
      onRowClick={(a) => router.push(`/assets/${a.id}`)}
      toolbar={
        <>
          <EnumFilter
            enumName="AssetCategory"
            value={list.filters.category}
            onChange={(v) => list.setFilter('category', v || undefined)}
            allLabel={t('allCategories')}
          />
          <EnumFilter
            enumName="AssetStatus"
            value={list.filters.status}
            onChange={(v) => list.setFilter('status', v || undefined)}
            allLabel={t('allStatuses')}
          />
        </>
      }
      emptyMessage={filtered ? undefined : <EmptyState message={t('empty')} action={addButton} />}
    />
  );
}
