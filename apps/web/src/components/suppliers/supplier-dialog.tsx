'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type SupplierCreateInput, type SupplierDto, supplierCreateSchema } from '@sc/shared';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { SelectField, TextField, TextareaField } from '@/components/forms/fields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';

const FIELDS = ['name', 'type', 'phone', 'address', 'notes'] as const;
const toValues = (s?: SupplierDto | null): SupplierCreateInput => ({
  name: s?.name ?? '',
  type: s?.type ?? ('' as SupplierCreateInput['type']),
  phone: s?.phone ?? '',
  address: s?.address ?? '',
  notes: s?.notes ?? '',
});

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierDto | null;
  onSaved?: (s: SupplierDto) => void;
}) {
  const t = useTranslations('suppliers');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const form = useForm<SupplierCreateInput, unknown, z.output<typeof supplierCreateSchema>>({
    resolver: zodResolver(supplierCreateSchema),
    values: toValues(supplier),
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = supplier
        ? await api<SupplierDto>(`/suppliers/${supplier.id}`, { method: 'PATCH', body: values })
        : await api<SupplierDto>('/suppliers', { method: 'POST', body: values });
      await invalidate('suppliers');
      toast.success(tc('savedOk'));
      onSaved?.(saved);
      onOpenChange(false);
      form.reset(toValues(null));
    } catch (err) {
      if (!applyServerErrors(err, form.setError, FIELDS)) toast.error(errorMessage(err));
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{supplier ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-5 md:grid-cols-2"
          data-testid="supplier-form"
        >
          <TextField
            control={form.control}
            name="name"
            label={t('fields.name')}
            className="md:col-span-2"
            idPrefix="supplier"
          />
          <SelectField
            control={form.control}
            name="type"
            label={t('fields.type')}
            enumName="SupplierType"
            idPrefix="supplier"
          />
          <TextField
            control={form.control}
            name="phone"
            type="tel"
            label={t('fields.phone')}
            idPrefix="supplier"
          />
          <TextareaField
            control={form.control}
            name="address"
            label={t('fields.address')}
            rows={2}
            className="md:col-span-2"
            idPrefix="supplier"
          />
          <TextareaField
            control={form.control}
            name="notes"
            label={t('fields.notes')}
            rows={2}
            className="md:col-span-2"
            idPrefix="supplier"
          />
          <DialogFooter className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => onOpenChange(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-11 min-w-32 text-base"
              disabled={form.formState.isSubmitting}
              data-testid="supplier-submit"
            >
              {form.formState.isSubmitting ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
