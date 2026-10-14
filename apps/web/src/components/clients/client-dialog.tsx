'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ClientCreateInput, type ClientDto, clientCreateSchema } from '@sc/shared';
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

const FIELDS = ['name', 'type', 'contactPerson', 'phone', 'email', 'address', 'notes'] as const;

const toValues = (c?: ClientDto | null): ClientCreateInput => ({
  name: c?.name ?? '',
  type: c?.type ?? ('' as ClientCreateInput['type']),
  contactPerson: c?.contactPerson ?? '',
  phone: c?.phone ?? '',
  email: c?.email ?? '',
  address: c?.address ?? '',
  notes: c?.notes ?? '',
});

/** Add / edit a client in a dialog. Calls onSaved with the saved client. */
export function ClientDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientDto | null;
  onSaved?: (client: ClientDto) => void;
}) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const form = useForm<ClientCreateInput, unknown, z.output<typeof clientCreateSchema>>({
    resolver: zodResolver(clientCreateSchema),
    values: toValues(client),
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = client
        ? await api<ClientDto>(`/clients/${client.id}`, { method: 'PATCH', body: values })
        : await api<ClientDto>('/clients', { method: 'POST', body: values });
      await invalidate('clients', 'projects');
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
          <DialogTitle className="text-xl">{client ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-5 md:grid-cols-2"
          data-testid="client-form"
        >
          <TextField
            control={form.control}
            name="name"
            label={t('fields.name')}
            className="md:col-span-2"
            idPrefix="client"
          />
          <SelectField
            control={form.control}
            name="type"
            label={t('fields.type')}
            enumName="ClientType"
            idPrefix="client"
          />
          <TextField
            control={form.control}
            name="contactPerson"
            label={t('fields.contactPerson')}
            idPrefix="client"
          />
          <TextField
            control={form.control}
            name="phone"
            type="tel"
            label={t('fields.phone')}
            idPrefix="client"
          />
          <TextField
            control={form.control}
            name="email"
            type="email"
            label={t('fields.email')}
            idPrefix="client"
          />
          <TextareaField
            control={form.control}
            name="address"
            label={t('fields.address')}
            rows={2}
            className="md:col-span-2"
            idPrefix="client"
          />
          <TextareaField
            control={form.control}
            name="notes"
            label={t('fields.notes')}
            rows={2}
            className="md:col-span-2"
            idPrefix="client"
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
              data-testid="client-submit"
            >
              {form.formState.isSubmitting ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
