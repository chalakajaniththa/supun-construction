import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { WorkerForm } from '@/components/workers/worker-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workers');
  return { title: t('addTitle') };
}

export default async function NewWorkerPage() {
  const t = await getTranslations('workers');
  return (
    <>
      <PageHeader title={t('addTitle')} description={t('addSubtitle')} />
      <WorkerForm />
    </>
  );
}
