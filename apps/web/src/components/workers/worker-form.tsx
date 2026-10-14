'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type WorkerCreateInput,
  type WorkerDto,
  toDay,
  workerCreateSchema,
  workerUpdateSchema,
} from '@sc/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormActions, FormSection } from '@/components/forms/form-card';
import {
  DateField,
  MoneyField,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
} from '@/components/forms/fields';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { todayInColombo } from '@/lib/format';

type Values = WorkerCreateInput;
const FIELDS = [
  ...Object.keys(workerCreateSchema.shape),
  'dailyRate',
  'monthlySalary',
  'otHourlyRate',
];

function toValues(w: WorkerDto | null): Values {
  const s = (v: string | null | undefined) => v ?? '';
  return {
    fullName: s(w?.fullName),
    nameSinhala: s(w?.nameSinhala),
    nic: s(w?.nic),
    phone: s(w?.phone),
    address: s(w?.address),
    dateOfBirth: toDay(w?.dateOfBirth),
    skill: w?.skill ?? ('' as Values['skill']),
    type: w?.type ?? 'DAILY',
    joinedDate: w ? toDay(w.joinedDate) : todayInColombo(),
    leftDate: toDay(w?.leftDate),
    active: w?.active ?? true,
    epfNo: s(w?.epfNo),
    bankName: s(w?.bankName),
    bankAccountNo: s(w?.bankAccountNo),
    emergencyContact: s(w?.emergencyContact),
    notes: s(w?.notes),
    dailyRate: '',
    monthlySalary: '',
    otHourlyRate: '',
  };
}

/** Add / edit a worker. On "add", the starting pay becomes the first rate. */
export function WorkerForm({ worker }: { worker?: WorkerDto }) {
  const t = useTranslations('workers');
  const tc = useTranslations('common');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const schema = worker ? workerUpdateSchema : workerCreateSchema;
  const form = useForm<Values, unknown, z.output<typeof workerCreateSchema>>({
    resolver: zodResolver(schema as typeof workerCreateSchema),
    defaultValues: toValues(worker ?? null),
  });
  const type = useWatch({ control: form.control, name: 'type' });

  const submit = form.handleSubmit(async (values) => {
    try {
      let saved: WorkerDto;
      if (worker) {
        const { dailyRate: _d, monthlySalary: _m, otHourlyRate: _o, ...body } = values;
        saved = await api<WorkerDto>(`/workers/${worker.id}`, { method: 'PATCH', body });
      } else {
        saved = await api<WorkerDto>('/workers', { method: 'POST', body: values });
      }
      await invalidate('workers');
      toast.success(tc('savedOk'));
      router.push(`/workers/${saved.id}`);
    } catch (err) {
      applyServerErrors(err, form.setError, FIELDS);
      toast.error(errorMessage(err));
    }
  });
  const c = form.control;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" data-testid="worker-form">
      <FormSection title={t('sections.personal')}>
        <TextField control={c} name="fullName" label={t('fields.fullName')} />
        <TextField control={c} name="nameSinhala" label={t('fields.nameSinhala')} />
        <TextField
          control={c}
          name="nic"
          label={t('fields.nic')}
          description={t('fields.nicHint')}
        />
        <TextField control={c} name="phone" type="tel" label={t('fields.phone')} />
        <DateField control={c} name="dateOfBirth" label={t('fields.dateOfBirth')} />
        <TextField control={c} name="emergencyContact" label={t('fields.emergencyContact')} />
        <TextareaField
          control={c}
          name="address"
          label={t('fields.address')}
          rows={2}
          className="md:col-span-2"
        />
      </FormSection>

      <FormSection title={t('sections.work')}>
        <SelectField control={c} name="skill" label={t('fields.skill')} enumName="WorkerSkill" />
        <SelectField
          control={c}
          name="type"
          label={t('fields.type')}
          enumName="WorkerType"
          description={t('fields.typeHint')}
        />
        <DateField control={c} name="joinedDate" label={t('fields.joinedDate')} />
        <DateField control={c} name="leftDate" label={t('fields.leftDate')} />
        <SwitchField
          control={c}
          name="active"
          label={t('fields.active')}
          description={t('fields.activeHint')}
        />
      </FormSection>

      {!worker ? (
        <FormSection title={t('sections.startingPay')} description={t('sections.startingPayHint')}>
          {type === 'PERMANENT' ? (
            <MoneyField control={c} name="monthlySalary" label={t('fields.monthlySalary')} />
          ) : (
            <MoneyField control={c} name="dailyRate" label={t('fields.dailyRate')} />
          )}
          <MoneyField
            control={c}
            name="otHourlyRate"
            label={t('fields.otHourlyRate')}
            description={t('fields.otHint')}
          />
        </FormSection>
      ) : null}

      <FormSection title={t('sections.bank')}>
        <TextField control={c} name="epfNo" label={t('fields.epfNo')} />
        <TextField control={c} name="bankName" label={t('fields.bankName')} />
        <TextField control={c} name="bankAccountNo" label={t('fields.bankAccountNo')} />
        <TextareaField
          control={c}
          name="notes"
          label={t('fields.notes')}
          rows={2}
          className="md:col-span-2 xl:col-span-3"
        />
      </FormSection>

      <FormActions pending={form.formState.isSubmitting} onCancel={() => router.back()} />
    </form>
  );
}
