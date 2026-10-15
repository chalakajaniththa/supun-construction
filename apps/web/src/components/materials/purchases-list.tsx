'use client';

import {
  type MaterialDto,
  PURCHASE_PAYMENT_TYPES,
  type ProjectDto,
  type PurchaseDto,
  type PurchasePaymentType,
  type SupplierDto,
} from '@sc/shared';
import { Plus, Trash2 } from 'lucide-react';
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
import { StatusChip } from '@/components/status-chip';
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
import { lineAmount, sumStrings } from '@/lib/decimal';
import { formatDate, formatMoney, formatQty, todayInColombo } from '@/lib/format';

interface LineForm {
  key: string;
  materialId: string;
  materialLabel?: string;
  unit?: string;
  quantity: string;
  unitPrice: string;
  projectId: string;
  projectLabel?: string;
}

let seq = 0;
const blankLine = (): LineForm => ({
  key: `l${++seq}`,
  materialId: '',
  quantity: '',
  unitPrice: '',
  projectId: '',
});

const toForm = (p: PurchaseDto | null) => ({
  supplierId: p?.supplierId ?? '',
  supplierLabel: p?.supplier.name,
  date: p?.date.slice(0, 10) ?? todayInColombo(),
  invoiceNo: p?.invoiceNo ?? '',
  paymentType: (p?.paymentType ?? 'CREDIT') as PurchasePaymentType,
  notes: p?.notes ?? '',
  lines: p
    ? p.lines.map((l) => ({
        key: l.id,
        materialId: l.materialId,
        materialLabel: l.material.name,
        unit: l.material.unit,
        quantity: String(Number(l.quantity)),
        unitPrice: l.unitPrice,
        projectId: l.projectId ?? '',
        projectLabel: l.project?.name,
      }))
    : [blankLine()],
});

/** New / edit purchase with several lines; each line goes to the main store or straight to a project. */
export function PurchaseDialog({
  open,
  onOpenChange,
  purchase,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  purchase: PurchaseDto | null;
}) {
  const t = useTranslations('purchases');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const validation = useValidationMessage();
  const invalidate = useInvalidate();
  const [form, setForm] = useState(() => toForm(purchase));
  const [key, setKey] = useState({ open, purchase });
  if (key.open !== open || key.purchase !== purchase) {
    setKey({ open, purchase });
    setForm(toForm(purchase));
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ReturnType<typeof toForm>>) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (k: string, patch: Partial<LineForm>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === k ? { ...l, ...patch } : l)) }));
  const total = sumStrings(form.lines.map((l) => lineAmount(l.quantity, l.unitPrice)));

  const save = async () => {
    const local: Record<string, string> = {};
    if (!form.supplierId) local.supplierId = 'REQUIRED';
    form.lines.forEach((l, i) => {
      if (!l.materialId) local[`lines.${i}.materialId`] = 'REQUIRED';
      if (!l.quantity || Number(l.quantity) <= 0) local[`lines.${i}.quantity`] = 'MUST_BE_POSITIVE';
      if (!l.unitPrice) local[`lines.${i}.unitPrice`] = 'REQUIRED';
    });
    if (!form.lines.length) local.lines = 'NO_LINES';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    const body = {
      supplierId: form.supplierId,
      date: form.date,
      invoiceNo: form.invoiceNo,
      paymentType: form.paymentType,
      notes: form.notes,
      lines: form.lines.map((l) => ({
        materialId: l.materialId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        projectId: l.projectId,
      })),
    };
    try {
      if (purchase) await api(`/purchases/${purchase.id}`, { method: 'PATCH', body });
      else await api('/purchases', { method: 'POST', body });
      await invalidate('purchases', 'store', 'suppliers');
      toast.success(t('saved'));
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
  const errMsg = (k: string) => (errors[k] ? validation(errors[k]) : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"
        data-testid="purchase-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{purchase ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-4">
          <FormField
            id="pur-supplier"
            label={t('fields.supplier')}
            error={errors.supplierId ? { message: errors.supplierId } : undefined}
            className="md:col-span-2"
          >
            <EntityPicker<SupplierDto>
              id="pur-supplier"
              resource="suppliers"
              value={form.supplierId}
              selectedLabel={form.supplierLabel}
              onChange={(id, row) => set({ supplierId: id, supplierLabel: row?.name })}
              toItem={(s) => ({ id: s.id, label: s.name, hint: s.code })}
              invalid={Boolean(errors.supplierId)}
            />
          </FormField>
          <FormField id="pur-date" label={t('fields.date')}>
            <DateInput
              id="pur-date"
              value={form.date}
              onChange={(v) => set({ date: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="pur-payment" label={t('fields.paymentType')}>
            <EnumSelect
              id="pur-payment"
              enumName="PurchasePaymentType"
              values={PURCHASE_PAYMENT_TYPES}
              value={form.paymentType}
              onChange={(v) => set({ paymentType: v as PurchasePaymentType })}
            />
          </FormField>
          <FormField id="pur-invoice" label={t('fields.invoiceNo')}>
            <Input
              id="pur-invoice"
              value={form.invoiceNo}
              onChange={(e) => set({ invoiceNo: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="pur-notes" label={t('fields.notes')} className="md:col-span-3">
            <Input
              id="pur-notes"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[0.95rem] font-medium">{t('lines')}</p>
          {form.lines.map((l, i) => (
            <div
              key={l.key}
              className="grid items-end gap-2 rounded-lg border p-3 md:grid-cols-[minmax(12rem,1.6fr)_7rem_9rem_minmax(11rem,1.2fr)_8rem_auto]"
              data-testid={`line-${i}`}
            >
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-muted-foreground">{t('fields.material')}</span>
                <EntityPicker<MaterialDto>
                  resource="materials"
                  value={l.materialId}
                  selectedLabel={l.materialLabel}
                  onChange={(id, row) =>
                    setLine(l.key, { materialId: id, materialLabel: row?.name, unit: row?.unit })
                  }
                  toItem={(m) => ({ id: m.id, label: m.name, hint: m.unit })}
                  invalid={Boolean(errors[`lines.${i}.materialId`])}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  {t('fields.quantity')}
                  {l.unit ? ` (${l.unit})` : ''}
                </span>
                <Input
                  inputMode="decimal"
                  aria-label={`${t('fields.quantity')} ${i + 1}`}
                  value={l.quantity}
                  aria-invalid={Boolean(errors[`lines.${i}.quantity`]) || undefined}
                  onChange={(e) => {
                    const v = e.target.value.replace(/,/g, '').trim();
                    if (v === '' || /^\d*(\.\d{0,3})?$/.test(v)) setLine(l.key, { quantity: v });
                  }}
                  className="h-11 text-right text-base tabular-nums"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-muted-foreground">{t('fields.unitPrice')}</span>
                <MoneyInput
                  aria-label={`${t('fields.unitPrice')} ${i + 1}`}
                  value={l.unitPrice}
                  aria-invalid={Boolean(errors[`lines.${i}.unitPrice`]) || undefined}
                  onChange={(v) => setLine(l.key, { unitPrice: v })}
                  className="h-11 text-base"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-muted-foreground">{t('fields.deliverTo')}</span>
                <EntityPicker<ProjectDto>
                  resource="projects"
                  value={l.projectId}
                  selectedLabel={l.projectLabel}
                  onChange={(id, row) => setLine(l.key, { projectId: id, projectLabel: row?.name })}
                  toItem={projectItem}
                  placeholder={t('mainStore')}
                  allowClear
                />
              </label>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-muted-foreground">{t('fields.amount')}</span>
                <p className="flex h-11 items-center justify-end rounded-md bg-muted px-3 font-medium tabular-nums">
                  {formatMoney(lineAmount(l.quantity, l.unitPrice))}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={tc('delete')}
                disabled={form.lines.length === 1}
                onClick={() =>
                  setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.key !== l.key) }))
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          {Object.keys(errors).some((k) => k.startsWith('lines')) ? (
            <p className="text-sm text-destructive">
              {errMsg(Object.keys(errors).find((k) => k.startsWith('lines'))!)}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => set({ lines: [...form.lines, blankLine()] })}
              data-testid="add-line"
            >
              <Plus aria-hidden />
              {t('addLine')}
            </Button>
            <p className="text-lg">
              {t('total')}:{' '}
              <span className="font-semibold tabular-nums" data-testid="purchase-total">
                {formatMoney(total)}
              </span>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            className="h-11 text-base"
            onClick={() => onOpenChange(false)}
          >
            {tc('cancel')}
          </Button>
          <Button
            size="lg"
            className="h-11 min-w-32 text-base"
            onClick={save}
            disabled={saving}
            data-testid="purchase-save"
          >
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Purchases & Store → Purchases. */
export function PurchasesList() {
  const t = useTranslations('purchases');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [paymentType, setPaymentType] = useState<string | undefined>();
  const debounced = useDebounced(search.trim());
  const { data, isLoading } = useApi<{ items: PurchaseDto[]; total: number; totalAmount: string }>(
    'purchases',
    '/purchases',
    {
      page,
      pageSize: 20,
      search: debounced || undefined,
      paymentType,
    },
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseDto | null>(null);
  const addButton = (
    <Button
      size="lg"
      className="h-11 text-base"
      onClick={() => {
        setEditing(null);
        setOpen(true);
      }}
      data-testid="add-purchase"
    >
      <Plus aria-hidden />
      {t('add')}
    </Button>
  );
  const columns: DataTableColumn<PurchaseDto>[] = [
    {
      id: 'date',
      header: t('fields.date'),
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
    },
    {
      id: 'supplier',
      header: t('fields.supplier'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.supplier.name}</p>
          <p className="text-sm text-muted-foreground">{row.original.invoiceNo ?? '—'}</p>
        </div>
      ),
    },
    {
      id: 'items',
      header: t('items'),
      cell: ({ row }) => (
        <ul className="text-sm">
          {row.original.lines.map((l) => (
            <li key={l.id}>
              {l.material.name} – {formatQty(l.quantity)} {l.material.unit}{' '}
              <span className="text-muted-foreground">→ {l.project?.name ?? t('mainStore')}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'paymentType',
      header: t('fields.paymentType'),
      cell: ({ row }) => (
        <StatusChip tone={row.original.paymentType === 'CREDIT' ? 'warning' : 'success'}>
          {enumLabel('PurchasePaymentType', row.original.paymentType)}
        </StatusChip>
      ),
    },
    {
      id: 'total',
      header: () => <span className="block text-right">{t('total')}</span>,
      cell: ({ row }) => (
        <span className="block text-right font-medium whitespace-nowrap tabular-nums">
          {formatMoney(row.original.total)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('fields.actions')}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <DeleteButton
            variant="ghost"
            description={t('deleteConfirm')}
            onDelete={async () => {
              await api(`/purchases/${row.original.id}`, { method: 'DELETE' });
              await invalidate('purchases', 'store', 'suppliers');
            }}
          />
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-3">
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
        getRowId={(p) => p.id}
        onRowClick={(p) => {
          setEditing(p);
          setOpen(true);
        }}
        toolbar={
          <>
            <EnumFilter
              enumName="PurchasePaymentType"
              value={paymentType}
              onChange={(v) => {
                setPaymentType(v || undefined);
                setPage(1);
              }}
              allLabel={t('allPaymentTypes')}
            />
            {addButton}
            <span className="ml-auto text-muted-foreground">
              {t('total')}:{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {formatMoney(data?.totalAmount)}
              </span>
            </span>
          </>
        }
        emptyMessage={
          debounced || paymentType ? undefined : (
            <EmptyState message={t('empty')} action={addButton} />
          )
        }
      />
      <PurchaseDialog open={open} onOpenChange={setOpen} purchase={editing} />
    </div>
  );
}
