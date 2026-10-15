import { Construction } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { OpenAdvances } from '@/components/payroll/open-advances';
import { Card, CardContent } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('payroll') };
}

/** Salaries are calculated in Step 4; until then the page shows the open advances. */
export default async function PayrollPage() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t('nav.payroll')} description={t('payroll.subtitle')} />
      <div className="flex flex-col gap-5">
        <Card>
          <CardContent className="flex items-center gap-4 py-2">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-accent/20">
              <Construction className="size-6" aria-hidden />
            </span>
            <p className="text-muted-foreground">{t('payroll.comingSoon')}</p>
          </CardContent>
        </Card>
        <OpenAdvances />
      </div>
    </>
  );
}
