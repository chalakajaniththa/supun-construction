import { Banknote, Building2, ClipboardPen, FileUp, HardHat, Receipt, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

/** Step 1: a calm placeholder layout. Real figures arrive in Step 5. */
export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const tNav = await getTranslations('nav');
  const kpis = [
    { key: 'activeProjects', icon: Building2 },
    { key: 'workersToday', icon: HardHat },
    { key: 'spentThisMonth', icon: Wallet },
    { key: 'toReceive', icon: Banknote },
  ] as const;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={`${t('greeting')} ${t('subtitle')}`}
        actions={
          <Button asChild size="lg" className="h-11 px-4 text-base">
            <Link href="/daily">
              <ClipboardPen aria-hidden />
              {tNav('daily')}
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('title')}>
        {kpis.map(({ key, icon: Icon }) => (
          <Card key={key} data-testid={`kpi-${key}`}>
            <CardContent className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[0.95rem] text-muted-foreground">{t(`kpi.${key}`)}</p>
                <p className="mt-1 text-2xl font-bold">—</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('notYet')}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t('activeProjects')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-6 text-center text-muted-foreground">{t('noActiveProjects')}</p>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('needsAttention')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('nothingNeedsAttention')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('quickActions')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild variant="outline" size="lg" className="h-11 justify-start text-base">
                <Link href="/daily">
                  <ClipboardPen aria-hidden />
                  {tNav('daily')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 justify-start text-base">
                <Link href="/daily/expenses?add=1">
                  <Receipt aria-hidden />
                  {t('addExpense')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 justify-start text-base">
                <Link href="/documents?upload=1">
                  <FileUp aria-hidden />
                  {t('uploadDocument')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
