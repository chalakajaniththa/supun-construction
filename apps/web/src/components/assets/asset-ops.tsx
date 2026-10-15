'use client';

import {
  type AllocationDto,
  type AssetDto,
  MAINTENANCE_TYPES,
  type MaintenanceDto,
  type MaintenanceType,
  type Paginated,
  type ServiceStatusDto,
  type SupplierDto,
  type UsageLogDto,
  colomboTime,
  shiftDay,
} from '@sc/shared';
import { CalendarDays, Pencil, Plus, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteButton } from '@/components/delete-button';
import { EntityPicker } from '@/components/entity-picker';
import { DateInput } from '@/components/forms/date-input';
import { EnumSelect, useEnumLabel } from '@/components/forms/enum-select';
import { FormField } from '@/components/forms/form-field';
import { MoneyInput } from '@/components/forms/money-input';
import { StatusChip, type ChipTone } from '@/components/status-chip';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { ApiError, api } from '@/lib/api-client';
import { formatDate, formatMoney, formatQty, todayInColombo } from '@/lib/format';

const SERVICE_TONES: Record<string, ChipTone> = {
  OK: 'success',
  DUE_SOON: 'warning',
  OVERDUE: 'danger',
  NOT_TRACKED: 'neutral',
};

/** "Service: due soon (25 hours left)" badge. */
export function ServiceBadge({ asset }: { asset: AssetDto }) {
  const t = useTranslations('assets.service');
  const { data } = useApi<ServiceStatusDto>('assets', `/assets/${asset.id}/service-status`);
  if (!data || data.state === 'NOT_TRACKED') return null;
  const unit = t(`units.${data.meterType === 'KM' ? 'KM' : 'HOURS'}`);
  const remaining = Number(data.remaining);
  return (
    <StatusChip tone={SERVICE_TONES[data.state]} className="gap-1">
      <Wrench className="size-3.5" aria-hidden />
      <span data-testid="service-state">
        {t(`state.${data.state}`)} ·{' '}
        {remaining >= 0
          ? t('left', { value: formatQty(data.remaining), unit })
          : t('over', { value: formatQty(String(-remaining)), unit })}
      </span>
    </StatusChip>
  );
}

/** Usage log of a machine: day, project, meters, hours, fuel. */
export function UsagePanel({ asset }: { asset: AssetDto }) {
  const t = useTranslations('assets.usage');
  const [page, setPage] = useState(1);
  const { data } = useApi<
    Paginated<UsageLogDto> & { totals: { hours: string; fuelLitres: string; fuelCost: string } }
  >('assets', `/assets/${asset.id}/usage`, { page, pageSize: 20 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        {data ? (
          <p className="text-muted-foreground" data-testid="usage-totals">
            {t('totals', {
              hours: formatQty(data.totals.hours, 1),
              litres: formatQty(data.totals.fuelLitres, 1),
              cost: formatMoney(data.totals.fuelCost),
            })}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {!data?.items.length ? (
          <p className="py-6 text-center text-muted-foreground">{t('empty')}</p>
        ) : (
          <>
            <Table data-testid="usage-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-normal">{t('date')}</TableHead>
                  <TableHead className="whitespace-normal">{t('project')}</TableHead>
                  {asset.meterType !== 'NONE' ? (
                    <>
                      <TableHead className="text-right whitespace-normal">{t('start')}</TableHead>
                      <TableHead className="text-right whitespace-normal">{t('end')}</TableHead>
                    </>
                  ) : null}
                  <TableHead className="text-right whitespace-normal">{t('hours')}</TableHead>
                  <TableHead className="text-right whitespace-normal">{t('fuel')}</TableHead>
                  <TableHead className="text-right whitespace-normal">{t('fuelCost')}</TableHead>
                  <TableHead className="whitespace-normal">{t('operator')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(u.date)}</TableCell>
                    <TableCell className="whitespace-normal">{u.project?.name ?? '—'}</TableCell>
                    {asset.meterType !== 'NONE' ? (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {formatQty(u.startMeter)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatQty(u.endMeter)}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell className="text-right tabular-nums">
                      {formatQty(u.hoursUsed)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {u.fuelLitres ? `${formatQty(u.fuelLitres)} L` : '—'}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {u.fuelCost ? formatMoney(u.fuelCost) : '—'}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {u.operator?.fullName ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pages > 1 ? (
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {t('newer')}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {pages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('older')}
                </Button>
              </div>
            ) : null}
          </>
        )}
        <p className="mt-3 text-sm text-muted-foreground">{t('help')}</p>
      </CardContent>
    </Card>
  );
}

function MaintenanceDialog({
  open,
  onOpenChange,
  asset,
  record,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  asset: AssetDto;
  record: MaintenanceDto | null;
}) {
  const t = useTranslations('assets.maintenance');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const init = () => ({
    date: record?.date.slice(0, 10) ?? todayInColombo(),
    type: (record?.type ?? 'SERVICE') as MaintenanceType,
    description: record?.description ?? '',
    meterReading: record?.meterReading
      ? String(Number(record.meterReading))
      : asset.meterType === 'NONE'
        ? ''
        : String(Number(asset.currentMeter)),
    cost: record?.cost ?? '',
    supplierId: record?.supplierId ?? '',
    supplierLabel: record?.supplier?.name,
    nextServiceMeter: record?.nextServiceMeter ? String(Number(record.nextServiceMeter)) : '',
  });
  const [form, setForm] = useState(init);
  const [key, setKey] = useState({ open, record });
  if (key.open !== open || key.record !== record) {
    setKey({ open, record });
    setForm(init());
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ReturnType<typeof init>>) => setForm((f) => ({ ...f, ...patch }));
  const num = (v: string) => v === '' || /^\d*(\.\d{0,3})?$/.test(v);
  const save = async () => {
    if (!form.description.trim()) {
      setErrors({ description: 'REQUIRED' });
      return;
    }
    setErrors({});
    setSaving(true);
    const { supplierLabel: _s, ...body } = form;
    try {
      if (record)
        await api(`/assets/${asset.id}/maintenance/${record.id}`, { method: 'PATCH', body });
      else await api(`/assets/${asset.id}/maintenance`, { method: 'POST', body });
      await invalidate('assets');
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
      <DialogContent className="sm:max-w-xl" data-testid="maintenance-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{record ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="mnt-date" label={t('fields.date')}>
            <DateInput
              id="mnt-date"
              value={form.date}
              onChange={(v) => set({ date: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="mnt-type" label={t('fields.type')}>
            <EnumSelect
              id="mnt-type"
              enumName="MaintenanceType"
              values={MAINTENANCE_TYPES}
              value={form.type}
              onChange={(v) => set({ type: v as MaintenanceType })}
            />
          </FormField>
          <FormField
            id="mnt-description"
            label={t('fields.description')}
            error={errors.description ? { message: errors.description } : undefined}
            className="sm:col-span-2"
          >
            <Input
              id="mnt-description"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          {asset.meterType !== 'NONE' ? (
            <FormField
              id="mnt-meter"
              label={t('fields.meterReading')}
              description={form.type === 'SERVICE' ? t('serviceHint') : undefined}
            >
              <Input
                id="mnt-meter"
                inputMode="decimal"
                value={form.meterReading}
                onChange={(e) => num(e.target.value) && set({ meterReading: e.target.value })}
                className="h-11 text-right text-base tabular-nums"
              />
            </FormField>
          ) : null}
          <FormField id="mnt-cost" label={t('fields.cost')}>
            <MoneyInput
              id="mnt-cost"
              value={form.cost}
              onChange={(v) => set({ cost: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="mnt-supplier" label={t('fields.supplier')} className="sm:col-span-2">
            <EntityPicker<SupplierDto>
              id="mnt-supplier"
              resource="suppliers"
              value={form.supplierId}
              selectedLabel={form.supplierLabel}
              onChange={(id, row) => set({ supplierId: id, supplierLabel: row?.name })}
              toItem={(s) => ({ id: s.id, label: s.name, hint: s.code })}
              allowClear
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
            data-testid="maintenance-save"
          >
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Services, repairs and tyres of a machine. A service resets the service counter. */
export function MaintenancePanel({ asset }: { asset: AssetDto }) {
  const t = useTranslations('assets.maintenance');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const { data } = useApi<MaintenanceDto[]>('assets', `/assets/${asset.id}/maintenance`);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceDto | null>(null);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-lg">{t('title')}</CardTitle>
          <ServiceBadge asset={asset} />
        </div>
        <Button
          size="lg"
          className="h-11 text-base"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          data-testid="add-maintenance"
        >
          <Plus aria-hidden />
          {t('add')}
        </Button>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <p className="py-6 text-center text-muted-foreground">{t('empty')}</p>
        ) : (
          <Table data-testid="maintenance-table">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-normal">{t('fields.date')}</TableHead>
                <TableHead className="whitespace-normal">{t('fields.type')}</TableHead>
                <TableHead className="whitespace-normal">{t('fields.description')}</TableHead>
                {asset.meterType !== 'NONE' ? (
                  <TableHead className="text-right whitespace-normal">
                    {t('fields.meterReading')}
                  </TableHead>
                ) : null}
                <TableHead className="text-right whitespace-normal">{t('fields.cost')}</TableHead>
                <TableHead className="whitespace-normal">{t('fields.supplier')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(m.date)}</TableCell>
                  <TableCell>
                    <StatusChip tone={m.type === 'SERVICE' ? 'info' : 'neutral'}>
                      {enumLabel('MaintenanceType', m.type)}
                    </StatusChip>
                  </TableCell>
                  <TableCell className="whitespace-normal">{m.description}</TableCell>
                  {asset.meterType !== 'NONE' ? (
                    <TableCell className="text-right tabular-nums">
                      {formatQty(m.meterReading)}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(m.cost)}
                  </TableCell>
                  <TableCell className="whitespace-normal">{m.supplier?.name ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        aria-label={t('edit')}
                        onClick={() => {
                          setEditing(m);
                          setOpen(true);
                        }}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <DeleteButton
                        variant="ghost"
                        iconOnly
                        description={t('deleteConfirm')}
                        onDelete={async () => {
                          await api(`/assets/${asset.id}/maintenance/${m.id}`, {
                            method: 'DELETE',
                          });
                          await invalidate('assets');
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <MaintenanceDialog open={open} onOpenChange={setOpen} asset={asset} record={editing} />
    </Card>
  );
}

/** Bookings of a machine from a week ago to a month ahead. */
export function AssetAllocationsPanel({ asset }: { asset: AssetDto }) {
  const t = useTranslations('assets.allocations');
  const today = todayInColombo();
  const { data } = useApi<AllocationDto[]>('allocations', '/allocations', {
    kind: 'asset',
    assetId: asset.id,
    from: shiftDay(today, -7),
    to: shiftDay(today, 30),
  });
  return <AllocationTable title={t('title')} help={t('help')} rows={data} kind="asset" />;
}

/** A simple list of bookings (used on asset and project pages). */
export function AllocationTable({
  title,
  help,
  rows,
  kind,
  showProject = true,
  actions,
}: {
  title: string;
  help?: string;
  rows: AllocationDto[] | undefined;
  kind: 'worker' | 'asset';
  showProject?: boolean;
  actions?: React.ReactNode;
}) {
  const t = useTranslations('schedule');
  const today = todayInColombo();
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {actions}
          <Button asChild variant="outline" size="lg" className="h-11 text-base">
            <Link href="/schedule">
              <CalendarDays aria-hidden />
              {t('openSchedule')}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!rows?.length ? (
          <p className="py-6 text-center text-muted-foreground">{t('noBookings')}</p>
        ) : (
          <Table data-testid={`allocations-${kind}`}>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-normal">{t('fields.date')}</TableHead>
                <TableHead className="whitespace-normal">{t('fields.time')}</TableHead>
                {showProject ? (
                  <TableHead className="whitespace-normal">{t('fields.project')}</TableHead>
                ) : null}
                <TableHead className="whitespace-normal">
                  {kind === 'worker' ? t('worker') : t('machine')}
                </TableHead>
                {kind === 'asset' ? (
                  <TableHead className="whitespace-normal">{t('fields.operator')}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const day = a.startAt;
                return (
                  <TableRow
                    key={a.id}
                    className={day.slice(0, 10) < today ? 'text-muted-foreground' : undefined}
                  >
                    <TableCell className="whitespace-nowrap">{formatDate(day)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {colomboTime(a.startAt)}–{colomboTime(a.endAt)}
                    </TableCell>
                    {showProject ? (
                      <TableCell className="whitespace-normal">{a.project.name}</TableCell>
                    ) : null}
                    <TableCell>{a.worker?.fullName ?? a.asset?.name}</TableCell>
                    {kind === 'asset' ? <TableCell>{a.operator?.fullName ?? '—'}</TableCell> : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {help ? <p className="mt-3 text-sm text-muted-foreground">{help}</p> : null}
      </CardContent>
    </Card>
  );
}
