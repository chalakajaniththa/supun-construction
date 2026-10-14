'use client';

import type { ProjectDto } from '@sc/shared';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type DataTableColumn, DataTable } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/empty-state';
import { EnumFilter, useEnumLabel } from '@/components/forms/enum-select';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { useListState } from '@/hooks/use-list-state';
import { useList } from '@/hooks/use-resource';
import { formatDate, formatMoney } from '@/lib/format';

export function ProjectsList() {
  const t = useTranslations('projects');
  const enumLabel = useEnumLabel();
  const router = useRouter();
  const list = useListState({
    status: undefined as string | undefined,
    type: undefined as string | undefined,
    source: undefined as string | undefined,
  });
  const { data, isLoading } = useList<ProjectDto>('projects', list.params);
  const filtered = Boolean(
    list.search || list.filters.status || list.filters.type || list.filters.source,
  );

  const columns: DataTableColumn<ProjectDto>[] = [
    {
      id: 'name',
      header: t('fields.name'),
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            href={`/projects/${row.original.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {row.original.code} · {enumLabel('ProjectType', row.original.type)}
          </p>
        </div>
      ),
    },
    {
      id: 'client',
      header: t('fields.client'),
      cell: ({ row }) => (
        <div className="max-w-56">
          <p className="line-clamp-2">{row.original.client.name}</p>
          <p className="text-sm text-muted-foreground">
            {enumLabel('ProjectSource', row.original.source)}
          </p>
        </div>
      ),
    },
    {
      id: 'contractValue',
      header: () => <span className="block text-right">{t('fields.contractValue')}</span>,
      cell: ({ row }) => (
        <span className="block text-right whitespace-nowrap tabular-nums">
          {formatMoney(row.original.contractValue)}
        </span>
      ),
    },
    {
      id: 'dates',
      header: t('fields.dates'),
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatDate(row.original.startDate)} –{' '}
          {formatDate(row.original.revisedEndDate ?? row.original.plannedEndDate)}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('fields.status'),
      cell: ({ row }) => (
        <StatusChip status={row.original.status}>
          {enumLabel('ProjectStatus', row.original.status)}
        </StatusChip>
      ),
    },
  ];

  const addButton = (
    <Button asChild size="lg" className="h-11 text-base">
      <Link href="/projects/new" data-testid="add-project">
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
      getRowId={(p) => p.id}
      onRowClick={(p) => router.push(`/projects/${p.id}`)}
      toolbar={
        <>
          <EnumFilter
            enumName="ProjectStatus"
            value={list.filters.status}
            onChange={(v) => list.setFilter('status', v || undefined)}
            allLabel={t('allStatuses')}
            testId="filter-status"
          />
          <EnumFilter
            enumName="ProjectType"
            value={list.filters.type}
            onChange={(v) => list.setFilter('type', v || undefined)}
            allLabel={t('allTypes')}
          />
          <EnumFilter
            enumName="ProjectSource"
            value={list.filters.source}
            onChange={(v) => list.setFilter('source', v || undefined)}
            allLabel={t('allSources')}
          />
        </>
      }
      emptyMessage={filtered ? undefined : <EmptyState message={t('empty')} action={addButton} />}
    />
  );
}

/** Header buttons of the projects page. */
export function ProjectsHeaderActions() {
  const t = useTranslations('projects');
  return (
    <>
      <Button asChild variant="outline" size="lg" className="h-11 text-base">
        <Link href="/projects/clients" data-testid="manage-clients">
          <Users aria-hidden />
          {t('manageClients')}
        </Link>
      </Button>
      <Button asChild size="lg" className="h-11 text-base">
        <Link href="/projects/new" data-testid="new-project">
          <Plus aria-hidden />
          {t('add')}
        </Link>
      </Button>
    </>
  );
}
