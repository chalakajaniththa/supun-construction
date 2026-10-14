import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { WorkerEdit } from '@/components/workers/worker-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workers');
  return { title: t('editTitle') };
}

export default async function EditWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkerEdit id={id} />;
}
