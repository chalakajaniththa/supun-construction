'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/** A settings card with a title, a form body and a Save button. */
export function SettingsSection({
  title,
  description,
  onSubmit,
  pending,
  submitLabel,
  testId,
  children,
}: {
  title: string;
  description?: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  pending?: boolean;
  submitLabel?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('common');
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate data-testid={testId}>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-[0.95rem]">{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-5 py-2 md:grid-cols-2">{children}</CardContent>
        <CardFooter className="mt-4 justify-end border-t pt-4">
          <Button type="submit" size="lg" className="h-11 min-w-32 text-base" disabled={pending}>
            {pending ? t('saving') : (submitLabel ?? t('save'))}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
