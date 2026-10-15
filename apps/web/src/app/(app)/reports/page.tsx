import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { ReportsView } from '@/components/reports/reports-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('reports') };
}

export default async function ReportsPage() {
  const t = await getTranslations('reports');
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <ReportsView />
    </>
  );
}
