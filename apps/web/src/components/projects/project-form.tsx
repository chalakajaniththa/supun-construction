'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ClientDto,
  type ProjectCreateInput,
  type ProjectDetailDto,
  type WorkerDto,
  projectCreateSchema,
  toDay,
} from '@sc/shared';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useController, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { ClientDialog } from '@/components/clients/client-dialog';
import { EntityPicker } from '@/components/entity-picker';
import { FormActions, FormSection } from '@/components/forms/form-card';
import { FormField } from '@/components/forms/form-field';
import {
  DateField,
  MoneyField,
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from '@/components/forms/fields';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useInvalidate } from '@/hooks/use-resource';
import { useSettings } from '@/hooks/use-settings';
import { api } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';

type Values = ProjectCreateInput;
const FIELDS = Object.keys(projectCreateSchema.shape);

function toValues(
  p: ProjectDetailDto | null,
  defaults: { retentionPct: string; retentionCapPct: string },
): Values {
  const s = (v: string | number | null | undefined) =>
    v === null || v === undefined ? '' : String(v);
  const pct = (v: string | null | undefined) => (v ? String(Number(v)) : '');
  return {
    name: p?.name ?? '',
    type: p?.type ?? ('' as Values['type']),
    source: p?.source ?? ('' as Values['source']),
    clientId: p?.clientId ?? '',
    status: p?.status ?? 'PLANNING',
    location: s(p?.location),
    description: s(p?.description),
    contractValue: s(p?.contractValue),
    contractNo: s(p?.contractNo),
    tenderNo: s(p?.tenderNo),
    startDate: toDay(p?.startDate),
    plannedEndDate: toDay(p?.plannedEndDate),
    revisedEndDate: toDay(p?.revisedEndDate),
    actualEndDate: toDay(p?.actualEndDate),
    retentionPct: p ? pct(p.retentionPct) : defaults.retentionPct,
    retentionCapPct: p ? pct(p.retentionCapPct) : defaults.retentionCapPct,
    advanceAmount: s(p?.advanceAmount),
    advanceRecoveryPct: pct(p?.advanceRecoveryPct),
    dlpMonths: s(p?.dlpMonths ?? 12),
    progressPct: pct(p?.progressPct),
    siteSupervisorWorkerId: p?.siteSupervisorWorkerId ?? '',
    notes: s(p?.notes),
  };
}

/** Create / edit a project: basic details, contract, dates. */
export function ProjectForm({ project }: { project?: ProjectDetailDto }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const { data: settings } = useSettings();
  const defaults = {
    retentionPct: settings?.billing.defaultRetentionPct ?? '10',
    retentionCapPct: settings?.billing.defaultRetentionCapPct ?? '5',
  };
  const form = useForm<Values, unknown, z.output<typeof projectCreateSchema>>({
    resolver: zodResolver(projectCreateSchema),
    values: toValues(project ?? null, defaults),
    resetOptions: { keepDirtyValues: true },
  });
  const client = useController({ control: form.control, name: 'clientId' });
  const supervisor = useController({ control: form.control, name: 'siteSupervisorWorkerId' });
  const [clientDialog, setClientDialog] = useState(false);
  const [newClientLabel, setNewClientLabel] = useState<string>();

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = project
        ? await api<ProjectDetailDto>(`/projects/${project.id}`, { method: 'PATCH', body: values })
        : await api<ProjectDetailDto>('/projects', { method: 'POST', body: values });
      await invalidate('projects', 'clients');
      toast.success(tc('savedOk'));
      router.push(`/projects/${saved.id}`);
    } catch (err) {
      applyServerErrors(err, form.setError, FIELDS);
      toast.error(errorMessage(err));
    }
  });
  const c = form.control;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" data-testid="project-form">
      <FormSection title={t('sections.basic')} description={t('sections.basicHint')}>
        <TextField
          control={c}
          name="name"
          label={t('fields.name')}
          className="md:col-span-2 xl:col-span-3"
        />
        <SelectField control={c} name="type" label={t('fields.type')} enumName="ProjectType" />
        <SelectField
          control={c}
          name="source"
          label={t('fields.source')}
          enumName="ProjectSource"
        />
        <SelectField
          control={c}
          name="status"
          label={t('fields.status')}
          enumName="ProjectStatus"
        />
        <FormField
          id="f-clientId"
          label={t('fields.client')}
          error={client.fieldState.error}
          className="md:col-span-2"
        >
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <EntityPicker<ClientDto>
                id="f-clientId"
                resource="clients"
                value={client.field.value}
                onChange={(id) => client.field.onChange(id)}
                toItem={(r) => ({ id: r.id, label: r.name, hint: r.contactPerson ?? undefined })}
                selectedLabel={project?.client.name ?? newClientLabel}
                invalid={client.fieldState.invalid}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => setClientDialog(true)}
            >
              <Plus aria-hidden />
              {t('newClient')}
            </Button>
          </div>
        </FormField>
        <TextField control={c} name="location" label={t('fields.location')} />
        <TextareaField
          control={c}
          name="description"
          label={t('fields.description')}
          className="md:col-span-2 xl:col-span-3"
          rows={2}
        />
      </FormSection>

      <FormSection title={t('sections.contract')} description={t('sections.contractHint')}>
        <MoneyField control={c} name="contractValue" label={t('fields.contractValue')} />
        <TextField control={c} name="contractNo" label={t('fields.contractNo')} />
        <TextField control={c} name="tenderNo" label={t('fields.tenderNo')} />
        <NumberField
          control={c}
          name="retentionPct"
          label={t('fields.retentionPct')}
          decimals={4}
        />
        <NumberField
          control={c}
          name="retentionCapPct"
          label={t('fields.retentionCapPct')}
          decimals={4}
        />
        <NumberField control={c} name="dlpMonths" label={t('fields.dlpMonths')} />
        <MoneyField control={c} name="advanceAmount" label={t('fields.advanceAmount')} />
        <NumberField
          control={c}
          name="advanceRecoveryPct"
          label={t('fields.advanceRecoveryPct')}
          decimals={4}
        />
        <NumberField
          control={c}
          name="progressPct"
          label={t('fields.progressPct')}
          description={t('fields.progressHint')}
          decimals={2}
        />
        <FormField
          id="f-supervisor"
          label={t('fields.supervisor')}
          error={supervisor.fieldState.error}
          className="md:col-span-2"
        >
          <EntityPicker<WorkerDto>
            id="f-supervisor"
            resource="workers"
            params={{ active: true }}
            value={supervisor.field.value}
            onChange={(id) => supervisor.field.onChange(id)}
            toItem={(w) => ({ id: w.id, label: w.fullName, hint: w.code })}
            selectedLabel={project?.siteSupervisor?.fullName}
            allowClear
          />
        </FormField>
      </FormSection>

      <FormSection title={t('sections.dates')}>
        <DateField control={c} name="startDate" label={t('fields.startDate')} />
        <DateField control={c} name="plannedEndDate" label={t('fields.plannedEndDate')} />
        <DateField control={c} name="revisedEndDate" label={t('fields.revisedEndDate')} />
        <DateField control={c} name="actualEndDate" label={t('fields.actualEndDate')} />
        <TextareaField
          control={c}
          name="notes"
          label={t('fields.notes')}
          className="md:col-span-2"
          rows={2}
        />
      </FormSection>

      <FormActions pending={form.formState.isSubmitting} onCancel={() => router.back()} />

      <ClientDialog
        open={clientDialog}
        onOpenChange={setClientDialog}
        onSaved={(saved) => {
          setNewClientLabel(saved.name);
          form.setValue('clientId', saved.id, { shouldValidate: true, shouldDirty: true });
        }}
      />
    </form>
  );
}
