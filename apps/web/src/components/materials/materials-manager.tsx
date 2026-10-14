'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  COMMON_UNITS,
  type MaterialCreateInput,
  type MaterialDto,
  materialCreateSchema,
} from '@sc/shared';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { type DataTableColumn, DataTable } from '@/components/data-table/data-table';
import { DeleteButton } from '@/components/delete-button';
import { EmptyState } from '@/components/empty-state';
import { EnumFilter, useEnumLabel } from '@/components/forms/enum-select';
import { SelectField, TextField } from '@/components/forms/fields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useListState } from '@/hooks/use-list-state';
import { useInvalidate, useList, useRemove } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';

const toValues = (m?: MaterialDto | null): MaterialCreateInput => ({
  name: m?.name ?? '',
  nameSinhala: m?.nameSinhala ?? '',
  unit: m?.unit ?? '',
  category: m?.category ?? ('' as MaterialCreateInput['category']),
});

function MaterialDialog({
  open,
  onOpenChange,
  material,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  material: MaterialDto | null;
}) {
  const t = useTranslations('materials');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const form = useForm<MaterialCreateInput, unknown, z.output<typeof materialCreateSchema>>({
    resolver: zodResolver(materialCreateSchema),
    values: toValues(material),
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      if (material) await api(`/materials/${material.id}`, { method: 'PATCH', body: values });
      else await api('/materials', { method: 'POST', body: values });
      await invalidate('materials');
      toast.success(tc('savedOk'));
      onOpenChange(false);
      form.reset(toValues(null));
    } catch (err) {
      if (!applyServerErrors(err, form.setError, ['name', 'nameSinhala', 'unit', 'category']))
        toast.error(errorMessage(err));
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{material ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-5 md:grid-cols-2"
          data-testid="material-form"
        >
          <TextField
            control={form.control}
            name="name"
            label={t('fields.name')}
            idPrefix="material"
          />
          <TextField
            control={form.control}
            name="nameSinhala"
            label={t('fields.nameSinhala')}
            idPrefix="material"
          />
          <SelectField
            control={form.control}
            name="category"
            label={t('fields.category')}
            enumName="MaterialCategory"
            idPrefix="material"
          />
          <div>
            <TextField
              control={form.control}
              name="unit"
              label={t('fields.unit')}
              idPrefix="material"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {COMMON_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  className="rounded-full border px-2 py-0.5 text-sm hover:bg-muted"
                  onClick={() => form.setValue('unit', u, { shouldValidate: true })}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => onOpenChange(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-11 min-w-32 text-base"
              disabled={form.formState.isSubmitting}
              data-testid="material-submit"
            >
              {form.formState.isSubmitting ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Materials catalog (Purchases & Store → Materials). */
export function MaterialsManager() {
  const t = useTranslations('materials');
  const enumLabel = useEnumLabel();
  const list = useListState({ category: undefined as string | undefined });
  const { data, isLoading } = useList<MaterialDto>('materials', list.params);
  const remove = useRemove('materials');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialDto | null>(null);
  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const addButton = (
    <Button size="lg" className="h-11 text-base" onClick={openAdd} data-testid="add-material">
      <Plus aria-hidden />
      {t('add')}
    </Button>
  );
  const columns: DataTableColumn<MaterialDto>[] = [
    {
      id: 'name',
      header: t('fields.name'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.nameSinhala ? (
            <p className="text-sm text-muted-foreground">{row.original.nameSinhala}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'category',
      header: t('fields.category'),
      cell: ({ row }) => enumLabel('MaterialCategory', row.original.category),
    },
    { id: 'unit', header: t('fields.unit'), cell: ({ row }) => row.original.unit },
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
        getRowId={(m) => m.id}
        toolbar={
          <>
            <EnumFilter
              enumName="MaterialCategory"
              value={list.filters.category}
              onChange={(v) => list.setFilter('category', v || undefined)}
              allLabel={t('allCategories')}
            />
            {addButton}
          </>
        }
        emptyMessage={
          list.search || list.filters.category ? undefined : (
            <EmptyState message={t('empty')} action={addButton} />
          )
        }
      />
      <MaterialDialog open={open} onOpenChange={setOpen} material={editing} />
    </>
  );
}
