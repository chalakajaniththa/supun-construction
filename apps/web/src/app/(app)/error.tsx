'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <TriangleAlert className="size-10 text-destructive" aria-hidden />
        <h2 className="text-xl font-semibold">{t('pageErrorTitle')}</h2>
        <p className="max-w-md text-muted-foreground">{t('pageErrorText')}</p>
        <Button size="lg" onClick={reset}>
          {t('tryAgain')}
        </Button>
      </CardContent>
    </Card>
  );
}
