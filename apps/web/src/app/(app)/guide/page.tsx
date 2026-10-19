import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GuideView } from '@/components/guide/guide-view';
import { PageHeader } from '@/components/page-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('guide') };
}

export default async function GuidePage() {
  const t = await getTranslations('guide');
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <GuideView />
    </>
  );
}
