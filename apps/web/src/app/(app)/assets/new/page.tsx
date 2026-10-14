import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AssetForm } from '@/components/assets/asset-form';
import { PageHeader } from '@/components/page-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('assets');
  return { title: t('addTitle') };
}

export default async function NewAssetPage() {
  const t = await getTranslations('assets');
  return (
    <>
      <PageHeader title={t('addTitle')} description={t('addSubtitle')} />
      <AssetForm />
    </>
  );
}
