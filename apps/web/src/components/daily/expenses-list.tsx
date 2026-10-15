'use client';

import {
  type AssetDto,
  EXPENSE_CATEGORIES,
  EXPENSE_PAID_BY,
  type ExpenseCategory,
  type ExpenseDto,
  type ExpenseListDto,
  type ExpensePaidBy,
  type ProjectDto,
  type SupplierDto,
} from '@sc/shared';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { type DataTableColumn, DataTable } from '@/components/data-table/data-table';
import { DeleteButton } from '@/components/delete-button';
import { EmptyState } from '@/components/empty-state';
import { EntityPicker } from '@/components/entity-picker';
import { DateInput } from '@/components/forms/date-input';
import { EnumFilter, EnumSelect, useEnumLabel } from '@/components/forms/enum-select';
import { FormField } from '@/components/forms/form-field';
import { MoneyInput } from '@/components/forms/money-input';
import { projectItem } from '@/components/schedule/allocation-dialogs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useErrorMessage, useValidationMessage } from '@/hooks/use-error-message';
import { useDebounced } from '@/hooks/use-list-state';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { ApiError, api } from '@/lib/api-client';
import { formatDate, formatMoney, todayInColombo } from '@/lib/format';
import { ReceiptButton } from './receipt-button';

interface ExpenseForm {
  date: string;
  projectId: string;
  projectLabel?: string;
  assetId: string;
  assetLabel?: string;
  category: ExpenseCategory | '';
  description: string;
  amount: string;
  paidBy: ExpensePaidBy;
  supplierId: string;
  supplierLabel?: string;
  receiptDocumentId: string | null;
}

const toForm = (e: ExpenseDto | null, projectId?: string, projectName?: string): ExpenseForm => ({
  date: e ? e.date.slice(0, 10) : todayInColombo(),
  projectId: e?.projectId ?? projectId ?? '',
  projectLabel: e?.project?.name ?? projectName,
  assetId: e?.assetId ?? '',
  assetLabel: e?.asset?.name,
  category: e?.category ?? '',
  description: e?.description ?? '',
  amount: e?.amount ?? '',
  paidBy: e?.paidBy ?? 'CASH',
  supplierId: e?.supplierId ?? '',
  supplierLabel: e?.supplier?.name,
  receiptDocumentId: e?.receiptDocumentId ?? null,
});

/** Add / edit one expense (any date, project optional). */
export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  projectId,
  projectName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseDto | null;
  projectId?: string;
  projectName?: string;
}) {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const enumLabel = useEnumLabel();
  const errorMessage = useErrorMessage();
  const validation = useValidationMessage();
  const invalidate = useInvalidate();
  const [form, setForm] = useState(() => toForm(expense, projectId, projectName));
  const [key, setKey] = useState({ open, expense });
  if (key.open !== open || key.expense !== expense) {
    setKey({ open, expense });
    setForm(toForm(expense, projectId, projectName));
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ExpenseForm>) => setForm((f) => ({ ...f, ...patch }));
  const err = (k: string) => (errors[k] ? { message: errors[k] } : undefined);

  const save = async () => {
    const local: Record<string, string> = {};
    if (!form.category) local.category = 'REQUIRED';
    if (!form.description.trim()) local.description = 'REQUIRED';
    if (!form.amount) local.amount = 'REQUIRED';
    if (form.paidBy === 'CREDIT' && !form.supplierId)
      local.supplierId = 'SUPPLIER_REQUIRED_FOR_CREDIT';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    const body = {
      date: form.date,
      projectId: form.projectId,
      assetId: form.assetId,
      category: form.category,
      description: form.description,
      amount: form.amount,
      paidBy: form.paidBy,
      supplierId: form.supplierId,
      receiptDocumentId: form.receiptDocumentId ?? '',
    };
    try {
      if (expense) await api(`/expenses/${expense.id}`, { method: 'PATCH', body });
      else await api('/expenses', { method: 'POST', body });
      await invalidate('expenses', 'daily-entry', 'suppliers');
      toast.success(tc('savedOk'));
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details) && e.details.length) {
        const next: Record<string, string> = {};
        for (const d of e.details as { path: string; message: string }[]) next[d.path] = d.message;
        setErrors(next);
      } else toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="expense-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{expense ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="exp-date" label={t('fields.date')}>
            <DateInput
              id="exp-date"
              value={form.date}
              onChange={(v) => set({ date: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="exp-category" label={t('fields.category')} error={err('category')}>
            <EnumSelect
              id="exp-category"
              enumName="ExpenseCategory"
              values={EXPENSE_CATEGORIES}
              value={form.category}
              onChange={(v) => set({ category: v as ExpenseCategory })}
              invalid={Boolean(errors.category)}
            />
          </FormField>
          <FormField
            id="exp-description"
            label={t('fields.description')}
            error={err('description')}
            className="md:col-span-2"
          >
            <Input
              id="exp-description"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              aria-invalid={Boolean(errors.description) || undefined}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="exp-amount" label={t('fields.amount')} error={err('amount')}>
            <MoneyInput
              id="exp-amount"
              value={form.amount}
              onChange={(v) => set({ amount: v })}
              aria-invalid={Boolean(errors.amount) || undefined}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="exp-paidBy" label={t('fields.paidBy')}>
            <EnumSelect
              id="exp-paidBy"
              enumName="ExpensePaidBy"
              values={EXPENSE_PAID_BY}
              value={form.paidBy}
              onChange={(v) => set({ paidBy: v as ExpensePaidBy })}
            />
          </FormField>
          <FormField id="exp-project" label={t('fields.project')} description={t('projectHint')}>
            <EntityPicker<ProjectDto>
              id="exp-project"
              resource="projects"
              value={form.projectId}
              selectedLabel={form.projectLabel}
              onChange={(id, row) => set({ projectId: id, projectLabel: row?.name })}
              toItem={projectItem}
              allowClear
            />
          </FormField>
          <FormField id="exp-supplier" label={t('fields.supplier')} error={err('supplierId')}>
            <EntityPicker<SupplierDto>
              id="exp-supplier"
              resource="suppliers"
              value={form.supplierId}
              selectedLabel={form.supplierLabel}
              onChange={(id, row) => set({ supplierId: id, supplierLabel: row?.name })}
              toItem={(s) => ({ id: s.id, label: s.name, hint: enumLabel('SupplierType', s.type) })}
              invalid={Boolean(errors.supplierId)}
              allowClear
            />
          </FormField>
          <FormField id="exp-asset" label={t('fields.asset')}>
            <EntityPicker<AssetDto>
              id="exp-asset"
              resource="assets"
              value={form.assetId}
              selectedLabel={form.assetLabel}
              onChange={(id, row) => set({ assetId: id, assetLabel: row?.name })}
              toItem={(a) => ({ id: a.id, label: a.name, hint: a.code })}
              allowClear
            />
          </FormField>
          <div className="flex flex-col gap-2">
            <span className="text-[0.95rem] font-medium">{t('fields.receipt')}</span>
            <div className="flex h-11 items-center">
              <ReceiptButton
                documentId={form.receiptDocumentId}
                projectId={form.projectId || null}
                title={form.description}
                onChange={(id) => set({ receiptDocumentId: id })}
                testId="expense-receipt"
              />
            </div>
          </div>
        </div>
        {errors.supplierId && !err('supplierId') ? (
          <p className="text-destructive">{validation(errors.supplierId)}</p>
        ) : null}
        <DialogFooter>
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
            type="button"
            size="lg"
            className="h-11 min-w-32 text-base"
            onClick={save}
            disabled={saving}
            data-testid="expense-save"
          >
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Expenses with filters (date range, project, category), a total, add / edit / delete. */
export function ExpensesList({
  projectId,
  projectName,
  initialAdd = false,
}: {
  projectId?: string;
  projectName?: string;
  initialAdd?: boolean;
}) {
  const t = useTranslations('expenses');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [project, setProject] = useState<{ id: string; label?: string }>({ id: projectId ?? '' });
  const debounced = useDebounced(search.trim());
  const { data, isLoading } = useApi<ExpenseListDto>('expenses', '/expenses', {
    page,
    pageSize: 20,
    search: debounced || undefined,
    from: from || undefined,
    to: to || undefined,
    category,
    projectId: project.id || undefined,
  });
  const [open, setOpen] = useState(initialAdd);
  const [editing, setEditing] = useState<ExpenseDto | null>(null);
  const filtered = Boolean(debounced || from || to || category || (!projectId && project.id));

  const addButton = (
    <Button
      size="lg"
      className="h-11 text-base"
      onClick={() => {
        setEditing(null);
        setOpen(true);
      }}
      data-testid="add-expense"
    >
      <Plus aria-hidden />
      {t('add')}
    </Button>
  );

  const columns: DataTableColumn<ExpenseDto>[] = [
    {
      id: 'date',
      header: t('fields.date'),
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
    },
    {
      id: 'description',
      header: t('fields.description'),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium">{row.original.description}</p>
          <p className="text-sm text-muted-foreground">
            {[
              enumLabel('ExpenseCategory', row.original.category),
              row.original.supplier?.name,
              row.original.asset?.name,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      ),
    },
    ...(projectId
      ? []
      : [
          {
            id: 'project',
            header: t('fields.project'),
            cell: ({ row }) =>
              row.original.project?.name ?? (
                <span className="text-muted-foreground">{t('noProject')}</span>
              ),
          } satisfies DataTableColumn<ExpenseDto>,
        ]),
    {
      id: 'paidBy',
      header: t('fields.paidBy'),
      cell: ({ row }) => enumLabel('ExpensePaidBy', row.original.paidBy),
    },
    {
      id: 'amount',
      header: () => <span className="block text-right">{t('fields.amount')}</span>,
      cell: ({ row }) => (
        <span className="block text-right whitespace-nowrap tabular-nums">
          {formatMoney(row.original.amount)}
        </span>
      ),
    },
    {
      id: 'receipt',
      header: () => <span className="sr-only">{t('fields.receipt')}</span>,
      cell: ({ row }) =>
        row.original.receiptDocumentId ? (
          <ReceiptButton
            documentId={row.original.receiptDocumentId}
            projectId={null}
            title=""
            onChange={() => undefined}
            disabled
          />
        ) : null,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('fields.actions')}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={t('edit')}
            onClick={() => {
              setEditing(row.original);
              setOpen(true);
            }}
          >
            <Pencil aria-hidden />
          </Button>
          <DeleteButton
            variant="ghost"
            iconOnly
            description={t('deleteConfirm', { description: row.original.description })}
            onDelete={async () => {
              await api(`/expenses/${row.original.id}`, { method: 'DELETE' });
              await invalidate('expenses', 'daily-entry', 'suppliers');
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-44 flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t('from')}</span>
          <DateInput
            value={from}
            onChange={(v) => {
              setFrom(v);
              setPage(1);
            }}
            placeholder={t('any')}
            className="h-10"
          />
        </div>
        <div className="flex w-44 flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t('to')}</span>
          <DateInput
            value={to}
            onChange={(v) => {
              setTo(v);
              setPage(1);
            }}
            placeholder={t('any')}
            className="h-10"
          />
        </div>
        {!projectId ? (
          <div className="flex w-64 flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t('fields.project')}</span>
            <EntityPicker<ProjectDto>
              resource="projects"
              value={project.id}
              selectedLabel={project.label}
              onChange={(id, row) => {
                setProject({ id, label: row?.name });
                setPage(1);
              }}
              toItem={projectItem}
              placeholder={t('allProjects')}
              allowClear
            />
          </div>
        ) : null}
        {from || to ? (
          <Button
            variant="ghost"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            {t('clearDates')}
          </Button>
        ) : null}
        <div className="ml-auto text-right">
          <p className="text-sm text-muted-foreground">{t('total')}</p>
          <p className="text-xl font-semibold tabular-nums" data-testid="expenses-total">
            {formatMoney(data?.totalAmount)}
          </p>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total}
        page={page}
        onPageChange={setPage}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        isLoading={isLoading}
        getRowId={(e) => e.id}
        toolbar={
          <>
            <EnumFilter
              enumName="ExpenseCategory"
              value={category}
              onChange={(v) => {
                setCategory(v || undefined);
                setPage(1);
              }}
              allLabel={t('allCategories')}
            />
            {addButton}
          </>
        }
        emptyMessage={filtered ? undefined : <EmptyState message={t('empty')} action={addButton} />}
      />
      <ExpenseDialog
        open={open}
        onOpenChange={setOpen}
        expense={editing}
        projectId={projectId}
        projectName={projectName}
      />
    </div>
  );
}
