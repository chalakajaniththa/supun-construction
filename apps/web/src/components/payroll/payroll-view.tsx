'use client';

import type { PayrollLineDto, PayrollRunDto, PayrollRunSummaryDto } from '@sc/shared';
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Lock,
  Pencil,
  RefreshCw,
  TriangleAlert,
  Unlock,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useEnumLabel } from '@/components/forms/enum-select';
import { FormField } from '@/components/forms/form-field';
import { MoneyInput } from '@/components/forms/money-input';
import { StatusChip } from '@/components/status-chip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { ApiError, api } from '@/lib/api-client';
import { toDec } from '@/lib/decimal';
import { formatMoney, formatMonth, formatQty, todayInColombo } from '@/lib/format';
import { OpenAdvances } from './open-advances';

/** "2026-10" ± n months */
function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const money = (v: string) => (
  <span className="whitespace-nowrap tabular-nums">{formatMoney(v, { symbol: false })}</span>
);

function LineDialog({
  run,
  line,
  onOpenChange,
}: {
  run: PayrollRunDto;
  line: PayrollLineDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('payroll');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const init = () => ({
    advanceDeduction: line?.advanceDeduction ?? '',
    otherDeductions: line?.otherDeductions ?? '',
    otherDeductionsNote: line?.otherDeductionsNote ?? '',
  });
  const [form, setForm] = useState(init);
  const [key, setKey] = useState(line);
  if (key !== line) {
    setKey(line);
    setForm(init());
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  if (!line) return null;
  const net = toDec(line.grossPay)
    .minus(toDec(line.epfEmployee))
    .minus(toDec(form.advanceDeduction))
    .minus(toDec(form.otherDeductions));
  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await api(`/payroll/runs/${run.id}/lines/${line.id}`, {
        method: 'PATCH',
        body: {
          advanceDeduction: form.advanceDeduction || '0',
          otherDeductions: form.otherDeductions || '0',
          otherDeductionsNote: form.otherDeductionsNote,
        },
      });
      await invalidate('payroll', 'advances');
      toast.success(t('lineSaved'));
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
  const err = (k: string) => (errors[k] ? { message: errors[k] } : undefined);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="payroll-line-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t('editLine', { name: line.worker.fullName })}
          </DialogTitle>
          <DialogDescription>{t('editLineHelp')}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/50 p-3">
          <dt className="text-muted-foreground">{t('cols.gross')}</dt>
          <dd className="text-right tabular-nums">{formatMoney(line.grossPay)}</dd>
          <dt className="text-muted-foreground">{t('cols.epf8')}</dt>
          <dd className="text-right tabular-nums">{formatMoney(line.epfEmployee)}</dd>
          <dt className="text-muted-foreground">{t('advanceBalance')}</dt>
          <dd className="text-right tabular-nums">{formatMoney(line.advanceBalance)}</dd>
        </dl>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pl-adv" label={t('cols.advance')} error={err('advanceDeduction')}>
            <MoneyInput
              id="pl-adv"
              value={form.advanceDeduction}
              onChange={(v) => setForm({ ...form, advanceDeduction: v })}
              className="h-11 text-base"
              data-testid="line-advance"
            />
          </FormField>
          <FormField id="pl-other" label={t('cols.other')} error={err('otherDeductions')}>
            <MoneyInput
              id="pl-other"
              value={form.otherDeductions}
              onChange={(v) => setForm({ ...form, otherDeductions: v })}
              className="h-11 text-base"
              data-testid="line-other"
            />
          </FormField>
          <FormField id="pl-note" label={t('otherNote')} className="sm:col-span-2">
            <Input
              id="pl-note"
              value={form.otherDeductionsNote}
              onChange={(e) => setForm({ ...form, otherDeductionsNote: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
        </div>
        <p className="flex items-center justify-between rounded-md border p-3 text-lg">
          <span>{t('cols.net')}</span>
          <span
            className={net.isNegative() ? 'font-semibold text-destructive' : 'font-semibold'}
            data-testid="line-net-preview"
          >
            {formatMoney(net.toFixed(2))}
          </span>
        </p>
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
            data-testid="line-save"
          >
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunTable({ run, onEdit }: { run: PayrollRunDto; onEdit: (l: PayrollLineDto) => void }) {
  const t = useTranslations('payroll');
  const enumLabel = useEnumLabel();
  const draft = run.status === 'DRAFT';
  const head = (label: string, right = true) => (
    <TableHead className={right ? 'text-right whitespace-normal' : 'whitespace-normal'}>
      {label}
    </TableHead>
  );
  return (
    <Table data-testid="payroll-table" className="text-sm [&_td]:px-1 [&_th]:px-1">
      <TableHeader>
        <TableRow>
          {head(t('worker'), false)}
          {head(t('cols.days'))}
          {head(t('cols.ot'))}
          {head(t('cols.basic'))}
          {head(t('cols.otPay'))}
          {head(t('cols.gross'))}
          {head(t('cols.epf8'))}
          {head(t('cols.advance'))}
          {head(t('cols.other'))}
          {head(t('cols.net'))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {run.lines.map((l) => (
          <TableRow key={l.id} data-testid={`payroll-row-${l.worker.code}`}>
            <TableCell className="whitespace-normal">
              <span className="flex items-start gap-1">
                <Link href={`/workers/${l.workerId}`} className="font-medium hover:underline">
                  {l.worker.fullName}
                </Link>
                {draft ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 shrink-0"
                    aria-label={t('editLine', { name: l.worker.fullName })}
                    onClick={() => onEdit(l)}
                    data-testid="edit-line"
                  >
                    <Pencil aria-hidden />
                  </Button>
                ) : null}
              </span>
              <p className="text-sm text-muted-foreground">{l.worker.code}</p>
              <p className="text-sm text-muted-foreground">
                {enumLabel('WorkerType', l.workerType)}
              </p>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap tabular-nums">
              {formatQty(l.daysWorked)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatQty(l.otHours)}</TableCell>
            <TableCell className="text-right">{money(l.basicPay)}</TableCell>
            <TableCell className="text-right">{money(l.otPay)}</TableCell>
            <TableCell className="text-right">{money(l.grossPay)}</TableCell>
            <TableCell className="text-right">{money(l.epfEmployee)}</TableCell>
            <TableCell className="text-right" data-testid="cell-advance">
              {money(l.advanceDeduction)}
            </TableCell>
            <TableCell className="text-right">
              {money(l.otherDeductions)}
              {l.otherDeductionsNote ? (
                <span className="block max-w-32 text-sm whitespace-normal text-muted-foreground">
                  {l.otherDeductionsNote}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-right font-semibold" data-testid="cell-net">
              {money(l.netPay)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow className="font-semibold" data-testid="payroll-totals">
          <TableCell className="whitespace-normal">
            {t('total', { n: run.totals.workers })}
          </TableCell>
          <TableCell />
          <TableCell />
          <TableCell className="text-right">{money(run.totals.basicPay)}</TableCell>
          <TableCell className="text-right">{money(run.totals.otPay)}</TableCell>
          <TableCell className="text-right">{money(run.totals.grossPay)}</TableCell>
          <TableCell className="text-right">{money(run.totals.epfEmployee)}</TableCell>
          <TableCell className="text-right">{money(run.totals.advanceDeduction)}</TableCell>
          <TableCell className="text-right">{money(run.totals.otherDeductions)}</TableCell>
          <TableCell className="text-right" data-testid="total-net">
            {money(run.totals.netPay)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

/** Payroll: pick a month → generate the draft → review / edit deductions → finalize. */
export function PayrollView() {
  const t = useTranslations('payroll');
  const enumLabel = useEnumLabel();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const [month, setMonth] = useState(() => todayInColombo().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'finalize' | 'reopen' | null>(null);
  const [editing, setEditing] = useState<PayrollLineDto | null>(null);
  const [year, mon] = month.split('-').map(Number) as [number, number];

  const runs = useApi<PayrollRunSummaryDto[]>('payroll', '/payroll/runs');
  const summary = runs.data?.find((r) => r.year === year && r.month === mon);
  const detail = useApi<PayrollRunDto>('payroll', `/payroll/runs/${summary?.id}`, undefined, {
    enabled: Boolean(summary),
    keepPrevious: false,
  });
  const run = summary ? detail.data : undefined;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      await invalidate('payroll', 'advances', 'daily-entry', 'attendance');
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  const generate = () =>
    act(() => api('/payroll/runs', { method: 'POST', body: { year, month: mon } }), t('generated'));

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-lg"
              aria-label={t('prevMonth')}
              onClick={() => setMonth(shiftMonth(month, -1))}
              data-testid="prev-month"
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span
              className="min-w-44 text-center text-xl font-semibold"
              data-testid="payroll-month"
            >
              {formatMonth(month)}
            </span>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label={t('nextMonth')}
              onClick={() => setMonth(shiftMonth(month, 1))}
              data-testid="next-month"
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
          {summary ? (
            <StatusChip status={summary.status} className="text-base">
              {enumLabel('PayrollStatus', summary.status)}
            </StatusChip>
          ) : (
            <StatusChip tone="neutral">{t('notStarted')}</StatusChip>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {!summary || summary.status === 'DRAFT' ? (
              <Button
                size="lg"
                variant={summary ? 'outline' : 'default'}
                className="h-11 text-base"
                onClick={generate}
                disabled={busy}
                data-testid="generate-payroll"
              >
                <RefreshCw aria-hidden />
                {summary ? t('regenerate') : t('generate')}
              </Button>
            ) : null}
            {summary?.status === 'DRAFT' ? (
              <Button
                size="lg"
                className="h-11 text-base"
                onClick={() => setConfirm('finalize')}
                disabled={busy || !run || run.stale}
                data-testid="finalize-payroll"
              >
                <Lock aria-hidden />
                {t('finalize')}
              </Button>
            ) : null}
            {run?.canReopen ? (
              <Button
                size="lg"
                variant="outline"
                className="h-11 text-base"
                onClick={() => setConfirm('reopen')}
                disabled={busy}
                data-testid="reopen-payroll"
              >
                <Unlock aria-hidden />
                {t('reopen')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!summary ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('noRunYet', { month: formatMonth(month) })}
          </CardContent>
        </Card>
      ) : !run ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('loading')}
          </CardContent>
        </Card>
      ) : (
        <>
          {run.stale ? (
            <Alert className="border-warning/60 bg-warning/10" data-testid="payroll-stale">
              <TriangleAlert aria-hidden />
              <AlertTitle>{t('staleTitle')}</AlertTitle>
              <AlertDescription>{t('staleText')}</AlertDescription>
            </Alert>
          ) : null}
          {run.status === 'FINALIZED' ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Lock className="size-4" aria-hidden />
              {t('lockedHelp')}
            </p>
          ) : (
            <p className="text-muted-foreground">{t('draftHelp')}</p>
          )}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg">
                {t('sheetTitle', { month: formatMonth(month) })}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 text-base"
                  disabled
                  title={t('exportSoon')}
                >
                  <FileText aria-hidden />
                  {t('payslipsPdf')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 text-base"
                  disabled
                  title={t('exportSoon')}
                >
                  <FileSpreadsheet aria-hidden />
                  {t('sheetExcel')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-3">
              {run.lines.length ? (
                <RunTable run={run} onEdit={setEditing} />
              ) : (
                <p className="py-6 text-center text-muted-foreground">{t('noLines')}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('employerCost')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl
                className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4"
                data-testid="employer-cost"
              >
                {(
                  [
                    ['gross', run.totals.grossPay],
                    ['epf12', run.totals.epfEmployer],
                    ['etf3', run.totals.etfEmployer],
                    ['employerTotal', run.totals.employerCost],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground">{t(`cost.${k}`)}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{formatMoney(v)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-sm text-muted-foreground">
                {t('epfTotal', {
                  amount: formatMoney(
                    toDec(run.totals.epfEmployee).plus(toDec(run.totals.epfEmployer)).toFixed(2),
                  ),
                })}
              </p>
            </CardContent>
          </Card>
          <LineDialog run={run} line={editing} onOpenChange={(o) => !o && setEditing(null)} />
        </>
      )}

      <OpenAdvances />

      <ConfirmDialog
        open={confirm === 'finalize'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('finalizeTitle', { month: formatMonth(month) })}
        description={t('finalizeText')}
        confirmLabel={t('finalize')}
        pending={busy}
        onConfirm={() =>
          act(
            () => api(`/payroll/runs/${summary?.id}/finalize`, { method: 'POST' }),
            t('finalized'),
          )
        }
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('reopenTitle', { month: formatMonth(month) })}
        description={t('reopenText')}
        confirmLabel={t('reopen')}
        destructive
        pending={busy}
        onConfirm={() =>
          act(() => api(`/payroll/runs/${summary?.id}/reopen`, { method: 'POST' }), t('reopened'))
        }
      />
    </div>
  );
}
