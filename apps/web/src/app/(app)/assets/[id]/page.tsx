import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AssetDetail } from '@/components/assets/asset-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('assets') };
}

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetDetail id={id} />;
}
