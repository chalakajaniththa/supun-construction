'use client';

import {
  type AssetDto,
  type AttendanceStatus,
  type CopyFromDto,
  type DailyEntryDto,
  EXPENSE_CATEGORIES,
  EXPENSE_PAID_BY,
  type ExpenseCategory,
  type ExpensePaidBy,
  type ProjectDto,
  type SupplierDto,
  type WorkerDto,
  subtractQty,
} from '@sc/shared';
import {
  AlertTriangle,
  CalendarCheck,
  ClipboardCopy,
  Lock,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { EntityPicker } from '@/components/entity-picker';
import { DateInput } from '@/components/forms/date-input';
import { EnumSelect, useEnumLabel } from '@/components/forms/enum-select';
import { MoneyInput } from '@/components/forms/money-input';
import { PageHeader } from '@/components/page-header';
import { projectItem, workerItem } from '@/components/schedule/allocation-dialogs';
import { Segmented } from '@/components/segmented';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorMessage, useValidationMessage } from '@/hooks/use-error-message';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { ApiError, api } from '@/lib/api-client';
import { sumStrings, toDec } from '@/lib/decimal';
import { formatDate, formatMoney, formatQty, todayInColombo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ReceiptButton } from './receipt-button';

// ── Form state ─────────────────────────────────────────────────────────

interface AttRow {
  workerId: string;
  code: string;
  fullName: string;
  nameSinhala: string | null;
  allocated: boolean;
  plannedTimes: string[];
  otherProject: { name: string } | null;
  status: AttendanceStatus | null;
  otHours: string;
  notes: string;
}

interface UseRow {
  key: string;
  id: string | null;
  assetId: string;
  code: string;
  name: string;
  meterType: 'HOURS' | 'KM' | 'NONE';
  currentMeter: string;
  allocated: boolean;
  plannedTimes: string[];
  startMeter: string;
  endMeter: string;
  hoursUsed: string;
  fuelLitres: string;
  fuelCost: string;
  operatorWorkerId: string;
  operatorLabel?: string;
  notes: string;
}

interface ExpRow {
  key: string;
  id: string | null;
  category: ExpenseCategory | '';
  description: string;
  amount: string;
  paidBy: ExpensePaidBy;
  supplierId: string;
  supplierLabel?: string;
  receiptDocumentId: string | null;
}

interface FormState {
  attendance: AttRow[];
  usage: UseRow[];
  expenses: ExpRow[];
}

let keySeq = 0;
const newKey = () => `new-${++keySeq}`;
/** "1000.000" → "1000" (inputs show plain numbers). */
const plain = (v: string | null | undefined) => (v ? toDec(v).toString() : '');

function fromDto(d: DailyEntryDto): FormState {
  return {
    attendance: d.workers.map((w) => ({
      workerId: w.workerId,
      code: w.code,
      fullName: w.fullName,
      nameSinhala: w.nameSinhala,
      allocated: w.allocated,
      plannedTimes: w.plannedTimes,
      otherProject: w.attendance ? null : w.otherProject,
      status: w.attendance?.status ?? null,
      otHours: w.attendance && toDec(w.attendance.otHours).gt(0) ? plain(w.attendance.otHours) : '',
      notes: w.attendance?.notes ?? '',
    })),
    usage: d.usage.map((u) => ({
      key: u.id ?? `planned-${u.assetId}`,
      id: u.id,
      assetId: u.assetId,
      code: u.code,
      name: u.name,
      meterType: u.meterType,
      currentMeter: plain(u.currentMeter),
      allocated: u.allocated,
      plannedTimes: u.plannedTimes,
      startMeter: u.id ? plain(u.startMeter) : u.meterType === 'NONE' ? '' : plain(u.currentMeter),
      endMeter: plain(u.endMeter),
      hoursUsed: u.id ? plain(u.hoursUsed) : '',
      fuelLitres: plain(u.fuelLitres),
      fuelCost: u.fuelCost ? toDec(u.fuelCost).toFixed(2) : '',
      operatorWorkerId: u.operatorWorkerId ?? '',
      operatorLabel: u.operatorName ?? undefined,
      notes: u.notes ?? '',
    })),
    expenses: d.expenses.map((e) => ({
      key: e.id,
      id: e.id,
      category: e.category,
      description: e.description,
      amount: toDec(e.amount).toFixed(2),
      paidBy: e.paidBy,
      supplierId: e.supplierId ?? '',
      supplierLabel: e.supplier?.name,
      receiptDocumentId: e.receiptDocumentId,
    })),
  };
}

/** Hours from the hour meter, or what was typed. */
function rowHours(u: UseRow): string {
  if (u.meterType === 'HOURS' && u.startMeter && u.endMeter) {
    const d = subtractQty(u.endMeter, u.startMeter);
    return d.startsWith('-') ? '' : d;
  }
  return u.hoursUsed;
}

const usageFilled = (u: UseRow) =>
  Boolean(u.id || u.endMeter || u.hoursUsed || u.fuelLitres || u.fuelCost);
const expenseFilled = (e: ExpRow) => Boolean(e.id || e.description || e.amount || e.category);

function toBody(date: string, projectId: string, f: FormState) {
  return {
    date,
    projectId,
    attendance: f.attendance
      .filter((a) => a.status)
      .map((a) => ({
        workerId: a.workerId,
        status: a.status,
        otHours: a.otHours,
        notes: a.notes,
      })),
    usage: f.usage.filter(usageFilled).map((u) => ({
      id: u.id ?? undefined,
      assetId: u.assetId,
      startMeter: u.meterType === 'NONE' ? '' : u.startMeter,
      endMeter: u.meterType === 'NONE' ? '' : u.endMeter,
      hoursUsed: rowHours(u),
      fuelLitres: u.fuelLitres,
      fuelCost: u.fuelCost,
      operatorWorkerId: u.operatorWorkerId,
      notes: u.notes,
    })),
    expenses: f.expenses.filter(expenseFilled).map((e) => ({
      id: e.id ?? undefined,
      category: e.category,
      description: e.description,
      amount: e.amount,
      paidBy: e.paidBy,
      supplierId: e.supplierId,
      receiptDocumentId: e.receiptDocumentId ?? '',
    })),
  };
}

const LAST_PROJECT_KEY = 'daily.projectId';

// ── Page ───────────────────────────────────────────────────────────────

/** Daily Entry: one screen to record a day at a site — attendance, machines and expenses. */
export function DailyEntryView() {
  const t = useTranslations('daily');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = todayInColombo();
  const date = params.get('date') || today;
  const projectId = params.get('project') ?? '';

  // Re-open the last project when the page is opened without one.
  useEffect(() => {
    if (projectId) return;
    let last: string | null = null;
    try {
      last = window.localStorage.getItem(LAST_PROJECT_KEY);
    } catch {
      last = null;
    }
    if (last) router.replace(`${pathname}?date=${date}&project=${last}`);
  }, [projectId, date, pathname, router]);

  const go = (next: { date?: string; project?: string }) => {
    const p = next.project ?? projectId;
    if (next.project) {
      try {
        window.localStorage.setItem(LAST_PROJECT_KEY, next.project);
      } catch {
        // private window — not remembered, that is fine
      }
    }
    router.replace(`${pathname}?date=${next.date ?? date}${p ? `&project=${p}` : ''}`);
  };

  // Bumped after a save so the form restarts from the freshly saved data.
  const [version, setVersion] = useState(0);
  const { data, error } = useApi<DailyEntryDto>(
    'daily-entry',
    '/daily-entry',
    { date, projectId },
    { enabled: Boolean(projectId), keepPrevious: false },
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex w-56 flex-col gap-1.5">
            <label htmlFor="daily-date" className="text-[0.95rem] font-medium">
              {t('date')}
            </label>
            <DateInput
              id="daily-date"
              value={date}
              onChange={(v) => go({ date: v })}
              className="h-11 text-base"
            />
          </div>
          <div className="flex min-w-72 flex-1 flex-col gap-1.5">
            <label htmlFor="daily-project" className="text-[0.95rem] font-medium">
              {t('project')}
            </label>
            <EntityPicker<ProjectDto>
              id="daily-project"
              resource="projects"
              params={{ status: 'ONGOING' }}
              value={projectId}
              selectedLabel={data?.project.name}
              onChange={(id) => id && go({ project: id })}
              toItem={projectItem}
              placeholder={t('chooseProject')}
            />
          </div>
          {date !== today ? (
            <Button
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => go({ date: today })}
            >
              <CalendarCheck aria-hidden />
              {t('today')}
            </Button>
          ) : null}
        </CardContent>
      </Card>
      {!projectId ? (
        <Card>
          <CardContent>
            <EmptyState message={t('pickProjectFirst')} />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent>
            <EmptyState message={t('loadFailed')} />
          </CardContent>
        </Card>
      ) : !data || data.date !== date || data.project.id !== projectId ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : (
        <DailyForm
          key={`${date}|${projectId}|${version}`}
          data={data}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}
    </>
  );
}

function DailyForm({ data, onSaved }: { data: DailyEntryDto; onSaved: () => void }) {
  const t = useTranslations('daily');
  const tc = useTranslations('common');
  const enumLabel = useEnumLabel();
  const errorMessage = useErrorMessage();
  const validation = useValidationMessage();
  const invalidate = useInvalidate();
  const [initial] = useState(() => fromDto(data));
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const locked = data.locked;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const setAtt = (workerId: string, patch: Partial<AttRow>) =>
    setForm((f) => ({
      ...f,
      attendance: f.attendance.map((a) => (a.workerId === workerId ? { ...a, ...patch } : a)),
    }));
  const setUse = (key: string, patch: Partial<UseRow>) =>
    setForm((f) => ({ ...f, usage: f.usage.map((u) => (u.key === key ? { ...u, ...patch } : u)) }));
  const setExp = (key: string, patch: Partial<ExpRow>) =>
    setForm((f) => ({
      ...f,
      expenses: f.expenses.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    }));

  const addWorker = (w: WorkerDto) => {
    if (form.attendance.some((a) => a.workerId === w.id)) return;
    setForm((f) => ({
      ...f,
      attendance: [
        ...f.attendance,
        {
          workerId: w.id,
          code: w.code,
          fullName: w.fullName,
          nameSinhala: w.nameSinhala,
          allocated: false,
          plannedTimes: [],
          otherProject: null,
          status: 'PRESENT',
          otHours: '',
          notes: '',
        },
      ],
    }));
  };
  const addAsset = (a: AssetDto) => {
    setForm((f) => ({
      ...f,
      usage: [
        ...f.usage,
        {
          key: newKey(),
          id: null,
          assetId: a.id,
          code: a.code,
          name: a.name,
          meterType: a.meterType,
          currentMeter: plain(a.currentMeter),
          allocated: false,
          plannedTimes: [],
          startMeter: a.meterType === 'NONE' ? '' : plain(a.currentMeter),
          endMeter: '',
          hoursUsed: '',
          fuelLitres: '',
          fuelCost: '',
          operatorWorkerId: '',
          notes: '',
        },
      ],
    }));
  };
  const addExpense = () =>
    setForm((f) => ({
      ...f,
      expenses: [
        ...f.expenses,
        {
          key: newKey(),
          id: null,
          category: '',
          description: '',
          amount: '',
          paidBy: 'CASH',
          supplierId: '',
          receiptDocumentId: null,
        },
      ],
    }));

  const markAllPresent = () =>
    setForm((f) => ({
      ...f,
      attendance: f.attendance.map((a) => (a.otherProject ? a : { ...a, status: 'PRESENT' })),
    }));

  const copyFromYesterday = async () => {
    try {
      const res = await api<CopyFromDto>('/daily-entry/copy-from', {
        query: { date: data.date, projectId: data.project.id },
      });
      if (!res.date) {
        toast.info(t('copyNothing'));
        return;
      }
      setForm((f) => {
        const rows = [...f.attendance];
        for (const c of res.attendance) {
          if (c.otherProject) continue;
          const i = rows.findIndex((r) => r.workerId === c.workerId);
          const patch = {
            status: c.status,
            otHours: toDec(c.otHours).gt(0) ? plain(c.otHours) : '',
          };
          if (i >= 0) rows[i] = { ...rows[i]!, ...patch };
          else
            rows.push({
              workerId: c.workerId,
              code: c.code,
              fullName: c.fullName,
              nameSinhala: c.nameSinhala,
              allocated: false,
              plannedTimes: [],
              otherProject: null,
              notes: '',
              ...patch,
            });
        }
        return { ...f, attendance: rows };
      });
      toast.success(t('copied', { date: formatDate(res.date) }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  /** Turns a row error path ("expenses.1.amount") into "Expenses, row 2: Please fill this in." */
  const describeError = (err: unknown): string => {
    if (err instanceof ApiError && err.code === 'ATTENDANCE_EXISTS_OTHER_PROJECT') {
      const c = (err.details as { conflicts?: { workerName: string; projectName: string }[] })
        ?.conflicts;
      return t('otherProjectError', {
        names: (c ?? []).map((x) => `${x.workerName} (${x.projectName})`).join(', '),
      });
    }
    if (err instanceof ApiError && Array.isArray(err.details) && err.details.length) {
      const d = err.details[0] as { path?: string; message?: string };
      const [section, index] = (d.path ?? '').split('.');
      const msg = validation(d.message) ?? errorMessage(err);
      if (section && index !== undefined && ['attendance', 'usage', 'expenses'].includes(section)) {
        return t('rowError', {
          section: t(`sections.${section}`),
          row: Number(index) + 1,
          message: msg,
        });
      }
      return msg;
    }
    return errorMessage(err);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api('/daily-entry', { method: 'PUT', body: toBody(data.date, data.project.id, form) });
      toast.success(t('savedOk'));
      await invalidate('daily-entry', 'assets', 'expenses', 'attendance');
      onSaved();
    } catch (err) {
      toast.error(describeError(err), { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const present = form.attendance.filter((a) => a.status === 'PRESENT').length;
  const half = form.attendance.filter((a) => a.status === 'HALF_DAY').length;
  const machineHours = sumStrings(form.usage.map(rowHours));
  const expenseTotal = sumStrings(form.expenses.map((e) => e.amount));

  const statusOptions = [
    { value: 'PRESENT' as const, label: t('status.PRESENT'), tone: 'success' as const },
    { value: 'HALF_DAY' as const, label: t('status.HALF_DAY'), tone: 'warning' as const },
    { value: 'ABSENT' as const, label: t('status.ABSENT'), tone: 'danger' as const },
    { value: 'LEAVE' as const, label: t('status.LEAVE'), tone: 'info' as const },
  ];

  return (
    <div className="flex flex-col gap-5 pb-28" data-testid="daily-form">
      {locked ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-warning/50 bg-warning/15 px-4 py-3"
          data-testid="daily-locked"
        >
          <Lock className="size-5 shrink-0" aria-hidden />
          <p>{t('locked')}</p>
        </div>
      ) : null}

      {/* ── Attendance ── */}
      <Card data-testid="section-attendance">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-xl">
            {t('sections.attendance')}{' '}
            <span className="text-base font-normal text-muted-foreground">
              ({form.attendance.length})
            </span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-10 text-base"
              onClick={copyFromYesterday}
              disabled={locked}
              data-testid="copy-yesterday"
            >
              <ClipboardCopy aria-hidden />
              {t('copyFromYesterday')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-10 text-base"
              onClick={markAllPresent}
              disabled={locked || !form.attendance.length}
              data-testid="mark-all-present"
            >
              <CalendarCheck aria-hidden />
              {t('markAllPresent')}
            </Button>
            <div className="w-56">
              <EntityPicker<WorkerDto>
                resource="workers"
                params={{ active: true }}
                value=""
                onChange={(_id, row) => row && addWorker(row)}
                toItem={workerItem}
                placeholder={t('addWorker')}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {form.attendance.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">{t('noWorkers')}</p>
          ) : (
            form.attendance.map((a) => (
              <div
                key={a.workerId}
                className={cn(
                  'grid items-center gap-3 rounded-lg border px-3 py-2 lg:grid-cols-[minmax(10rem,1fr)_auto_6rem_minmax(6rem,1fr)_auto]',
                  !a.status && !a.otherProject && 'border-dashed',
                )}
                data-testid={`att-${a.code}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.fullName}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    <span>{a.code}</span>
                    {a.allocated ? (
                      <span className="tabular-nums">· {a.plannedTimes.join(', ')}</span>
                    ) : (
                      <StatusChip tone="neutral" className="text-xs">
                        {t('notPlanned')}
                      </StatusChip>
                    )}
                  </p>
                </div>
                {a.otherProject ? (
                  <p className="flex items-center gap-2 text-sm text-[oklch(0.45_0.1_60)] lg:col-span-4">
                    <AlertTriangle className="size-4" aria-hidden />
                    {t('alreadyAt', { project: a.otherProject.name })}
                  </p>
                ) : (
                  <>
                    <Segmented
                      label={t('statusLabel', { name: a.fullName })}
                      value={a.status}
                      onChange={(v) => setAtt(a.workerId, { status: v })}
                      options={statusOptions}
                      disabled={locked}
                      size="sm"
                    />
                    <Input
                      inputMode="decimal"
                      aria-label={t('otHoursFor', { name: a.fullName })}
                      placeholder={t('otHours')}
                      value={a.otHours}
                      disabled={
                        locked || !a.status || a.status === 'ABSENT' || a.status === 'LEAVE'
                      }
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        if (v === '' || /^\d{0,2}(\.\d{0,2})?$/.test(v))
                          setAtt(a.workerId, { otHours: v });
                      }}
                      className="h-10 text-right tabular-nums"
                    />
                    <Input
                      aria-label={t('noteFor', { name: a.fullName })}
                      placeholder={t('note')}
                      value={a.notes}
                      disabled={locked}
                      onChange={(e) => setAtt(a.workerId, { notes: e.target.value })}
                      className="h-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      aria-label={a.allocated ? t('clearRow') : tc('delete')}
                      disabled={locked}
                      onClick={() =>
                        a.allocated
                          ? setAtt(a.workerId, { status: null, otHours: '', notes: '' })
                          : setForm((f) => ({
                              ...f,
                              attendance: f.attendance.filter((x) => x.workerId !== a.workerId),
                            }))
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
          <p className="text-sm text-muted-foreground">{t('attendanceHelp')}</p>
        </CardContent>
      </Card>

      {/* ── Machines ── */}
      <Card data-testid="section-usage">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-xl">{t('sections.usage')}</CardTitle>
          <div className="w-56">
            <EntityPicker<AssetDto>
              resource="assets"
              value=""
              onChange={(_id, row) => row && addAsset(row)}
              toItem={(a) => ({
                id: a.id,
                label: a.name,
                hint: [a.code, a.registrationNo].filter(Boolean).join(' · '),
              })}
              placeholder={t('addMachine')}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {form.usage.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">{t('noMachines')}</p>
          ) : (
            form.usage.map((u) => {
              const hours = rowHours(u);
              const autoHours = u.meterType === 'HOURS' && Boolean(u.startMeter && u.endMeter);
              const badMeter =
                u.startMeter && u.endMeter && subtractQty(u.endMeter, u.startMeter).startsWith('-');
              const unit = u.meterType === 'KM' ? t('km') : t('hours');
              const num = (field: keyof UseRow, label: string, decimals = 1) => (
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <Input
                    inputMode="decimal"
                    aria-label={`${label} – ${u.name}`}
                    value={u[field] as string}
                    disabled={locked}
                    onChange={(e) => {
                      const v = e.target.value.replace(/,/g, '').trim();
                      const re = new RegExp(`^\\d*(\\.\\d{0,${decimals}})?$`);
                      if (v === '' || re.test(v)) setUse(u.key, { [field]: v });
                    }}
                    className={cn(
                      'h-10 text-right tabular-nums',
                      field === 'endMeter' && badMeter && 'border-destructive',
                    )}
                  />
                </label>
              );
              return (
                <div
                  key={u.key}
                  className="rounded-lg border px-3 py-3"
                  data-testid={`use-${u.code}`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {u.name} <span className="text-sm text-muted-foreground">{u.code}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {u.allocated ? u.plannedTimes.join(', ') : t('notPlanned')}
                        {u.meterType !== 'NONE'
                          ? ` · ${t('meterNow', { value: formatQty(u.currentMeter), unit })}`
                          : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      aria-label={tc('delete')}
                      disabled={locked}
                      onClick={() =>
                        setForm((f) => ({ ...f, usage: f.usage.filter((x) => x.key !== u.key) }))
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_minmax(11rem,1.4fr)]">
                    {u.meterType !== 'NONE' ? (
                      <>
                        {num('startMeter', t('startMeter', { unit }))}
                        {num('endMeter', t('endMeter', { unit }))}
                      </>
                    ) : null}
                    {autoHours ? (
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm text-muted-foreground">{t('hoursWorked')}</span>
                        <p
                          className="flex h-10 items-center justify-end rounded-md bg-muted px-3 font-semibold tabular-nums"
                          data-testid="auto-hours"
                        >
                          {hours ? formatQty(hours) : '—'}
                        </p>
                      </div>
                    ) : (
                      num('hoursUsed', t('hoursWorked'))
                    )}
                    {num('fuelLitres', t('fuelLitres'))}
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm text-muted-foreground">{t('fuelCost')}</span>
                      <MoneyInput
                        aria-label={`${t('fuelCost')} – ${u.name}`}
                        value={u.fuelCost}
                        disabled={locked}
                        onChange={(v) => setUse(u.key, { fuelCost: v })}
                        className="h-10"
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm text-muted-foreground">{t('operator')}</span>
                      <EntityPicker<WorkerDto>
                        resource="workers"
                        params={{ active: true }}
                        value={u.operatorWorkerId}
                        selectedLabel={u.operatorLabel}
                        onChange={(id, row) =>
                          setUse(u.key, { operatorWorkerId: id, operatorLabel: row?.fullName })
                        }
                        toItem={workerItem}
                        allowClear
                      />
                    </label>
                  </div>
                  {badMeter ? (
                    <p className="mt-1 text-sm text-destructive">
                      {validation('END_METER_BEFORE_START')}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ── Expenses ── */}
      <Card data-testid="section-expenses">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-xl">{t('sections.expenses')}</CardTitle>
          <Button
            variant="outline"
            size="lg"
            className="h-10 text-base"
            onClick={addExpense}
            disabled={locked}
            data-testid="add-expense-row"
          >
            <Plus aria-hidden />
            {t('addExpense')}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {form.expenses.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">{t('noExpenses')}</p>
          ) : (
            form.expenses.map((e, i) => (
              <div
                key={e.key}
                className="grid items-end gap-3 rounded-lg border px-3 py-3 md:grid-cols-12"
                data-testid={`exp-row-${i}`}
              >
                <label className="flex min-w-0 flex-col gap-1 md:col-span-4 lg:col-span-3">
                  <span className="text-sm text-muted-foreground">{t('category')}</span>
                  <EnumSelect
                    enumName="ExpenseCategory"
                    values={EXPENSE_CATEGORIES}
                    value={e.category}
                    onChange={(v) => setExp(e.key, { category: v as ExpenseCategory })}
                    disabled={locked}
                    aria-label={`${t('category')} ${i + 1}`}
                    className="h-10 data-[size=default]:h-10"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 md:col-span-8 lg:col-span-6">
                  <span className="text-sm text-muted-foreground">{t('description')}</span>
                  <Input
                    aria-label={`${t('description')} ${i + 1}`}
                    value={e.description}
                    disabled={locked}
                    onChange={(ev) => setExp(e.key, { description: ev.target.value })}
                    className="h-10"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 md:col-span-4 lg:col-span-3">
                  <span className="text-sm text-muted-foreground">{t('amount')}</span>
                  <MoneyInput
                    aria-label={`${t('amount')} ${i + 1}`}
                    value={e.amount}
                    disabled={locked}
                    onChange={(v) => setExp(e.key, { amount: v })}
                    className="h-10"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 md:col-span-4 lg:col-span-3">
                  <span className="text-sm text-muted-foreground">{t('paidBy')}</span>
                  <EnumSelect
                    enumName="ExpensePaidBy"
                    values={EXPENSE_PAID_BY}
                    value={e.paidBy}
                    onChange={(v) => setExp(e.key, { paidBy: v as ExpensePaidBy })}
                    disabled={locked}
                    aria-label={`${t('paidBy')} ${i + 1}`}
                    className="h-10 data-[size=default]:h-10"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 md:col-span-4 lg:col-span-5">
                  <span className="text-sm text-muted-foreground">
                    {t('supplier')}
                    {e.paidBy === 'CREDIT' ? '' : ` (${tc('optional')})`}
                  </span>
                  <EntityPicker<SupplierDto>
                    resource="suppliers"
                    value={e.supplierId}
                    selectedLabel={e.supplierLabel}
                    onChange={(id, row) =>
                      setExp(e.key, { supplierId: id, supplierLabel: row?.name })
                    }
                    toItem={(s) => ({
                      id: s.id,
                      label: s.name,
                      hint: enumLabel('SupplierType', s.type),
                    })}
                    allowClear
                  />
                </label>
                <div className="flex h-10 items-center justify-between gap-2 md:col-span-12 lg:col-span-4">
                  <ReceiptButton
                    documentId={e.receiptDocumentId}
                    projectId={data.project.id}
                    title={e.description}
                    onChange={(id) => setExp(e.key, { receiptDocumentId: id })}
                    disabled={locked}
                    testId={`receipt-${i}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    aria-label={tc('delete')}
                    disabled={locked}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        expenses: f.expenses.filter((x) => x.key !== e.key),
                      }))
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Sticky save bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-8">
          <dl className="flex flex-wrap gap-x-6 gap-y-1" data-testid="daily-totals">
            <div>
              <dt className="text-sm text-muted-foreground">{t('totals.people')}</dt>
              <dd className="text-lg font-semibold tabular-nums" data-testid="total-people">
                {present + half}
                {half ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}
                    ({t('totals.halfDays', { n: half })})
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('totals.machineHours')}</dt>
              <dd className="text-lg font-semibold tabular-nums" data-testid="total-hours">
                {formatQty(machineHours, 1)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('totals.expenses')}</dt>
              <dd className="text-lg font-semibold tabular-nums" data-testid="total-expenses">
                {formatMoney(expenseTotal)}
              </dd>
            </div>
          </dl>
          <div className="ml-auto flex items-center gap-3">
            {dirty ? (
              <span className="text-sm font-medium text-[oklch(0.45_0.1_60)]" data-testid="unsaved">
                {t('unsaved')}
              </span>
            ) : null}
            <Button
              size="lg"
              className="h-12 min-w-40 text-lg"
              onClick={save}
              disabled={saving || locked}
              data-testid="daily-save"
            >
              <Save aria-hidden />
              {saving ? tc('saving') : tc('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
