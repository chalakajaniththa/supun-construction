'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ChangePasswordInput, type MeResponse, changePasswordSchema } from '@sc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormField } from '@/components/forms/form-field';
import { Input } from '@/components/ui/input';
import { useErrorMessage } from '@/hooks/use-error-message';
import { ApiError, api } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { queryKeys } from '@/lib/query-keys';
import { SettingsSection } from './settings-section';

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const;
const EMPTY: ChangePasswordInput = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordForm() {
  const t = useTranslations('settings.password');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ChangePasswordInput) {
    try {
      const me = await api<MeResponse>('/auth/change-password', { method: 'POST', body: values });
      qc.setQueryData(queryKeys.me, me);
      form.reset(EMPTY);
      toast.success(t('changed'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WRONG_PASSWORD') {
        form.setError('currentPassword', { type: 'server', message: 'WRONG_PASSWORD' });
        return;
      }
      applyServerErrors(err, form.setError, FIELDS);
      toast.error(errorMessage(err));
    }
  }

  return (
    <SettingsSection
      title={t('title')}
      description={t('description')}
      pending={isSubmitting}
      submitLabel={t('submit')}
      testId="form-password"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      {FIELDS.map((key) => (
        <FormField
          key={key}
          id={`pw-${key}`}
          label={t(key)}
          error={errors[key]}
          className="md:col-span-2"
        >
          <Input
            id={`pw-${key}`}
            type="password"
            autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
            className="h-11 max-w-sm text-base"
            {...form.register(key)}
          />
        </FormField>
      ))}
    </SettingsSection>
  );
}
