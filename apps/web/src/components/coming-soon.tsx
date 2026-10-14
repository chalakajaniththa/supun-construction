import { Construction } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { NavKey } from './layout/nav-items';
import { PageHeader } from './page-header';

/** Friendly placeholder for pages that later steps will build. */
export async function ComingSoon({ page }: { page: NavKey }) {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t(`nav.${page}`)} />
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-brand-accent/20 text-foreground">
            <Construction className="size-8" aria-hidden />
          </span>
          <h2 className="text-xl font-semibold">{t('common.comingSoonTitle')}</h2>
          <p className="max-w-md text-muted-foreground">{t('common.comingSoonText')}</p>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">{t('common.goToDashboard')}</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
