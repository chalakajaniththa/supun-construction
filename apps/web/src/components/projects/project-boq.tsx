'use client';

import type {
  BoqImportPreviewDto,
  BoqItemDto,
  MeasurementDto,
  ProgressDto,
  VariationDto,
} from '@sc/shared';
import { ClipboardCheck, History, Pencil, Plus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteButton } from '@/components/delete-button';
import { DateInput } from '@/components/forms/date-input';
import { FormField } from '@/components/forms/form-field';
import { MoneyInput } from '@/components/forms/money-input';
import { ProgressBar } from '@/components/progress-triple';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useErrorMessage, useValidationMessage } from '@/hooks/use-error-message';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { ApiError, api } from '@/lib/api-client';
import { formatDate, formatMoney, formatPercent, formatQty, todayInColombo } from '@/lib/format';
import { uploadWithProgress } from '@/lib/upload';

const QTY_PATTERN = /^\d*(\.\d{0,3})?$/;

function QtyInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> & {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/,/g, '').trim();
        if (v === '' || QTY_PATTERN.test(v)) onChange(v);
      }}
      className="h-11 text-right text-base tabular-nums"
      {...props}
    />
  );
}

function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const errorMessage = useErrorMessage();
  const handle = (e: unknown) => {
    if (e instanceof ApiError && Array.isArray(e.details) && e.details.length) {
      const next: Record<string, string> = {};
      for (const d of e.details as { path: string; message: string }[]) next[d.path] = d.message;
      setErrors(next);
    } else toast.error(errorMessage(e));
  };
  const err = (k: string) => (errors[k] ? { message: errors[k] } : undefined);
  return { setErrors, handle, err };
}

function ItemDialog({
  projectId,
  item,
  open,
  onOpenChange,
  variations,
}: {
  projectId: string;
  item: BoqItemDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  variations: VariationDto[];
}) {
  const t = useTranslations('boq');
  const tc = useTranslations('common');
  const invalidate = useInvalidate();
  const { setErrors, handle, err } = useFieldErrors();
  const init = () => ({
    itemNo: item?.itemNo ?? '',
    description: item?.description ?? '',
    unit: item?.unit ?? '',
    quantity: item?.quantity ?? '',
    rate: item?.rate ?? '',
    variationId: item?.variationId ?? '',
  });
  const [form, setForm] = useState(init);
  const [key, setKey] = useState({ open, item });
  if (key.open !== open || key.item !== item) {
    setKey({ open, item });
    setForm(init());
    setErrors({});
  }
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, variationId: form.variationId || null };
      if (item) await api(`/projects/${projectId}/boq/${item.id}`, { method: 'PATCH', body });
      else await api(`/projects/${projectId}/boq`, { method: 'POST', body });
      await invalidate('projects');
      toast.success(t('itemSaved'));
      onOpenChange(false);
    } catch (e) {
      handle(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="boq-item-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{item ? t('editItem') : t('addItem')}</DialogTitle>
          <DialogDescription>{t('itemHelp')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-4">
          <FormField id="boq-no" label={t('cols.itemNo')} error={err('itemNo')}>
            <Input
              id="boq-no"
              value={form.itemNo}
              onChange={(e) => setForm({ ...form, itemNo: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField
            id="boq-desc"
            label={t('cols.description')}
            error={err('description')}
            className="sm:col-span-3"
          >
            <Input
              id="boq-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="boq-unit" label={t('cols.unit')} error={err('unit')}>
            <Input
              id="boq-unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="boq-qty" label={t('cols.quantity')} error={err('quantity')}>
            <QtyInput
              id="boq-qty"
              value={form.quantity}
              onChange={(v) => setForm({ ...form, quantity: v })}
            />
          </FormField>
          <FormField
            id="boq-rate"
            label={t('cols.rate')}
            error={err('rate')}
            className="sm:col-span-2"
          >
            <MoneyInput
              id="boq-rate"
              value={form.rate}
              onChange={(v) => setForm({ ...form, rate: v })}
              className="h-11 text-base"
            />
          </FormField>
          {variations.length ? (
            <FormField
              id="boq-var"
              label={t('variation')}
              description={t('variationHelp')}
              className="sm:col-span-4"
            >
              <Select
                value={form.variationId || 'none'}
                onValueChange={(v) => setForm({ ...form, variationId: v === 'none' ? '' : v })}
              >
                <SelectTrigger id="boq-var" className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noVariation')}</SelectItem>
                  {variations.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {t('variationLabel', { n: v.number, title: v.title })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}
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
            data-testid="boq-item-save"
          >
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  projectId,
  open,
  onOpenChange,
  canReplace,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canReplace: boolean;
}) {
  const t = useTranslations('boq.import');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const validation = useValidationMessage();
  const invalidate = useInvalidate();
  const [preview, setPreview] = useState<BoqImportPreviewDto | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setPreview(null);
    setReplace(false);
  }
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      setPreview(
        await uploadWithProgress<BoqImportPreviewDto>(
          `/projects/${projectId}/boq/import/preview`,
          {},
          file,
        ),
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const rows = preview.rows
        .filter((r) => !r.errors.length)
        .map(({ itemNo, description, unit, quantity, rate }) => ({
          itemNo,
          description,
          unit,
          quantity,
          rate,
        }));
      await api(`/projects/${projectId}/boq/import`, { method: 'POST', body: { rows, replace } });
      await invalidate('projects');
      toast.success(t('done', { n: rows.length }));
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" data-testid="boq-import-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('title')}</DialogTitle>
          <DialogDescription>{t('help')}</DialogDescription>
        </DialogHeader>
        {!preview ? (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/40">
            <Upload className="size-8 text-muted-foreground" aria-hidden />
            <span className="font-medium">{busy ? t('reading') : t('choose')}</span>
            <span className="text-sm text-muted-foreground">{t('columns')}</span>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
              data-testid="boq-import-file"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-3">
            <p data-testid="boq-import-summary">
              {t('summary', {
                file: preview.fileName,
                ok: preview.validCount,
                bad: preview.errorCount,
                total: formatMoney(preview.total),
              })}
            </p>
            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('line')}</TableHead>
                    <TableHead>{t('cols.itemNo')}</TableHead>
                    <TableHead className="whitespace-normal">{t('cols.description')}</TableHead>
                    <TableHead>{t('cols.unit')}</TableHead>
                    <TableHead className="text-right">{t('cols.quantity')}</TableHead>
                    <TableHead className="text-right">{t('cols.rate')}</TableHead>
                    <TableHead className="text-right">{t('cols.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow
                      key={r.line}
                      className={r.errors.length ? 'bg-destructive/5' : undefined}
                    >
                      <TableCell className="tabular-nums">{r.line}</TableCell>
                      <TableCell>{r.itemNo}</TableCell>
                      <TableCell className="whitespace-normal">
                        {r.description}
                        {r.errors.map((e) => (
                          <span key={e.field} className="block text-sm text-destructive">
                            {t(`cols.${e.field}` as 'cols.itemNo')}: {validation(e.message)}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.rate}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.amount ? formatMoney(r.amount) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {preview.errorCount ? (
              <p className="text-sm text-muted-foreground">{t('skipBad')}</p>
            ) : null}
            {canReplace ? (
              <label className="flex items-center gap-3">
                <Switch checked={replace} onCheckedChange={setReplace} />
                {t('replace')}
              </label>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            className="h-11 text-base"
            onClick={() => (preview ? setPreview(null) : onOpenChange(false))}
          >
            {preview ? t('chooseAnother') : tc('cancel')}
          </Button>
          <Button
            size="lg"
            className="h-11 min-w-32 text-base"
            onClick={confirm}
            disabled={busy || !preview?.validCount}
            data-testid="boq-import-confirm"
          >
            {t('confirm', { n: preview?.validCount ?? 0 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordProgressDialog({
  projectId,
  progress,
  open,
  onOpenChange,
}: {
  projectId: string;
  progress: ProgressDto | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('boq.record');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const [date, setDate] = useState(todayInColombo());
  const [values, setValues] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setValues({});
    setBad(new Set());
    setDate(todayInColombo());
  }
  const [saving, setSaving] = useState(false);
  const items = (progress?.items ?? []).filter((i) => !i.excluded || i.done !== '0.00');
  const changed = Object.entries(values).filter(([, v]) => v !== '');
  const save = async () => {
    setSaving(true);
    setBad(new Set());
    try {
      const res = await api<{ saved: number; warnings: { itemNo: string }[] }>(
        `/projects/${projectId}/progress`,
        {
          method: 'POST',
          body: {
            date,
            items: changed.map(([boqItemId, cumulativeQty]) => ({ boqItemId, cumulativeQty })),
          },
        },
      );
      await invalidate('projects');
      toast.success(t('saved', { n: res.saved }));
      if (res.warnings.length) {
        toast.warning(t('overQuantity', { items: res.warnings.map((w) => w.itemNo).join(', ') }));
      }
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'MEASUREMENT_OUT_OF_ORDER') {
        const items =
          (e.details as { items?: { boqItemId: string; itemNo: string }[] })?.items ?? [];
        setBad(new Set(items.map((i) => i.boqItemId)));
        toast.error(t('outOfOrder', { items: items.map((i) => i.itemNo).join(', ') }));
      } else toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" data-testid="record-progress-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('title')}</DialogTitle>
          <DialogDescription>{t('help')}</DialogDescription>
        </DialogHeader>
        <FormField id="rp-date" label={t('date')} className="max-w-64">
          <DateInput id="rp-date" value={date} onChange={setDate} className="h-11 text-base" />
        </FormField>
        <div className="max-h-[50vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('item')}</TableHead>
                <TableHead className="whitespace-normal">{t('description')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('boqQty')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('doneSoFar')}</TableHead>
                <TableHead className="w-40 whitespace-normal">{t('doneNow')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow
                  key={i.boqItemId}
                  className={bad.has(i.boqItemId) ? 'bg-destructive/10' : undefined}
                >
                  <TableCell className="font-medium">{i.itemNo}</TableCell>
                  <TableCell className="whitespace-normal">{i.description}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatQty(i.quantity)} {i.unit}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatQty(i.done)}
                  </TableCell>
                  <TableCell>
                    <QtyInput
                      aria-label={t('doneNowFor', { item: i.itemNo })}
                      value={values[i.boqItemId] ?? ''}
                      placeholder={formatQty(i.done)}
                      onChange={(v) => setValues({ ...values, [i.boqItemId]: v })}
                      data-testid={`progress-input-${i.itemNo}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            disabled={saving || !changed.length}
            data-testid="record-progress-save"
          >
            {saving ? tc('saving') : t('save', { n: changed.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  item,
  onOpenChange,
}: {
  item: BoqItemDto | null;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('boq.history');
  const invalidate = useInvalidate();
  const { data } = useApi<MeasurementDto[]>(
    'projects',
    `/boq/${item?.id}/measurements`,
    undefined,
    {
      enabled: Boolean(item),
      keepPrevious: false,
    },
  );
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('title', { item: item?.itemNo ?? '' })}</DialogTitle>
          <DialogDescription>{item?.description}</DialogDescription>
        </DialogHeader>
        {!data?.length ? (
          <p className="py-4 text-center text-muted-foreground">{t('empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead className="text-right">{t('qty')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDate(m.date)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQty(m.cumulativeQty)} {item?.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteButton
                      variant="ghost"
                      iconOnly
                      description={t('deleteConfirm', { date: formatDate(m.date) })}
                      onDelete={async () => {
                        await api(`/boq/${item!.id}/measurements/${m.id}`, { method: 'DELETE' });
                        await invalidate('projects');
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** BOQ & progress tab. */
export function ProjectBoq({ projectId }: { projectId: string }) {
  const t = useTranslations('boq');
  const invalidate = useInvalidate();
  const { data: items } = useApi<BoqItemDto[]>('projects', `/projects/${projectId}/boq`);
  const { data: progress } = useApi<ProgressDto>('projects', `/projects/${projectId}/progress`);
  const { data: variations } = useApi<VariationDto[]>(
    'projects',
    `/projects/${projectId}/variations`,
  );
  const [dialog, setDialog] = useState<'item' | 'import' | 'record' | null>(null);
  const [editing, setEditing] = useState<BoqItemDto | null>(null);
  const [history, setHistory] = useState<BoqItemDto | null>(null);
  const byId = new Map((progress?.items ?? []).map((p) => [p.boqItemId, p]));
  const hasProgress = (items ?? []).some((i) => i.measurementCount > 0);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6">
          <div className="min-w-64 flex-1">
            <p className="text-sm text-muted-foreground">
              {t('physical', { date: formatDate(progress?.asOf) })}
            </p>
            <div className="mt-1 flex items-center gap-3">
              <ProgressBar
                value={progress?.physicalPct}
                tone="success"
                className="h-3"
                label={t('physicalLabel')}
              />
              <span
                className="w-16 text-right text-2xl font-semibold tabular-nums"
                data-testid="physical-pct"
              >
                {progress ? formatPercent(progress.physicalPct) : '—'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('doneOfTotal', {
                done: formatMoney(progress?.totalDone),
                total: formatMoney(progress?.totalAmount),
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              className="h-11 text-base"
              onClick={() => setDialog('record')}
              disabled={!items?.length}
              data-testid="record-progress"
            >
              <ClipboardCheck aria-hidden />
              {t('recordProgress')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => setDialog('import')}
              data-testid="boq-import"
            >
              <Upload aria-hidden />
              {t('importBtn')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => {
                setEditing(null);
                setDialog('item');
              }}
              data-testid="boq-add-item"
            >
              <Plus aria-hidden />
              {t('addItem')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!items?.length ? (
            <p className="py-8 text-center text-muted-foreground">{t('empty')}</p>
          ) : (
            <Table data-testid="boq-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cols.itemNo')}</TableHead>
                  <TableHead className="whitespace-normal">{t('cols.description')}</TableHead>
                  <TableHead className="text-right whitespace-normal">
                    {t('cols.quantity')}
                  </TableHead>
                  <TableHead className="text-right whitespace-normal">{t('cols.rate')}</TableHead>
                  <TableHead className="text-right whitespace-normal">{t('cols.amount')}</TableHead>
                  <TableHead className="w-44 whitespace-normal">{t('cols.done')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const p = byId.get(it.id);
                  return (
                    <TableRow key={it.id} data-testid={`boq-row-${it.itemNo}`}>
                      <TableCell className="font-medium whitespace-nowrap">{it.itemNo}</TableCell>
                      <TableCell className="min-w-56 whitespace-normal">
                        {it.description}
                        {it.variation ? (
                          <span className="mt-1 block">
                            <StatusChip status={it.variation.status} className="text-xs">
                              {t('fromVariation', { n: it.variation.number })}
                            </StatusChip>
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {formatQty(it.quantity)} {it.unit}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {formatMoney(it.rate, { symbol: false })}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {formatMoney(it.amount, { symbol: false })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            value={p?.pct}
                            tone={Number(p?.pct ?? 0) > 100 ? 'warning' : 'success'}
                            label={it.itemNo}
                          />
                          <span
                            className="w-12 text-right text-sm tabular-nums"
                            data-testid="item-pct"
                          >
                            {formatPercent(p?.pct ?? '0', 0)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatQty(p?.done ?? '0')} {it.unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-lg"
                            aria-label={t('historyFor', { item: it.itemNo })}
                            onClick={() => setHistory(it)}
                          >
                            <History aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-lg"
                            aria-label={t('editItem')}
                            onClick={() => {
                              setEditing(it);
                              setDialog('item');
                            }}
                          >
                            <Pencil aria-hidden />
                          </Button>
                          {it.measurementCount === 0 ? (
                            <DeleteButton
                              variant="ghost"
                              iconOnly
                              description={t('deleteConfirm', { item: it.itemNo })}
                              onDelete={async () => {
                                await api(`/projects/${projectId}/boq/${it.id}`, {
                                  method: 'DELETE',
                                });
                                await invalidate('projects');
                              }}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ItemDialog
        projectId={projectId}
        item={editing}
        open={dialog === 'item'}
        onOpenChange={(o) => setDialog(o ? 'item' : null)}
        variations={variations ?? []}
      />
      <ImportDialog
        projectId={projectId}
        open={dialog === 'import'}
        onOpenChange={(o) => setDialog(o ? 'import' : null)}
        canReplace={Boolean(items?.length) && !hasProgress}
      />
      <RecordProgressDialog
        projectId={projectId}
        progress={progress}
        open={dialog === 'record'}
        onOpenChange={(o) => setDialog(o ? 'record' : null)}
      />
      <HistoryDialog item={history} onOpenChange={(o) => !o && setHistory(null)} />
    </div>
  );
}
