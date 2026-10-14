'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type BillingSettings,
  type CompanySettings,
  type PayrollSettings,
  type ReminderSettings,
  type SettingsMap,
  billingSettingsSchema,
  companySettingsSchema,
  payrollSettingsSchema,
} from '@sc/shared';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { type FieldValues, type UseFormReturn, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/forms/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useUpdateSetting } from '@/hooks/use-settings';
import { applyServerErrors } from '@/lib/form-errors';
import { SettingsSection as SettingsSectionForm } from './settings-section';

/** Shared save handler: PATCH, toast, map server field errors. */
function useSave<K extends 'company' | 'payroll' | 'reminders' | 'billing', V extends FieldValues>(
  key: K,
  form: UseFormReturn<V>,
  fields: readonly string[],
) {
  const t = useTranslations('settings');
  const errorMessage = useErrorMessage();
  const mutation = useUpdateSetting(key);
  async function save(body: Partial<SettingsMap[K]>) {
    try {
      await mutation.mutateAsync(body);
      toast.success(t('saved'));
    } catch (err) {
      applyServerErrors(err, form.setError, fields);
      toast.error(errorMessage(err));
    }
  }
  return { save, pending: mutation.isPending };
}

// ── Company ──────────────────────────────────────────────────────────────────
const companyFormSchema = companySettingsSchema.omit({ logoDocId: true });
type CompanyFormValues = z.input<typeof companyFormSchema>;
const COMPANY_FIELDS = ['name', 'address', 'phone', 'email', 'cidaGrade'] as const;

export function CompanyForm({ value }: { value: CompanySettings }) {
  const t = useTranslations('settings.company');
  const form = useForm<CompanyFormValues, unknown, z.output<typeof companyFormSchema>>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: pick(value, COMPANY_FIELDS),
  });
  useEffect(() => form.reset(pick(value, COMPANY_FIELDS)), [value, form]);
  const { save, pending } = useSave('company', form, COMPANY_FIELDS);
  const { errors } = form.formState;

  return (
    <SettingsSectionForm
      title={t('title')}
      description={t('description')}
      pending={pending}
      testId="form-company"
      onSubmit={form.handleSubmit((v) => save(v))}
    >
      <FormField id="company-name" label={t('name')} error={errors.name} className="md:col-span-2">
        <Input id="company-name" className="h-11 text-base" {...form.register('name')} />
      </FormField>
      <FormField
        id="company-address"
        label={t('address')}
        error={errors.address}
        className="md:col-span-2"
      >
        <Textarea
          id="company-address"
          rows={2}
          className="text-base"
          {...form.register('address')}
        />
      </FormField>
      <FormField id="company-phone" label={t('phone')} error={errors.phone}>
        <Input
          id="company-phone"
          type="tel"
          className="h-11 text-base"
          {...form.register('phone')}
        />
      </FormField>
      <FormField id="company-email" label={t('email')} error={errors.email}>
        <Input
          id="company-email"
          type="email"
          className="h-11 text-base"
          {...form.register('email')}
        />
      </FormField>
      <FormField id="company-cida" label={t('cidaGrade')} error={errors.cidaGrade}>
        <Input id="company-cida" className="h-11 text-base" {...form.register('cidaGrade')} />
      </FormField>
    </SettingsSectionForm>
  );
}

// ── Payroll ──────────────────────────────────────────────────────────────────
type PayrollFormValues = z.input<typeof payrollSettingsSchema>;
const PAYROLL_FIELDS = [
  'epfEmployeePct',
  'epfEmployerPct',
  'etfEmployerPct',
  'workingDaysPerMonth',
  'otMultiplier',
  'permanentOtDivisor',
  'dailyStandardHours',
] as const;

function payrollDefaults(v: PayrollSettings): Record<(typeof PAYROLL_FIELDS)[number], string> {
  return Object.fromEntries(PAYROLL_FIELDS.map((k) => [k, String(v[k])])) as Record<
    (typeof PAYROLL_FIELDS)[number],
    string
  >;
}

export function PayrollForm({ value }: { value: PayrollSettings }) {
  const t = useTranslations('settings.payroll');
  const form = useForm<PayrollFormValues, unknown, PayrollSettings>({
    resolver: zodResolver(payrollSettingsSchema),
    defaultValues: payrollDefaults(value),
  });
  useEffect(() => form.reset(payrollDefaults(value)), [value, form]);
  const { save, pending } = useSave('payroll', form, PAYROLL_FIELDS);
  const { errors } = form.formState;

  return (
    <SettingsSectionForm
      title={t('title')}
      description={t('description')}
      pending={pending}
      testId="form-payroll"
      onSubmit={form.handleSubmit((v) => save(v))}
    >
      {PAYROLL_FIELDS.map((key) => (
        <FormField key={key} id={`payroll-${key}`} label={t(key)} error={errors[key]}>
          <Input
            id={`payroll-${key}`}
            inputMode="decimal"
            className="h-11 max-w-40 text-right text-base tabular-nums"
            {...form.register(key)}
          />
        </FormField>
      ))}
    </SettingsSectionForm>
  );
}

// ── Reminders ────────────────────────────────────────────────────────────────
const remindersFormSchema = z.object({
  daysBefore: z
    .string()
    .trim()
    .min(1, 'REQUIRED')
    .refine(
      (s) =>
        s
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
          .every((p) => /^\d+$/.test(p) && Number(p) >= 1 && Number(p) <= 365),
      { message: 'DAYS_LIST' },
    ),
});
type RemindersFormValues = z.infer<typeof remindersFormSchema>;

export function RemindersForm({ value }: { value: ReminderSettings }) {
  const t = useTranslations('settings.reminders');
  const toText = (v: ReminderSettings) => ({ daysBefore: v.daysBefore.join(', ') });
  const form = useForm<RemindersFormValues>({
    resolver: zodResolver(remindersFormSchema),
    defaultValues: toText(value),
  });
  useEffect(() => form.reset({ daysBefore: value.daysBefore.join(', ') }), [value, form]);
  const { save, pending } = useSave('reminders', form, ['daysBefore']);
  const { errors } = form.formState;

  return (
    <SettingsSectionForm
      title={t('title')}
      description={t('description')}
      pending={pending}
      testId="form-reminders"
      onSubmit={form.handleSubmit((v) =>
        save({
          daysBefore: v.daysBefore
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
            .map(Number),
        }),
      )}
    >
      <FormField
        id="reminders-days"
        label={t('daysBefore')}
        description={t('daysHint')}
        error={errors.daysBefore}
        className="md:col-span-2"
      >
        <Input
          id="reminders-days"
          className="h-11 max-w-xs text-base"
          {...form.register('daysBefore')}
        />
      </FormField>
    </SettingsSectionForm>
  );
}

// ── Billing ──────────────────────────────────────────────────────────────────
type BillingFormValues = z.input<typeof billingSettingsSchema>;
const BILLING_FIELDS = ['defaultRetentionPct', 'defaultRetentionCapPct'] as const;

export function BillingForm({ value }: { value: BillingSettings }) {
  const t = useTranslations('settings.billing');
  const form = useForm<BillingFormValues, unknown, BillingSettings>({
    resolver: zodResolver(billingSettingsSchema),
    defaultValues: value,
  });
  useEffect(() => form.reset(value), [value, form]);
  const { save, pending } = useSave('billing', form, BILLING_FIELDS);
  const { errors } = form.formState;

  return (
    <SettingsSectionForm
      title={t('title')}
      description={t('description')}
      pending={pending}
      testId="form-billing"
      onSubmit={form.handleSubmit((v) => save(v))}
    >
      {BILLING_FIELDS.map((key) => (
        <FormField key={key} id={`billing-${key}`} label={t(key)} error={errors[key]}>
          <Input
            id={`billing-${key}`}
            inputMode="decimal"
            className="h-11 max-w-40 text-right text-base tabular-nums"
            {...form.register(key)}
          />
        </FormField>
      ))}
    </SettingsSectionForm>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, obj[k]])) as Pick<T, K>;
}
