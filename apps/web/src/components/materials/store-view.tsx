'use client';

import {
  type MaterialDto,
  type Paginated,
  type ProjectDto,
  type StockDto,
  type StoreIssueDto,
} from '@sc/shared';
import { PackageMinus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { type DataTableColumn, DataTable } from '@/components/data-table/data-table';
import { DeleteButton } from '@/components/delete-button';
import { EntityPicker } from '@/components/entity-picker';
import { DateInput } from '@/components/forms/date-input';
import { FormField } from '@/components/forms/form-field';
import { projectItem } from '@/components/schedule/allocation-dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useDebounced } from '@/hooks/use-list-state';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { ApiError, api } from '@/lib/api-client';
import { formatDate, formatMoney, formatQty, todayInColombo } from '@/lib/format';

/** Issue material from the main store to a project (unit cost = store average). */
export function IssueDialog({
  open,
  onOpenChange,
  material,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  material: { id: string; name: string; unit: string; stock?: string } | null;
}) {
  const t = useTranslations('store');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const init = () => ({
    materialId: material?.id ?? '',
    materialLabel: material?.name,
    unit: material?.unit,
    projectId: '',
    projectLabel: undefined as string | undefined,
    date: todayInColombo(),
    quantity: '',
    notes: '',
  });
  const [form, setForm] = useState(init);
  const [key, setKey] = useState({ open, material });
  if (key.open !== open || key.material !== material) {
    setKey({ open, material });
    setForm(init());
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ReturnType<typeof init>>) => setForm((f) => ({ ...f, ...patch }));
  const { data: stock } = useApi<StockDto>('store', '/store/stock', undefined, { enabled: open });
  const available = stock?.items.find((s) => s.materialId === form.materialId);

  const save = async () => {
    const local: Record<string, string> = {};
    if (!form.materialId) local.materialId = 'REQUIRED';
    if (!form.projectId) local.projectId = 'REQUIRED';
    if (!form.quantity || Number(form.quantity) <= 0) local.quantity = 'MUST_BE_POSITIVE';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const { materialLabel: _m, projectLabel: _p, unit: _u, ...body } = form;
      await api('/store/issues', { method: 'POST', body });
      await invalidate('store');
      toast.success(t('issued'));
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INSUFFICIENT_STOCK') {
        const d = e.details as { available?: string };
        setErrors({ quantity: 'INSUFFICIENT_STOCK' });
        toast.error(
          t('notEnough', { available: formatQty(d?.available ?? '0'), unit: form.unit ?? '' }),
        );
      } else if (e instanceof ApiError && Array.isArray(e.details) && e.details.length) {
        const next: Record<string, string> = {};
        for (const d of e.details as { path: string; message: string }[]) next[d.path] = d.message;
        setErrors(next);
      } else toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const err = (k: string) => (errors[k] ? { message: errors[k] } : undefined);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="issue-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('issueTitle')}</DialogTitle>
          <DialogDescription>{t('issueDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField id="iss-material" label={t('fields.material')} error={err('materialId')}>
            <EntityPicker<MaterialDto>
              id="iss-material"
              resource="materials"
              value={form.materialId}
              selectedLabel={form.materialLabel}
              onChange={(id, row) =>
                set({ materialId: id, materialLabel: row?.name, unit: row?.unit })
              }
              toItem={(m) => ({ id: m.id, label: m.name, hint: m.unit })}
            />
          </FormField>
          {form.materialId ? (
            <p className="-mt-2 text-sm text-muted-foreground" data-testid="issue-available">
              {t('inStore', { qty: formatQty(available?.stock ?? '0'), unit: form.unit ?? '' })}
              {available ? ` · ${t('avgCost', { cost: formatMoney(available.averageCost) })}` : ''}
            </p>
          ) : null}
          <FormField id="iss-project" label={t('fields.project')} error={err('projectId')}>
            <EntityPicker<ProjectDto>
              id="iss-project"
              resource="projects"
              value={form.projectId}
              selectedLabel={form.projectLabel}
              onChange={(id, row) => set({ projectId: id, projectLabel: row?.name })}
              toItem={projectItem}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="iss-date" label={t('fields.date')}>
              <DateInput
                id="iss-date"
                value={form.date}
                onChange={(v) => set({ date: v })}
                className="h-11 text-base"
              />
            </FormField>
            <FormField
              id="iss-qty"
              label={`${t('fields.quantity')}${form.unit ? ` (${form.unit})` : ''}`}
              error={err('quantity')}
            >
              <Input
                id="iss-qty"
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => {
                  const v = e.target.value.replace(/,/g, '').trim();
                  if (v === '' || /^\d*(\.\d{0,3})?$/.test(v)) set({ quantity: v });
                }}
                className="h-11 text-right text-base tabular-nums"
              />
            </FormField>
          </div>
          <FormField id="iss-notes" label={t('fields.notes')}>
            <Input
              id="iss-notes"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
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
            data-testid="issue-save"
          >
            {saving ? tc('saving') : t('issue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Purchases & Store → Store: what is in the main store and its value. */
export function StoreStock() {
  const t = useTranslations('store');
  const { data, isLoading } = useApi<StockDto>('store', '/store/stock');
  const [issue, setIssue] = useState<{ id: string; name: string; unit: string } | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground">{t('stockHelp')}</p>
          <div className="flex items-center gap-4">
            <p>
              {t('totalValue')}:{' '}
              <span className="text-lg font-semibold tabular-nums" data-testid="stock-value">
                {formatMoney(data?.totalValue)}
              </span>
            </p>
            <Button
              size="lg"
              className="h-11 text-base"
              onClick={() => {
                setIssue(null);
                setOpen(true);
              }}
              data-testid="issue-open"
            >
              <PackageMinus aria-hidden />
              {t('issueToProject')}
            </Button>
          </div>
        </div>
        {isLoading ? null : !data?.items.length ? (
          <p className="py-6 text-center text-muted-foreground">{t('emptyStock')}</p>
        ) : (
          <Table data-testid="stock-table">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-normal">{t('fields.material')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('bought')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('issuedQty')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('inStoreQty')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('averageCost')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('value')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((s) => (
                <TableRow key={s.materialId} data-testid={`stock-${s.name}`}>
                  <TableCell>
                    <p className="font-medium">{s.name}</p>
                    {s.nameSinhala ? (
                      <p className="text-sm text-muted-foreground">{s.nameSinhala}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQty(s.purchasedQty)} {s.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQty(s.issuedQty)} {s.unit}
                  </TableCell>
                  <TableCell
                    className="text-right font-semibold tabular-nums"
                    data-testid="stock-qty"
                  >
                    {formatQty(s.stock)} {s.unit}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(s.averageCost)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(s.value)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="lg"
                      disabled={Number(s.stock) <= 0}
                      onClick={() => {
                        setIssue({ id: s.materialId, name: s.name, unit: s.unit });
                        setOpen(true);
                      }}
                    >
                      <PackageMinus aria-hidden />
                      {t('issue')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <IssueDialog open={open} onOpenChange={setOpen} material={issue} />
    </Card>
  );
}

/** Purchases & Store → Issues: what went from the store to which project. */
export function IssuesList() {
  const t = useTranslations('store');
  const invalidate = useInvalidate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { data, isLoading } = useApi<Paginated<StoreIssueDto>>('store', '/store/issues', {
    page,
    pageSize: 20,
    search: debounced || undefined,
  });
  const [open, setOpen] = useState(false);
  const columns: DataTableColumn<StoreIssueDto>[] = [
    {
      id: 'date',
      header: t('fields.date'),
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
    },
    {
      id: 'material',
      header: t('fields.material'),
      cell: ({ row }) => <span className="font-medium">{row.original.material.name}</span>,
    },
    { id: 'project', header: t('fields.project'), cell: ({ row }) => row.original.project.name },
    {
      id: 'qty',
      header: () => <span className="block text-right">{t('fields.quantity')}</span>,
      cell: ({ row }) => (
        <span className="block text-right tabular-nums">
          {formatQty(row.original.quantity)} {row.original.material.unit}
        </span>
      ),
    },
    {
      id: 'unitCost',
      header: () => <span className="block text-right">{t('unitCost')}</span>,
      cell: ({ row }) => (
        <span className="block text-right whitespace-nowrap tabular-nums">
          {formatMoney(row.original.unitCost)}
        </span>
      ),
    },
    {
      id: 'amount',
      header: () => <span className="block text-right">{t('amount')}</span>,
      cell: ({ row }) => (
        <span className="block text-right font-medium whitespace-nowrap tabular-nums">
          {formatMoney(row.original.amount)}
        </span>
      ),
    },
    { id: 'notes', header: t('fields.notes'), cell: ({ row }) => row.original.notes ?? '—' },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('undo')}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DeleteButton
            variant="ghost"
            label={t('undo')}
            description={t('undoConfirm')}
            onDelete={async () => {
              await api(`/store/issues/${row.original.id}`, { method: 'DELETE' });
              await invalidate('store');
            }}
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
        page={page}
        onPageChange={setPage}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        isLoading={isLoading}
        getRowId={(i) => i.id}
        toolbar={
          <Button size="lg" className="h-11 text-base" onClick={() => setOpen(true)}>
            <PackageMinus aria-hidden />
            {t('issueToProject')}
          </Button>
        }
        emptyMessage={t('emptyIssues')}
      />
      <IssueDialog open={open} onOpenChange={setOpen} material={null} />
    </>
  );
}
