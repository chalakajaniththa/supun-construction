'use client';

import { BOND_STATUSES, BOND_TYPES, type BondDto, type BondStatus } from '@sc/shared';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteButton } from '@/components/delete-button';
import { DocumentPanel } from '@/components/documents/document-panel';
import { ExpiryBadge } from '@/components/documents/expiry-badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney, todayInColombo } from '@/lib/format';

function BondDialog({
  projectId,
  bond,
  open,
  onOpenChange,
}: {
  projectId: string;
  bond: BondDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('bonds');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const { form, setForm, handle, err } = useDialogForm(
    open,
    () => ({
      type: (bond?.type ?? 'PERFORMANCE_BOND') as string,
      bank: bond?.bank ?? '',
      referenceNo: bond?.referenceNo ?? '',
      amount: bond?.amount ?? '',
      issueDate: bond?.issueDate.slice(0, 10) ?? todayInColombo(),
      expiryDate: bond?.expiryDate.slice(0, 10) ?? '',
      status: (bond?.status ?? 'ACTIVE') as string,
      notes: bond?.notes ?? '',
    }),
    bond,
  );
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      if (bond)
        await api(`/projects/${projectId}/bonds/${bond.id}`, { method: 'PATCH', body: form });
      else await api(`/projects/${projectId}/bonds`, { method: 'POST', body: form });
      await invalidate('projects', 'bonds');
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
      <DialogContent className="sm:max-w-lg" data-testid="bond-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{bond ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formHelp')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="bd-type" label={t('fields.type')} className="sm:col-span-2">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger id="bd-type" className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOND_TYPES.map((x) => (
                  <SelectItem key={x} value={x}>
                    {enumLabel('BondType', x)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="bd-bank" label={t('fields.bank')} error={err('bank')}>
            <Input
              id="bd-bank"
              value={form.bank}
              onChange={(e) => setForm({ ...form, bank: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="bd-ref" label={t('fields.referenceNo')} error={err('referenceNo')}>
            <Input
              id="bd-ref"
              value={form.referenceNo}
              onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField
            id="bd-amount"
            label={t('fields.amount')}
            error={err('amount')}
            className="sm:col-span-2"
          >
            <MoneyInput
              id="bd-amount"
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="bd-issue" label={t('fields.issueDate')} error={err('issueDate')}>
            <DateInput
              id="bd-issue"
              value={form.issueDate}
              onChange={(v) => setForm({ ...form, issueDate: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="bd-expiry" label={t('fields.expiryDate')} error={err('expiryDate')}>
            <DateInput
              id="bd-expiry"
              value={form.expiryDate}
              onChange={(v) => setForm({ ...form, expiryDate: v })}
              className="h-11 text-base"
            />
          </FormField>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm font-medium">{t('fields.status')}</span>
            <Segmented
              label={t('fields.status')}
              value={form.status as BondStatus}
              onChange={(v) => setForm({ ...form, status: v })}
              options={BOND_STATUSES.map((s) => ({
                value: s,
                label: enumLabel('BondStatus', s),
                tone: s === 'ACTIVE' ? 'success' : s === 'EXPIRED' ? 'danger' : undefined,
              }))}
            />
          </div>
          <FormField id="bd-notes" label={t('fields.notes')} className="sm:col-span-2">
            <Textarea
              id="bd-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="text-base"
            />
          </FormField>
        </div>
        <DialogButtons
          onCancel={() => onOpenChange(false)}
          onSave={save}
          saving={saving}
          testId="bond-save"
        />
      </DialogContent>
    </Dialog>
  );
}

/** Bonds tab: bank guarantees with expiry badges, and the bond copies. */
export function ProjectBonds({ projectId }: { projectId: string }) {
  const t = useTranslations('bonds');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const { data } = useApi<BondDto[]>('projects', `/projects/${projectId}/bonds`);
  const [dialog, setDialog] = useState<{ open: boolean; bond: BondDto | null }>({
    open: false,
    bond: null,
  });
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <p className="text-muted-foreground">{t('help')}</p>
          </div>
          <Button
            size="lg"
            className="h-11 text-base"
            onClick={() => setDialog({ open: true, bond: null })}
            data-testid="add-bond"
          >
            <Plus aria-hidden />
            {t('add')}
          </Button>
        </CardHeader>
        <CardContent>
          {!data?.length ? (
            <p className="py-6 text-center text-muted-foreground">{t('empty')}</p>
          ) : (
            <Table data-testid="bonds-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-normal">{t('fields.type')}</TableHead>
                  <TableHead className="whitespace-normal">{t('fields.bank')}</TableHead>
                  <TableHead className="text-right whitespace-normal">
                    {t('fields.amount')}
                  </TableHead>
                  <TableHead className="whitespace-normal">{t('fields.issueDate')}</TableHead>
                  <TableHead className="whitespace-normal">{t('fields.expiryDate')}</TableHead>
                  <TableHead className="whitespace-normal">{t('fields.status')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-normal">
                      <span className="font-medium">{enumLabel('BondType', b.type)}</span>
                      <span className="block text-sm text-muted-foreground">{b.referenceNo}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal">{b.bank}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {formatMoney(b.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(b.issueDate)}</TableCell>
                    <TableCell>
                      {b.status === 'ACTIVE' ? (
                        <ExpiryBadge expiry={b.expiryDate} wrap />
                      ) : (
                        formatDate(b.expiryDate)
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={b.status}>{enumLabel('BondStatus', b.status)}</StatusChip>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          aria-label={t('editTitle')}
                          onClick={() => setDialog({ open: true, bond: b })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <DeleteButton
                          variant="ghost"
                          iconOnly
                          description={t('deleteConfirm', { ref: b.referenceNo })}
                          onDelete={async () => {
                            await api(`/projects/${projectId}/bonds/${b.id}`, { method: 'DELETE' });
                            await invalidate('projects', 'bonds');
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
      </Card>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('copies')}</h2>
        <p className="text-muted-foreground">{t('copiesHelp')}</p>
        <DocumentPanel ownerType="PROJECT" ownerId={projectId} category="BOND_COPY" />
      </section>
      <BondDialog
        projectId={projectId}
        bond={dialog.bond}
        open={dialog.open}
        onOpenChange={(o) => setDialog({ ...dialog, open: o })}
      />
    </div>
  );
}
