'use client';

import { PAYMENT_METHODS, type PaymentMethod, type StatementDto } from '@sc/shared';
import { HandCoins } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteButton } from '@/components/delete-button';
import { DateInput } from '@/components/forms/date-input';
import { EnumSelect, useEnumLabel } from '@/components/forms/enum-select';
import { FormField } from '@/components/forms/form-field';
import { MoneyInput } from '@/components/forms/money-input';
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
import { api } from '@/lib/api-client';
import { formatDate, formatMoney, todayInColombo } from '@/lib/format';
import { cn } from '@/lib/utils';

function PaymentDialog({
  open,
  onOpenChange,
  supplierId,
  owed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplierId: string;
  owed: string | undefined;
}) {
  const t = useTranslations('suppliers.payment');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const init = () => ({
    date: todayInColombo(),
    amount: '',
    method: 'CASH' as PaymentMethod,
    reference: '',
    notes: '',
  });
  const [form, setForm] = useState(init);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setForm(init());
  }
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return setError('MUST_BE_POSITIVE');
    setError(null);
    setSaving(true);
    try {
      await api(`/suppliers/${supplierId}/payments`, { method: 'POST', body: form });
      await invalidate('suppliers');
      toast.success(t('saved'));
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="payment-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('title')}</DialogTitle>
          <DialogDescription>
            {owed ? t('owed', { amount: formatMoney(owed) }) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pay-date" label={t('date')}>
            <DateInput
              id="pay-date"
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField
            id="pay-amount"
            label={t('amount')}
            error={error ? { message: error } : undefined}
          >
            <MoneyInput
              id="pay-amount"
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="pay-method" label={t('method')}>
            <EnumSelect
              id="pay-method"
              enumName="PaymentMethod"
              values={PAYMENT_METHODS}
              value={form.method}
              onChange={(v) => setForm({ ...form, method: v as PaymentMethod })}
            />
          </FormField>
          <FormField id="pay-reference" label={t('reference')} description={t('referenceHint')}>
            <Input
              id="pay-reference"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="pay-notes" label={t('notes')} className="sm:col-span-2">
            <Input
              id="pay-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
            data-testid="payment-save"
          >
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Supplier → Statement: credit purchases, credit expenses and payments with a running balance. */
export function SupplierStatement({ supplierId }: { supplierId: string }) {
  const t = useTranslations('suppliers.statement');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data } = useApi<StatementDto>('suppliers', `/suppliers/${supplierId}/statement`, {
    from: from || undefined,
    to: to || undefined,
  });
  const [open, setOpen] = useState(false);
  const owed = data?.closingBalance;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg">{t('title')}</CardTitle>
          <p className="mt-1">
            {t('owed')}:{' '}
            <span className="text-2xl font-bold tabular-nums" data-testid="supplier-owed">
              {formatMoney(owed)}
            </span>
          </p>
        </div>
        <Button
          size="lg"
          className="h-11 text-base"
          onClick={() => setOpen(true)}
          data-testid="add-payment"
        >
          <HandCoins aria-hidden />
          {t('addPayment')}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-44 flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t('from')}</span>
            <DateInput
              value={from}
              onChange={setFrom}
              placeholder={t('beginning')}
              className="h-10"
            />
          </div>
          <div className="flex w-44 flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t('to')}</span>
            <DateInput value={to} onChange={setTo} placeholder={t('today')} className="h-10" />
          </div>
          {from || to ? (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              {t('allTime')}
            </Button>
          ) : null}
        </div>
        {!data ? null : (
          <Table data-testid="statement-table">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-normal">{t('date')}</TableHead>
                <TableHead className="whitespace-normal">{t('what')}</TableHead>
                <TableHead className="whitespace-normal">{t('reference')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('debit')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('credit')}</TableHead>
                <TableHead className="text-right whitespace-normal">{t('balance')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40">
                <TableCell colSpan={5} className="font-medium">
                  {t('opening')}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(data.openingBalance)}
                </TableCell>
                <TableCell />
              </TableRow>
              {data.entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                data.entries.map((e) => (
                  <TableRow key={`${e.kind}-${e.id}`}>
                    <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{t(`kind.${e.kind}`)}</p>
                      <p className="text-sm text-muted-foreground">
                        {[e.description, e.method ? enumLabel('PaymentMethod', e.method) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </TableCell>
                    <TableCell>{e.reference ?? '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {Number(e.debit) ? formatMoney(e.debit) : ''}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-success tabular-nums">
                      {Number(e.credit) ? formatMoney(e.credit) : ''}
                    </TableCell>
                    <TableCell
                      className={cn('text-right font-medium whitespace-nowrap tabular-nums')}
                    >
                      {formatMoney(e.balance)}
                    </TableCell>
                    <TableCell>
                      {e.kind === 'PAYMENT' ? (
                        <DeleteButton
                          variant="ghost"
                          iconOnly
                          description={t('deletePayment', { amount: formatMoney(e.credit) })}
                          onDelete={async () => {
                            await api(`/suppliers/${supplierId}/payments/${e.id}`, {
                              method: 'DELETE',
                            });
                            await invalidate('suppliers');
                          }}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  {t('closing')}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(data.totalDebit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(data.totalCredit)}
                </TableCell>
                <TableCell
                  className="text-right font-bold tabular-nums"
                  data-testid="closing-balance"
                >
                  {formatMoney(data.closingBalance)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        )}
        <p className="text-sm text-muted-foreground">{t('help')}</p>
      </CardContent>
      <PaymentDialog open={open} onOpenChange={setOpen} supplierId={supplierId} owed={owed} />
    </Card>
  );
}
