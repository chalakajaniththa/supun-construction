import { ClipboardPen } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const tNav = await getTranslations('nav');
  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button asChild size="lg" className="h-11 px-4 text-base">
            <Link href="/daily">
              <ClipboardPen aria-hidden />
              {tNav('daily')}
            </Link>
          </Button>
        }
      />
      <DashboardView />
    </>
  );
}
