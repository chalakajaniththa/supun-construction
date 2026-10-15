'use client';

import type { SupplierDto } from '@sc/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { type DataTableColumn, DataTable } from '@/components/data-table/data-table';
import { DeleteButton } from '@/components/delete-button';
import { BackButton, DetailState, DetailTabs } from '@/components/detail-page';
import { DocumentPanel } from '@/components/documents/document-panel';
import { EmptyState } from '@/components/empty-state';
import { EnumFilter, useEnumLabel } from '@/components/forms/enum-select';
import { InfoList } from '@/components/info-list';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { useListState } from '@/hooks/use-list-state';
import { useDetail, useList, useRemove } from '@/hooks/use-resource';
import { formatMoney } from '@/lib/format';
import { SupplierDialog } from './supplier-dialog';
import { SupplierStatement } from './supplier-statement';

export function SuppliersView() {
  const t = useTranslations('suppliers');
  const enumLabel = useEnumLabel();
  const router = useRouter();
  const list = useListState({ type: undefined as string | undefined });
  const { data, isLoading } = useList<SupplierDto & { balance: string }>('suppliers', list.params);
  const [open, setOpen] = useState(false);

  const addButton = (
    <Button
      size="lg"
      className="h-11 text-base"
      onClick={() => setOpen(true)}
      data-testid="add-supplier"
    >
      <Plus aria-hidden />
      {t('add')}
    </Button>
  );
  const columns: DataTableColumn<SupplierDto & { balance: string }>[] = [
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
        <Link
          href={`/suppliers/${row.original.id}`}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: 'type',
      header: t('fields.type'),
      cell: ({ row }) => enumLabel('SupplierType', row.original.type),
    },
    {
      id: 'phone',
      header: t('fields.phone'),
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.phone ?? '—'}</span>,
    },
    {
      id: 'address',
      header: t('fields.address'),
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-64">{row.original.address ?? '—'}</span>
      ),
    },
    {
      id: 'balance',
      header: () => <span className="block text-right">{t('fields.balance')}</span>,
      cell: ({ row }) => (
        <span
          className={`block text-right whitespace-nowrap tabular-nums ${Number(row.original.balance) > 0 ? 'font-semibold' : 'text-muted-foreground'}`}
          data-testid="supplier-balance"
        >
          {formatMoney(row.original.balance)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} actions={addButton} />
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total}
        page={list.page}
        onPageChange={list.setPage}
        search={list.search}
        onSearchChange={list.setSearch}
        isLoading={isLoading}
        getRowId={(s) => s.id}
        onRowClick={(s) => router.push(`/suppliers/${s.id}`)}
        toolbar={
          <EnumFilter
            enumName="SupplierType"
            value={list.filters.type}
            onChange={(v) => list.setFilter('type', v || undefined)}
            allLabel={t('allTypes')}
          />
        }
        emptyMessage={
          list.search || list.filters.type ? undefined : (
            <EmptyState message={t('empty')} action={addButton} />
          )
        }
      />
      <SupplierDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={(s) => router.push(`/suppliers/${s.id}`)}
      />
    </>
  );
}

const TABS = ['info', 'statement', 'documents'] as const;
type Tab = (typeof TABS)[number];

export function SupplierDetail({ id }: { id: string }) {
  const t = useTranslations('suppliers');
  const tc = useTranslations('common');
  const enumLabel = useEnumLabel();
  const router = useRouter();
  const { data: s, error } = useDetail<SupplierDto>('suppliers', id);
  const remove = useRemove('suppliers');
  const [tab, setTab] = useState<Tab>('info');
  const [editOpen, setEditOpen] = useState(false);

  if (!s) return <DetailState error={error} backHref="/suppliers" />;
  return (
    <>
      <PageHeader
        title={s.name}
        description={`${s.code} · ${enumLabel('SupplierType', s.type)}`}
        actions={
          <>
            <BackButton href="/suppliers" label={t('backToList')} />
            <DeleteButton
              description={t('deleteConfirm', { name: s.name })}
              onDelete={() => remove.mutateAsync(s.id)}
              onDeleted={() => router.push('/suppliers')}
            />
            <Button
              size="lg"
              className="h-11 text-base"
              onClick={() => setEditOpen(true)}
              data-testid="edit-button"
            >
              {tc('edit')}
            </Button>
          </>
        }
      />
      <DetailTabs tabs={TABS} value={tab} onChange={setTab} label={(k) => t(`tabs.${k}`)}>
        <TabsContent value="info">
          <Card>
            <CardContent>
              <InfoList
                items={[
                  { label: t('fields.code'), value: s.code },
                  { label: t('fields.type'), value: enumLabel('SupplierType', s.type) },
                  { label: t('fields.phone'), value: s.phone },
                  { label: t('fields.address'), value: s.address, wide: true },
                  { label: t('fields.notes'), value: s.notes, wide: true },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="statement">
          <SupplierStatement supplierId={s.id} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentPanel ownerType="SUPPLIER" ownerId={s.id} />
        </TabsContent>
      </DetailTabs>
      <SupplierDialog open={editOpen} onOpenChange={setEditOpen} supplier={s} />
    </>
  );
}
