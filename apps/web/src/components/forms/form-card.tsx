'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** A titled section of a long form (e.g. "Basic details", "Contract", "Dates"). */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-[0.95rem]">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{children}</CardContent>
    </Card>
  );
}

/** Save / Cancel row at the bottom of a form page. */
export function FormActions({
  pending,
  onCancel,
  submitLabel,
}: {
  pending?: boolean;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const t = useTranslations('common');
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 min-w-28 text-base"
        onClick={onCancel}
      >
        {t('cancel')}
      </Button>
      <Button
        type="submit"
        size="lg"
        className="h-11 min-w-32 text-base"
        disabled={pending}
        data-testid="form-submit"
      >
        {pending ? t('saving') : (submitLabel ?? t('save'))}
      </Button>
    </div>
  );
}
