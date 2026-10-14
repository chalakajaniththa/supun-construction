'use client';

import type { ClientDto } from '@sc/shared';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { type DataTableColumn, DataTable } from '@/components/data-table/data-table';
import { DeleteButton } from '@/components/delete-button';
import { EmptyState } from '@/components/empty-state';
import { EnumFilter, useEnumLabel } from '@/components/forms/enum-select';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { useListState } from '@/hooks/use-list-state';
import { useList, useRemove } from '@/hooks/use-resource';
import { ClientDialog } from './client-dialog';

/** Clients list with add / edit dialog and soft delete. Used on /projects/clients and in Settings. */
export function ClientsManager() {
  const t = useTranslations('clients');
  const enumLabel = useEnumLabel();
  const list = useListState({ type: undefined as string | undefined });
  const { data, isLoading } = useList<ClientDto>('clients', list.params);
  const remove = useRemove('clients');
  const [editing, setEditing] = useState<ClientDto | null>(null);
  const [open, setOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const addButton = (
    <Button size="lg" className="h-11 text-base" onClick={openAdd} data-testid="add-client">
      <Plus aria-hidden />
      {t('add')}
    </Button>
  );

  const columns: DataTableColumn<ClientDto>[] = [
    {
      id: 'name',
      header: t('fields.name'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.contactPerson ? (
            <p className="text-sm text-muted-foreground">{row.original.contactPerson}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'type',
      header: t('fields.type'),
      cell: ({ row }) => (
        <StatusChip tone={row.original.type === 'GOVERNMENT' ? 'info' : 'neutral'}>
          {enumLabel('ClientType', row.original.type)}
        </StatusChip>
      ),
    },
    { id: 'phone', header: t('fields.phone'), cell: ({ row }) => row.original.phone ?? '—' },
    {
      id: 'projects',
      header: t('fields.projects'),
      cell: ({ row }) => row.original.projectCount ?? 0,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('fields.actions')}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setEditing(row.original);
              setOpen(true);
            }}
          >
            <Pencil aria-hidden />
            {t('edit')}
          </Button>
          <DeleteButton
            variant="ghost"
            description={t('deleteConfirm', { name: row.original.name })}
            onDelete={() => remove.mutateAsync(row.original.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total}
        page={list.page}
        onPageChange={list.setPage}
        search={list.search}
        onSearchChange={list.setSearch}
        isLoading={isLoading}
        getRowId={(c) => c.id}
        toolbar={
          <>
            <EnumFilter
              enumName="ClientType"
              value={list.filters.type}
              onChange={(v) => list.setFilter('type', v || undefined)}
              allLabel={t('allTypes')}
            />
            {addButton}
          </>
        }
        emptyMessage={
          list.search || list.filters.type ? undefined : (
            <EmptyState message={t('empty')} action={addButton} />
          )
        }
      />
      <ClientDialog open={open} onOpenChange={setOpen} client={editing} />
    </>
  );
}
