'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, type MeResponse, loginSchema } from '@sc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/forms/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useErrorMessage } from '@/hooks/use-error-message';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function LoginForm({ nextPath }: { nextPath: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      const me = await api<MeResponse>('/auth/login', {
        method: 'POST',
        body: values,
        skipAuthRedirect: true,
      });
      qc.setQueryData(queryKeys.me, me);
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setServerError(errorMessage(err));
      form.setValue('password', '');
      form.setFocus('password');
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      {serverError ? (
        <Alert variant="destructive" data-testid="login-error">
          <AlertDescription className="text-base">{serverError}</AlertDescription>
        </Alert>
      ) : null}
      <FormField id="username" label={t('username')} error={errors.username}>
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          className="h-12 text-lg"
          aria-invalid={!!errors.username}
          {...form.register('username')}
        />
      </FormField>
      <FormField id="password" label={t('password')} error={errors.password}>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="h-12 pr-12 text-lg"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </Button>
        </div>
      </FormField>
      <Button
        type="submit"
        size="lg"
        className="h-12 text-lg"
        disabled={isSubmitting}
        data-testid="login-submit"
      >
        <LogIn className="size-5" aria-hidden />
        {isSubmitting ? t('loggingIn') : t('login')}
      </Button>
    </form>
  );
}
