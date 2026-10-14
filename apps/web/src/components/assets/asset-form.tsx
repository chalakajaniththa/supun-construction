'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AssetCreateInput,
  type AssetDto,
  VEHICLE_CATEGORIES,
  assetCreateSchema,
  toDay,
} from '@sc/shared';
import { Decimal } from 'decimal.js';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormActions, FormSection } from '@/components/forms/form-card';
import {
  DateField,
  MoneyField,
  NumberField,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
} from '@/components/forms/fields';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';

type Values = AssetCreateInput;
const FIELDS = Object.keys(assetCreateSchema.shape);

/** Decimal strings from the API without trailing ".00" / ".000" noise for meter fields. */
const qty = (v: string | null | undefined) => (v ? new Decimal(v).toString() : '');

function toValues(a: AssetDto | null): Values {
  const s = (v: string | number | null | undefined) =>
    v === null || v === undefined ? '' : String(v);
  return {
    name: s(a?.name),
    category: a?.category ?? ('' as Values['category']),
    make: s(a?.make),
    model: s(a?.model),
    registrationNo: s(a?.registrationNo),
    chassisNo: s(a?.chassisNo),
    engineNo: s(a?.engineNo),
    yearOfManufacture: s(a?.yearOfManufacture),
    purchaseDate: toDay(a?.purchaseDate),
    purchaseCost: s(a?.purchaseCost),
    ownership: a?.ownership ?? 'OWNED',
    status: a?.status ?? 'AVAILABLE',
    meterType: a?.meterType ?? 'HOURS',
    currentMeter: qty(a?.currentMeter),
    serviceIntervalMeter: qty(a?.serviceIntervalMeter),
    lastServiceMeter: qty(a?.lastServiceMeter),
    internalRatePerHour: s(a?.internalRatePerHour),
    internalRatePerDay: s(a?.internalRatePerDay),
    isVehicle: a?.isVehicle ?? false,
    notes: s(a?.notes),
  };
}

export function AssetForm({ asset }: { asset?: AssetDto }) {
  const t = useTranslations('assets');
  const tc = useTranslations('common');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const form = useForm<Values, unknown, z.output<typeof assetCreateSchema>>({
    resolver: zodResolver(assetCreateSchema),
    defaultValues: toValues(asset ?? null),
  });

  // New machines in a vehicle category start as "vehicle" (suggests licence / insurance documents).
  const category = useWatch({ control: form.control, name: 'category' });
  useEffect(() => {
    if (!asset && category) form.setValue('isVehicle', isVehicleCategory(category));
  }, [asset, category, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = asset
        ? await api<AssetDto>(`/assets/${asset.id}`, { method: 'PATCH', body: values })
        : await api<AssetDto>('/assets', { method: 'POST', body: values });
      await invalidate('assets');
      toast.success(tc('savedOk'));
      router.push(`/assets/${saved.id}`);
    } catch (err) {
      applyServerErrors(err, form.setError, FIELDS);
      toast.error(errorMessage(err));
    }
  });
  const c = form.control;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" data-testid="asset-form">
      <FormSection title={t('sections.basic')}>
        <TextField control={c} name="name" label={t('fields.name')} />
        <SelectField
          control={c}
          name="category"
          label={t('fields.category')}
          enumName="AssetCategory"
        />
        <SelectField control={c} name="status" label={t('fields.status')} enumName="AssetStatus" />
        <TextField control={c} name="make" label={t('fields.make')} />
        <TextField control={c} name="model" label={t('fields.model')} />
        <NumberField control={c} name="yearOfManufacture" label={t('fields.yearOfManufacture')} />
        <SwitchField
          control={c}
          name="isVehicle"
          label={t('fields.isVehicle')}
          description={t('fields.isVehicleHint')}
          className="md:col-span-2 xl:col-span-3"
        />
      </FormSection>

      <FormSection title={t('sections.registration')}>
        <TextField control={c} name="registrationNo" label={t('fields.registrationNo')} />
        <TextField control={c} name="chassisNo" label={t('fields.chassisNo')} />
        <TextField control={c} name="engineNo" label={t('fields.engineNo')} />
        <SelectField
          control={c}
          name="ownership"
          label={t('fields.ownership')}
          enumName="AssetOwnership"
        />
        <DateField control={c} name="purchaseDate" label={t('fields.purchaseDate')} />
        <MoneyField control={c} name="purchaseCost" label={t('fields.purchaseCost')} />
      </FormSection>

      <FormSection title={t('sections.meter')} description={t('sections.meterHint')}>
        <SelectField
          control={c}
          name="meterType"
          label={t('fields.meterType')}
          enumName="MeterType"
        />
        <NumberField
          control={c}
          name="currentMeter"
          label={t('fields.currentMeter')}
          decimals={3}
        />
        <NumberField
          control={c}
          name="serviceIntervalMeter"
          label={t('fields.serviceIntervalMeter')}
          decimals={3}
        />
        <NumberField
          control={c}
          name="lastServiceMeter"
          label={t('fields.lastServiceMeter')}
          decimals={3}
        />
        <MoneyField
          control={c}
          name="internalRatePerHour"
          label={t('fields.internalRatePerHour')}
        />
        <MoneyField control={c} name="internalRatePerDay" label={t('fields.internalRatePerDay')} />
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

/** New assets in vehicle categories start with "is a vehicle" switched on. */
export const isVehicleCategory = (category: string) =>
  (VEHICLE_CATEGORIES as readonly string[]).includes(category);
