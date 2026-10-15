'use client';

import { type AdvanceDto, type WorkerDto } from '@sc/shared';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteButton } from '@/components/delete-button';
import { DateInput } from '@/components/forms/date-input';
import { FormField } from '@/components/forms/form-field';
import { MoneyInput } from '@/components/forms/money-input';
import { StatusChip } from '@/components/status-chip';
import { useEnumLabel } from '@/components/forms/enum-select';
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
import { sumStrings } from '@/lib/decimal';
import { formatDate, formatMoney, todayInColombo } from '@/lib/format';

function AdvanceDialog({
  open,
  onOpenChange,
  workerId,
  advance,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workerId: string;
  advance: AdvanceDto | null;
}) {
  const t = useTranslations('advances');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const init = () => ({
    date: advance?.date.slice(0, 10) ?? todayInColombo(),
    amount: advance?.amount ?? '',
    recoveryPerMonth: advance?.recoveryPerMonth ?? '',
    reason: advance?.reason ?? '',
  });
  const [form, setForm] = useState(init);
  const [key, setKey] = useState({ open, advance });
  if (key.open !== open || key.advance !== advance) {
    setKey({ open, advance });
    setForm(init());
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const local: Record<string, string> = {};
    if (!form.amount || Number(form.amount) <= 0) local.amount = 'MUST_BE_POSITIVE';
    if (form.recoveryPerMonth && Number(form.recoveryPerMonth) > Number(form.amount))
      local.recoveryPerMonth = 'RECOVERY_MORE_THAN_AMOUNT';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      if (advance)
        await api(`/workers/${workerId}/advances/${advance.id}`, { method: 'PATCH', body: form });
      else await api(`/workers/${workerId}/advances`, { method: 'POST', body: form });
      await invalidate('advances');
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
  const err = (k: string) => (errors[k] ? { message: errors[k] } : undefined);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="advance-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{advance ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="adv-date" label={t('fields.date')}>
            <DateInput
              id="adv-date"
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="adv-amount" label={t('fields.amount')} error={err('amount')}>
            <MoneyInput
              id="adv-amount"
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField
            id="adv-recovery"
            label={t('fields.recoveryPerMonth')}
            description={t('recoveryHint')}
            error={err('recoveryPerMonth')}
            className="sm:col-span-2"
          >
            <MoneyInput
              id="adv-recovery"
              value={form.recoveryPerMonth}
              onChange={(v) => setForm({ ...form, recoveryPerMonth: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="adv-reason" label={t('fields.reason')} className="sm:col-span-2">
            <Input
              id="adv-reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
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
            data-testid="advance-save"
          >
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Salary advances of one worker (worker detail → Advances). */
export function AdvancesPanel({ worker }: { worker: WorkerDto }) {
  const t = useTranslations('advances');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const { data } = useApi<AdvanceDto[]>('advances', `/workers/${worker.id}/advances`);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdvanceDto | null>(null);
  const open_ = (data ?? []).filter((a) => a.status === 'OPEN');
  const owed = sumStrings(open_.map((a) => a.balance));
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">{t('title')}</CardTitle>
          <p className="text-muted-foreground" data-testid="advance-balance">
            {t('stillToRecover', { amount: formatMoney(owed) })}
          </p>
        </div>
        <Button
          size="lg"
          className="h-11 text-base"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          data-testid="add-advance"
        >
          <Plus aria-hidden />
          {t('add')}
        </Button>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <p className="py-6 text-center text-muted-foreground">{t('empty')}</p>
        ) : (
          <Table data-testid="advances-table">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-normal">{t('fields.date')}</TableHead>
                <TableHead className="whitespace-normal">{t('fields.reason')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('fields.amount')}</TableHead>
                <TableHead className="text-right whitespace-normal">
                  {t('fields.recoveryPerMonth')}
                </TableHead>
                <TableHead className="text-right whitespace-normal">
                  {t('fields.recovered')}
                </TableHead>
                <TableHead className="text-right whitespace-normal">
                  {t('fields.balance')}
                </TableHead>
                <TableHead className="whitespace-normal">{t('fields.status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(a.date)}</TableCell>
                  <TableCell className="whitespace-normal">{a.reason ?? '—'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(a.amount)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {a.recoveryPerMonth ? formatMoney(a.recoveryPerMonth) : t('inFull')}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(a.recovered)}
                  </TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatMoney(a.balance)}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={a.status}>
                      {enumLabel('AdvanceStatus', a.status)}
                    </StatusChip>
                  </TableCell>
                  <TableCell>
                    {a.recoveryCount === 0 ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          aria-label={t('edit')}
                          onClick={() => {
                            setEditing(a);
                            setOpen(true);
                          }}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <DeleteButton
                          variant="ghost"
                          iconOnly
                          description={t('deleteConfirm', { amount: formatMoney(a.amount) })}
                          onDelete={async () => {
                            await api(`/workers/${worker.id}/advances/${a.id}`, {
                              method: 'DELETE',
                            });
                            await invalidate('advances');
                          }}
                        />
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="mt-3 text-sm text-muted-foreground">{t('help')}</p>
      </CardContent>
      <AdvanceDialog open={open} onOpenChange={setOpen} workerId={worker.id} advance={editing} />
    </Card>
  );
}
