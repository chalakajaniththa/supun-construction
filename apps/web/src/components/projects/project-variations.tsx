'use client';

import {
  VARIATION_STATUSES,
  type EotDto,
  type FinanceSummaryDto,
  type ProjectDetailDto,
  type VariationDto,
  type VariationStatus,
} from '@sc/shared';
import { Pencil, Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney, todayInColombo } from '@/lib/format';

function VariationDialog({
  projectId,
  variation,
  open,
  onOpenChange,
}: {
  projectId: string;
  variation: VariationDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('variations');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const { form, setForm, handle, err } = useDialogForm(
    open,
    () => ({
      title: variation?.title ?? '',
      date: variation?.date.slice(0, 10) ?? todayInColombo(),
      status: (variation?.status ?? 'PENDING') as string,
      amountChange: variation?.amountChange ?? '',
      notes: variation?.notes ?? '',
    }),
    variation,
  );
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, amountChange: form.amountChange || '0' };
      if (variation)
        await api(`/projects/${projectId}/variations/${variation.id}`, { method: 'PATCH', body });
      else await api(`/projects/${projectId}/variations`, { method: 'POST', body });
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
      <DialogContent className="sm:max-w-lg" data-testid="variation-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {variation ? t('editTitle', { n: variation.number }) : t('addTitle')}
          </DialogTitle>
          <DialogDescription>{t('formHelp')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="v-title"
            label={t('fields.title')}
            error={err('title')}
            className="sm:col-span-2"
          >
            <Input
              id="v-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="v-date" label={t('fields.date')} error={err('date')}>
            <DateInput
              id="v-date"
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField
            id="v-amount"
            label={t('fields.amountChange')}
            description={t('amountHelp')}
            error={err('amountChange')}
          >
            <MoneyInput
              id="v-amount"
              allowNegative
              value={form.amountChange}
              onChange={(v) => setForm({ ...form, amountChange: v })}
              className="h-11 text-base"
            />
          </FormField>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm font-medium">{t('fields.status')}</span>
            <Segmented
              label={t('fields.status')}
              value={form.status as VariationStatus}
              onChange={(v) => setForm({ ...form, status: v })}
              options={VARIATION_STATUSES.map((s) => ({
                value: s,
                label: enumLabel('VariationStatus', s),
                tone: s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : 'warning',
              }))}
              testId="variation-status"
            />
          </div>
          <FormField id="v-notes" label={t('fields.notes')} className="sm:col-span-2">
            <Textarea
              id="v-notes"
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
          testId="variation-save"
        />
      </DialogContent>
    </Dialog>
  );
}

function EotDialog({
  projectId,
  eot,
  open,
  onOpenChange,
}: {
  projectId: string;
  eot: EotDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('eot');
  const invalidate = useInvalidate();
  const { form, setForm, handle, err } = useDialogForm(
    open,
    () => ({
      newEndDate: eot?.newEndDate.slice(0, 10) ?? '',
      approvedDate: eot?.approvedDate.slice(0, 10) ?? todayInColombo(),
      reference: eot?.reference ?? '',
      reason: eot?.reason ?? '',
    }),
    eot,
  );
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      if (eot)
        await api(`/projects/${projectId}/extensions/${eot.id}`, { method: 'PATCH', body: form });
      else await api(`/projects/${projectId}/extensions`, { method: 'POST', body: form });
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
      <DialogContent className="sm:max-w-lg" data-testid="eot-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{eot ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formHelp')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="e-new" label={t('fields.newEndDate')} error={err('newEndDate')}>
            <DateInput
              id="e-new"
              value={form.newEndDate}
              onChange={(v) => setForm({ ...form, newEndDate: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="e-approved" label={t('fields.approvedDate')} error={err('approvedDate')}>
            <DateInput
              id="e-approved"
              value={form.approvedDate}
              onChange={(v) => setForm({ ...form, approvedDate: v })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="e-ref" label={t('fields.reference')} className="sm:col-span-2">
            <Input
              id="e-ref"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="h-11 text-base"
            />
          </FormField>
          <FormField id="e-reason" label={t('fields.reason')} className="sm:col-span-2">
            <Textarea
              id="e-reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="text-base"
            />
          </FormField>
        </div>
        <DialogButtons
          onCancel={() => onOpenChange(false)}
          onSave={save}
          saving={saving}
          testId="eot-save"
        />
      </DialogContent>
    </Dialog>
  );
}

/** Variations & time tab: contract changes and extensions of time. */
export function ProjectVariations({ project }: { project: ProjectDetailDto }) {
  const t = useTranslations('variations');
  const te = useTranslations('eot');
  const enumLabel = useEnumLabel();
  const invalidate = useInvalidate();
  const { data: variations } = useApi<VariationDto[]>(
    'projects',
    `/projects/${project.id}/variations`,
  );
  const { data: extensions } = useApi<EotDto[]>('projects', `/projects/${project.id}/extensions`);
  const { data: summary } = useApi<FinanceSummaryDto>(
    'projects',
    `/projects/${project.id}/finance-summary`,
  );
  const [vDialog, setVDialog] = useState<{ open: boolean; item: VariationDto | null }>({
    open: false,
    item: null,
  });
  const [eDialog, setEDialog] = useState<{ open: boolean; item: EotDto | null }>({
    open: false,
    item: null,
  });
  const currentEnd = project.revisedEndDate ?? project.plannedEndDate;

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
            onClick={() => setVDialog({ open: true, item: null })}
            data-testid="add-variation"
          >
            <Plus aria-hidden />
            {t('add')}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {summary ? (
            <dl className="grid gap-4 sm:grid-cols-3" data-testid="contract-values">
              <div>
                <dt className="text-sm text-muted-foreground">{t('original')}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatMoney(summary.contractValue)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('approved')}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatMoney(summary.approvedVariations)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('effective')}</dt>
                <dd className="text-lg font-semibold tabular-nums" data-testid="effective-value">
                  {formatMoney(summary.effectiveContractValue)}
                </dd>
              </div>
            </dl>
          ) : null}
          {!variations?.length ? (
            <p className="py-4 text-center text-muted-foreground">{t('empty')}</p>
          ) : (
            <Table data-testid="variations-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.number')}</TableHead>
                  <TableHead className="whitespace-normal">{t('fields.title')}</TableHead>
                  <TableHead>{t('fields.date')}</TableHead>
                  <TableHead>{t('fields.status')}</TableHead>
                  <TableHead className="text-right whitespace-normal">
                    {t('fields.amountChange')}
                  </TableHead>
                  <TableHead className="text-right whitespace-normal">
                    {t('fields.items')}
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {variations.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{t('number', { n: v.number })}</TableCell>
                    <TableCell className="whitespace-normal">
                      {v.title}
                      {v.notes ? (
                        <span className="block text-sm text-muted-foreground">{v.notes}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(v.date)}</TableCell>
                    <TableCell>
                      <StatusChip status={v.status}>
                        {enumLabel('VariationStatus', v.status)}
                      </StatusChip>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {formatMoney(v.amountChange)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{v.boqItemCount}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          aria-label={t('editTitle', { n: v.number })}
                          onClick={() => setVDialog({ open: true, item: v })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        {v.boqItemCount === 0 ? (
                          <DeleteButton
                            variant="ghost"
                            iconOnly
                            description={t('deleteConfirm', { n: v.number })}
                            onDelete={async () => {
                              await api(`/projects/${project.id}/variations/${v.id}`, {
                                method: 'DELETE',
                              });
                              await invalidate('projects');
                            }}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-sm text-muted-foreground">{t('itemsHelp')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{te('title')}</CardTitle>
            <p className="text-muted-foreground" data-testid="current-end">
              {te('currentEnd', {
                date: formatDate(currentEnd),
                planned: formatDate(project.plannedEndDate),
              })}
            </p>
          </div>
          <Button
            size="lg"
            variant="outline"
            className="h-11 text-base"
            onClick={() => setEDialog({ open: true, item: null })}
            data-testid="add-eot"
          >
            <Plus aria-hidden />
            {te('add')}
          </Button>
        </CardHeader>
        <CardContent>
          {!extensions?.length ? (
            <p className="py-4 text-center text-muted-foreground">{te('empty')}</p>
          ) : (
            <Table data-testid="eot-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-normal">{te('fields.approvedDate')}</TableHead>
                  <TableHead className="whitespace-normal">
                    {te('fields.previousEndDate')}
                  </TableHead>
                  <TableHead className="whitespace-normal">{te('fields.newEndDate')}</TableHead>
                  <TableHead className="whitespace-normal">{te('fields.reference')}</TableHead>
                  <TableHead className="whitespace-normal">{te('fields.reason')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {extensions.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(e.approvedDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(e.previousEndDate)}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDate(e.newEndDate)}
                    </TableCell>
                    <TableCell>{e.reference ?? '—'}</TableCell>
                    <TableCell className="whitespace-normal">{e.reason ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          aria-label={te('editTitle')}
                          onClick={() => setEDialog({ open: true, item: e })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <DeleteButton
                          variant="ghost"
                          iconOnly
                          description={te('deleteConfirm', { date: formatDate(e.newEndDate) })}
                          onDelete={async () => {
                            await api(`/projects/${project.id}/extensions/${e.id}`, {
                              method: 'DELETE',
                            });
                            await invalidate('projects');
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

      <VariationDialog
        projectId={project.id}
        variation={vDialog.item}
        open={vDialog.open}
        onOpenChange={(o) => setVDialog({ ...vDialog, open: o })}
      />
      <EotDialog
        projectId={project.id}
        eot={eDialog.item}
        open={eDialog.open}
        onOpenChange={(o) => setEDialog({ ...eDialog, open: o })}
      />
    </div>
  );
}
