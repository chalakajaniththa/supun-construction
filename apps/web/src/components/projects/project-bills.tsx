'use client';

import {
  CLIENT_PAYMENT_KINDS,
  PAYMENT_METHODS,
  type CertificateDto,
  type CertificateStatus,
  type ClientPaymentDto,
  type FinanceSummaryDto,
  type IpcCalculationDto,
  type PaymentMethod,
  type ProjectDetailDto,
} from '@sc/shared';
import { Eye, FilePlus2, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteButton } from '@/components/delete-button';
import { DateInput } from '@/components/forms/date-input';
import { DialogButtons, useDialogForm } from '@/components/forms/dialog-form';
import { useEnumLabel } from '@/components/forms/enum-select';
import { FormField } from '@/components/forms/form-field';
import { MoneyInput } from '@/components/forms/money-input';
import { Segmented } from '@/components/segmented';
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
import { ReportDownloadButton } from '@/components/reports/download-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { api } from '@/lib/api-client';
import { toDec } from '@/lib/decimal';
import { formatDate, formatMoney, formatPercent, todayInColombo } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The IPC calculation, one line per step (overview §7). */
export function CalculationSteps({ calc }: { calc: IpcCalculationDto }) {
  const t = useTranslations('bills.calc');
  const overridden = calc.cumulativeWorkDone !== calc.measuredWorkDone;
  const row = (
    label: React.ReactNode,
    value: string,
    opts: { minus?: boolean; strong?: boolean; testId?: string; note?: string } = {},
  ) => (
    <div
      className={cn(
        'flex items-start justify-between gap-4 py-2',
        opts.strong && 'border-t font-semibold',
      )}
    >
      <dt>
        {label}
        {opts.note ? (
          <span className="block text-sm font-normal text-muted-foreground">{opts.note}</span>
        ) : null}
      </dt>
      <dd
        className={cn('text-right whitespace-nowrap tabular-nums', opts.strong && 'text-lg')}
        data-testid={opts.testId}
      >
        {opts.minus ? '− ' : ''}
        {formatMoney(value)}
      </dd>
    </div>
  );
  return (
    <dl className="divide-y rounded-md border px-4" data-testid="ipc-calculation">
      {row(t('workDone'), calc.cumulativeWorkDone, {
        testId: 'calc-cumulative',
        note: overridden
          ? t('overridden', { measured: formatMoney(calc.measuredWorkDone) })
          : t('measured'),
      })}
      {row(t('previous'), calc.previousCertified, { minus: true, testId: 'calc-previous' })}
      {row(t('gross'), calc.grossThisBill, { strong: true, testId: 'calc-gross' })}
      {row(t('retention', { pct: formatPercent(calc.retentionPct, 2) }), calc.retentionDeducted, {
        minus: true,
        testId: 'calc-retention',
        note: calc.retentionCapReached
          ? t('retentionCap', {
              cap: formatMoney(calc.retentionCap),
              soFar: formatMoney(calc.retentionSoFar),
            })
          : t('retentionSoFar', {
              soFar: formatMoney(calc.retentionSoFar),
              cap: formatMoney(calc.retentionCap),
            }),
      })}
      {row(
        t('advance', { pct: formatPercent(calc.advanceRecoveryPct, 2) }),
        calc.advanceRecovered,
        {
          minus: true,
          testId: 'calc-advance',
          note: toDec(calc.advanceAmount).isZero()
            ? t('noAdvance')
            : calc.advanceFullyRecovered
              ? t('advanceDone')
              : t('advanceLeft', {
                  left: formatMoney(
                    toDec(calc.advanceAmount)
                      .minus(toDec(calc.advanceRecoveredSoFar))
                      .minus(toDec(calc.advanceRecovered))
                      .toFixed(2),
                  ),
                }),
        },
      )}
      {row(t('other'), calc.otherDeductions, { minus: true, testId: 'calc-other' })}
      {row(t('net'), calc.netPayable, { strong: true, testId: 'calc-net' })}
    </dl>
  );
}

interface Preview {
  code: string;
  periodFrom: string;
  periodTo: string;
  calculation: IpcCalculationDto;
}

/** "New bill" wizard (and editing a draft): period & deductions → the calculation → save. */
function BillDialog({
  projectId,
  bill,
  open,
  onOpenChange,
}: {
  projectId: string;
  bill: CertificateDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('bills');
  const tc = useTranslations('common');
  const invalidate = useInvalidate();
  const { form, setForm, handle, err } = useDialogForm(
    open,
    () => ({
      periodTo: bill?.periodTo.slice(0, 10) ?? todayInColombo(),
      cumulativeWorkDone:
        bill && bill.cumulativeWorkDone !== bill.calculation.measuredWorkDone
          ? bill.cumulativeWorkDone
          : '',
      otherDeductions: bill?.otherDeductions === '0.00' ? '' : (bill?.otherDeductions ?? ''),
      otherDeductionsNote: bill?.otherDeductionsNote ?? '',
    }),
    bill,
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setPreview(null);
  }
  const [busy, setBusy] = useState(false);
  const body = () => ({
    periodTo: form.periodTo,
    cumulativeWorkDone: form.cumulativeWorkDone,
    otherDeductions: form.otherDeductions || '0',
    otherDeductionsNote: form.otherDeductionsNote,
  });
  const calculate = async () => {
    setBusy(true);
    try {
      if (bill) {
        // a draft is recalculated in place
        setPreview(
          await api<CertificateDto>(`/projects/${projectId}/certificates/${bill.id}`, {
            method: 'PATCH',
            body: body(),
          }),
        );
        await invalidate('projects');
      } else {
        setPreview(
          await api<Preview>(`/projects/${projectId}/certificates/preview`, {
            method: 'POST',
            body: body(),
          }),
        );
      }
    } catch (e) {
      handle(e);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (bill) {
      toast.success(t('saved'));
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await api(`/projects/${projectId}/certificates`, { method: 'POST', body: body() });
      await invalidate('projects');
      toast.success(t('saved'));
      onOpenChange(false);
    } catch (e) {
      handle(e);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="bill-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {bill ? t('editTitle', { code: bill.code }) : t('newTitle')}
          </DialogTitle>
          <DialogDescription>
            {preview ? t('step2', { code: preview.code }) : t('step1')}
          </DialogDescription>
        </DialogHeader>
        {!preview ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="b-to"
              label={t('fields.periodTo')}
              description={t('periodToHelp')}
              error={err('periodTo')}
            >
              <DateInput
                id="b-to"
                value={form.periodTo}
                onChange={(v) => setForm({ ...form, periodTo: v })}
                className="h-11 text-base"
              />
            </FormField>
            <FormField
              id="b-cum"
              label={t('fields.cumulativeOverride')}
              description={t('cumulativeHelp')}
              error={err('cumulativeWorkDone')}
            >
              <MoneyInput
                id="b-cum"
                value={form.cumulativeWorkDone}
                onChange={(v) => setForm({ ...form, cumulativeWorkDone: v })}
                className="h-11 text-base"
                data-testid="bill-cumulative"
              />
            </FormField>
            <FormField
              id="b-other"
              label={t('fields.otherDeductions')}
              error={err('otherDeductions')}
            >
              <MoneyInput
                id="b-other"
                value={form.otherDeductions}
                onChange={(v) => setForm({ ...form, otherDeductions: v })}
                className="h-11 text-base"
              />
            </FormField>
            <FormField id="b-note" label={t('fields.otherNote')}>
              <Input
                id="b-note"
                value={form.otherDeductionsNote}
                onChange={(e) => setForm({ ...form, otherDeductionsNote: e.target.value })}
                className="h-11 text-base"
              />
            </FormField>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground">
              {t('period', {
                from: formatDate(preview.periodFrom),
                to: formatDate(preview.periodTo),
              })}
            </p>
            <CalculationSteps calc={preview.calculation} />
          </div>
        )}
        <DialogFooter>
          {!preview ? (
            <>
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
                onClick={calculate}
                disabled={busy}
                data-testid="bill-calculate"
              >
                {t('calculate')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="lg"
                className="h-11 text-base"
                onClick={() => setPreview(null)}
              >
                {tc('back')}
              </Button>
              <Button
                size="lg"
                className="h-11 min-w-32 text-base"
                onClick={save}
                disabled={busy}
                data-testid="bill-save"
              >
                {bill ? tc('close') : t('saveDraft')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NEXT_ACTION: Partial<
  Record<CertificateStatus, { to: CertificateStatus; label: string; dated: boolean }>
> = {
  DRAFT: { to: 'SUBMITTED', label: 'submit', dated: true },
  SUBMITTED: { to: 'CERTIFIED', label: 'certify', dated: true },
  CERTIFIED: { to: 'PAID', label: 'markPaid', dated: false },
};

function StatusDialog({
  projectId,
  bill,
  to,
  onOpenChange,
}: {
  projectId: string;
  bill: CertificateDto | null;
  to: CertificateStatus | null;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('bills');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const [date, setDate] = useState(todayInColombo());
  const [busy, setBusy] = useState(false);
  const open = Boolean(bill && to);
  const save = async () => {
    setBusy(true);
    try {
      await api(`/projects/${projectId}/certificates/${bill!.id}/status`, {
        method: 'POST',
        body: { status: to, date },
      });
      await invalidate('projects');
      toast.success(t('statusSaved'));
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const dated = to === 'SUBMITTED' || to === 'CERTIFIED';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="bill-status-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {to ? t(`statusTitle.${to}`, { code: bill?.code ?? '' }) : ''}
          </DialogTitle>
          <DialogDescription>{to ? t(`statusText.${to}`) : ''}</DialogDescription>
        </DialogHeader>
        {dated ? (
          <FormField id="bs-date" label={t('statusDate')}>
            <DateInput id="bs-date" value={date} onChange={setDate} className="h-11 text-base" />
          </FormField>
        ) : null}
        <DialogButtons
          onCancel={() => onOpenChange(false)}
          onSave={save}
          saving={busy}
          testId="bill-status-save"
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  projectId,
  bills,
  open,
  onOpenChange,
}: {
  projectId: string;
  bills: CertificateDto[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('payments');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const unpaid = bills.filter((b) => b.status === 'SUBMITTED' || b.status === 'CERTIFIED');
  const { form, setForm, handle, err } = useDialogForm(
    open,
    () => {
      const first = unpaid[0];
      return {
        date: todayInColombo(),
        amount: first ? toDec(first.netPayable).minus(toDec(first.paid)).toFixed(2) : '',
        kind: 'IPC_PAYMENT' as string,
        method: 'BANK_TRANSFER' as string,
        certificateId: first?.id ?? '',
        reference: '',
        notes: '',
      };
    },
    bills,
  );
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api(`/projects/${projectId}/payments`, {
        method: 'POST',
        body: {
          ...form,
          certificateId: form.kind === 'IPC_PAYMENT' ? form.certificateId || null : null,
        },
      });
      await invalidate('projects');
      toast.success(t('saved'));
      onOpenChange(false);
    } catch (e) {
      handle(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="payment-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formHelp')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="p-kind" label={t('fields.kind')} className="sm:col-span-2">
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger
                id="p-kind"
                className="h-11 w-full text-base"
                data-testid="payment-kind"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_PAYMENT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {enumLabel('ClientPaymentKind', k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {form.kind === 'IPC_PAYMENT' ? (
            <FormField
              id="p-bill"
              label={t('fields.bill')}
              error={err('certificateId')}
              className="sm:col-span-2"
            >
              <Select
                value={form.certificateId || 'none'}
                onValueChange={(v) => {
                  const b = bills.find((x) => x.id === v);
                  setForm({
                    ...form,
                    certificateId: v === 'none' ? '' : v,
                    amount: b ? toDec(b.netPayable).minus(toDec(b.paid)).toFixed(2) : form.amount,
                  });
                }}
              >
                <SelectTrigger
                  id="p-bill"
                  className="h-11 w-full text-base"
                  data-testid="payment-bill"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noBill')}</SelectItem>
                  {bills
                    .filter((b) => b.status !== 'DRAFT')
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {t('billOption', {
                          code: b.code,
                          left: formatMoney(toDec(b.netPayable).minus(toDec(b.paid)).toFixed(2)),
                        })}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}
          <FormField id="p-date" label={t('fields.date')} error={err('date')}>
            <DateInput
              id="p-date"
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="p-amount" label={t('fields.amount')} error={err('amount')}>
            <MoneyInput
              id="p-amount"
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              className="h-11 text-base"
              data-testid="payment-amount"
            />
          </FormField>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm font-medium">{t('fields.method')}</span>
            <Segmented
              label={t('fields.method')}
              value={form.method as PaymentMethod}
              onChange={(v) => setForm({ ...form, method: v })}
              options={PAYMENT_METHODS.map((m) => ({
                value: m,
                label: enumLabel('PaymentMethod', m),
              }))}
            />
          </div>
          <FormField id="p-ref" label={t('fields.reference')} className="sm:col-span-2">
            <Input
              id="p-ref"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
        </div>
        <DialogButtons
          onCancel={() => onOpenChange(false)}
          onSave={save}
          saving={saving}
          testId="payment-save"
        />
      </DialogContent>
    </Dialog>
  );
}

function SummaryCards({ s }: { s: FinanceSummaryDto }) {
  const t = useTranslations('bills.summary');
  const cards: { key: string; value: string; sub?: string; strong?: boolean }[] = [
    { key: 'contract', value: s.effectiveContractValue },
    {
      key: 'billed',
      value: s.billedToDate,
      sub: t('certified', { amount: formatMoney(s.certifiedToDate) }),
    },
    { key: 'received', value: s.received },
    { key: 'receivable', value: s.receivable, strong: true },
    {
      key: 'retention',
      value: s.retentionHeld,
      sub: t('released', { amount: formatMoney(s.retentionReleased) }),
    },
    {
      key: 'advance',
      value: s.advanceBalance,
      sub: t('advanceOf', {
        recovered: formatMoney(s.advanceRecovered),
        amount: formatMoney(s.advanceAmount),
      }),
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="finance-summary">
      {cards.map((c) => (
        <Card
          key={c.key}
          className={cn('gap-1 py-4', c.strong && 'border-primary/50 bg-primary/5')}
        >
          <CardContent className="flex flex-col gap-1">
            <span className="text-muted-foreground">{t(c.key)}</span>
            <span className="text-2xl font-semibold tabular-nums" data-testid={`summary-${c.key}`}>
              {formatMoney(c.value)}
            </span>
            {c.sub ? <span className="text-sm text-muted-foreground">{c.sub}</span> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Bills (IPC / progress bills) & payments tab. */
export function ProjectBills({ project }: { project: ProjectDetailDto }) {
  const t = useTranslations('bills');
  const tp = useTranslations('payments');
  const tr = useTranslations('reports');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const { data: summary } = useApi<FinanceSummaryDto>(
    'projects',
    `/projects/${project.id}/finance-summary`,
  );
  const { data: bills } = useApi<CertificateDto[]>(
    'projects',
    `/projects/${project.id}/certificates`,
  );
  const { data: payments } = useApi<ClientPaymentDto[]>(
    'projects',
    `/projects/${project.id}/payments`,
  );
  const [billDialog, setBillDialog] = useState<{ open: boolean; bill: CertificateDto | null }>({
    open: false,
    bill: null,
  });
  const [status, setStatus] = useState<{ bill: CertificateDto; to: CertificateStatus } | null>(
    null,
  );
  const [view, setView] = useState<CertificateDto | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const hasDraft = (bills ?? []).some((b) => b.status === 'DRAFT');
  const latest = bills?.at(-1);
  const money = (v: string) => (
    <span className="whitespace-nowrap tabular-nums">{formatMoney(v, { symbol: false })}</span>
  );

  return (
    <div className="flex flex-col gap-5">
      {summary ? <SummaryCards s={summary} /> : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <p className="text-muted-foreground">{hasDraft ? t('draftExists') : t('help')}</p>
          </div>
          <Button
            size="lg"
            className="h-11 text-base"
            onClick={() => setBillDialog({ open: true, bill: null })}
            disabled={hasDraft}
            data-testid="new-bill"
          >
            <FilePlus2 aria-hidden />
            {t('new')}
          </Button>
        </CardHeader>
        <CardContent>
          {!bills?.length ? (
            <p className="py-6 text-center text-muted-foreground">{t('empty')}</p>
          ) : (
            <Table data-testid="bills-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-normal">{t('cols.bill')}</TableHead>
                  <TableHead className="text-right whitespace-normal">
                    {t('cols.workDone')}
                  </TableHead>
                  <TableHead className="text-right whitespace-normal">{t('cols.gross')}</TableHead>
                  <TableHead className="text-right whitespace-normal">
                    {t('cols.deductions')}
                  </TableHead>
                  <TableHead className="text-right whitespace-normal">{t('cols.net')}</TableHead>
                  <TableHead className="text-right whitespace-normal">{t('cols.paid')}</TableHead>
                  <TableHead className="whitespace-normal">{t('cols.status')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((b) => {
                  const next = NEXT_ACTION[b.status];
                  const deductions = toDec(b.retentionDeducted)
                    .plus(toDec(b.advanceRecovered))
                    .plus(toDec(b.otherDeductions))
                    .toFixed(2);
                  const paidInFull = toDec(b.paid).gte(toDec(b.netPayable));
                  return (
                    <TableRow key={b.id} data-testid={`bill-row-${b.number}`}>
                      <TableCell className="whitespace-normal">
                        <span className="font-medium">{b.code}</span>
                        <span className="block text-sm text-muted-foreground">
                          {formatDate(b.periodFrom)} – {formatDate(b.periodTo)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{money(b.cumulativeWorkDone)}</TableCell>
                      <TableCell className="text-right">{money(b.grossThisBill)}</TableCell>
                      <TableCell className="text-right">{money(deductions)}</TableCell>
                      <TableCell className="text-right font-semibold" data-testid="bill-net">
                        {money(b.netPayable)}
                      </TableCell>
                      <TableCell className="text-right">{money(b.paid)}</TableCell>
                      <TableCell>
                        <StatusChip status={b.status}>
                          {enumLabel('CertificateStatus', b.status)}
                        </StatusChip>
                        {b.certifiedDate ? (
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(b.certifiedDate)}
                          </span>
                        ) : b.submittedDate ? (
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(b.submittedDate)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {next && (next.to !== 'PAID' || paidInFull) ? (
                            <Button
                              size="sm"
                              variant={next.to === 'PAID' ? 'default' : 'outline'}
                              className="h-9"
                              onClick={() => setStatus({ bill: b, to: next.to })}
                              data-testid={`bill-${next.label}`}
                            >
                              {t(`actions.${next.label}`)}
                            </Button>
                          ) : null}
                          {b.status === 'SUBMITTED' &&
                          latest?.id === b.id &&
                          toDec(b.paid).isZero() ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9"
                              onClick={() => setStatus({ bill: b, to: 'DRAFT' })}
                            >
                              {t('actions.backToDraft')}
                            </Button>
                          ) : null}
                          {b.status !== 'DRAFT' ? (
                            <ReportDownloadButton
                              reportId="ipc"
                              format="pdf"
                              params={{ projectId: project.id, certificateId: b.id }}
                              label={tr('print')}
                              iconOnly
                              testId={`bill-print-${b.number}`}
                            />
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-lg"
                            aria-label={t('view', { code: b.code })}
                            onClick={() => setView(b)}
                          >
                            <Eye aria-hidden />
                          </Button>
                          {b.status === 'DRAFT' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-lg"
                                aria-label={t('editTitle', { code: b.code })}
                                onClick={() => setBillDialog({ open: true, bill: b })}
                              >
                                <Pencil aria-hidden />
                              </Button>
                              <DeleteButton
                                variant="ghost"
                                iconOnly
                                description={t('deleteConfirm', { code: b.code })}
                                onDelete={async () => {
                                  await api(`/projects/${project.id}/certificates/${b.id}`, {
                                    method: 'DELETE',
                                  });
                                  await invalidate('projects');
                                }}
                              />
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-sm text-muted-foreground">{t('paidHelp')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">{tp('title')}</CardTitle>
          <Button
            size="lg"
            variant="outline"
            className="h-11 text-base"
            onClick={() => setPaymentOpen(true)}
            data-testid="record-payment"
          >
            <Plus aria-hidden />
            {tp('add')}
          </Button>
        </CardHeader>
        <CardContent>
          {!payments?.length ? (
            <p className="py-6 text-center text-muted-foreground">{tp('empty')}</p>
          ) : (
            <Table data-testid="payments-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{tp('fields.date')}</TableHead>
                  <TableHead className="whitespace-normal">{tp('fields.kind')}</TableHead>
                  <TableHead className="whitespace-normal">{tp('fields.bill')}</TableHead>
                  <TableHead className="whitespace-normal">{tp('fields.method')}</TableHead>
                  <TableHead className="whitespace-normal">{tp('fields.reference')}</TableHead>
                  <TableHead className="text-right">{tp('fields.amount')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(p.date)}</TableCell>
                    <TableCell className="whitespace-normal">
                      {enumLabel('ClientPaymentKind', p.kind)}
                    </TableCell>
                    <TableCell>
                      {p.certificate
                        ? `IPC-${project.code}-${String(p.certificate.number).padStart(2, '0')}`
                        : '—'}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {enumLabel('PaymentMethod', p.method)}
                    </TableCell>
                    <TableCell className="whitespace-normal">{p.reference ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                      {formatMoney(p.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteButton
                        variant="ghost"
                        iconOnly
                        description={tp('deleteConfirm', {
                          amount: formatMoney(p.amount),
                          date: formatDate(p.date),
                        })}
                        onDelete={async () => {
                          await api(`/projects/${project.id}/payments/${p.id}`, {
                            method: 'DELETE',
                          });
                          await invalidate('projects');
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BillDialog
        projectId={project.id}
        bill={billDialog.bill}
        open={billDialog.open}
        onOpenChange={(o) => setBillDialog({ ...billDialog, open: o })}
      />
      <StatusDialog
        projectId={project.id}
        bill={status?.bill ?? null}
        to={status?.to ?? null}
        onOpenChange={(o) => !o && setStatus(null)}
      />
      <PaymentDialog
        projectId={project.id}
        bills={bills ?? []}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
      <Dialog open={Boolean(view)} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">{view?.code}</DialogTitle>
            <DialogDescription>
              {view
                ? t('period', { from: formatDate(view.periodFrom), to: formatDate(view.periodTo) })
                : ''}
            </DialogDescription>
          </DialogHeader>
          {view ? <CalculationSteps calc={view.calculation} /> : null}
          {view?.otherDeductionsNote ? (
            <p className="text-sm text-muted-foreground">
              {t('otherNoteText', { note: view.otherDeductionsNote })}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
