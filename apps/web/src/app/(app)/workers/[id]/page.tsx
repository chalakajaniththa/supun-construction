import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { WorkerDetail } from '@/components/workers/worker-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('workers') };
}

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkerDetail id={id} />;
}
