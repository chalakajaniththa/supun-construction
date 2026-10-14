import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AssetEdit } from '@/components/assets/asset-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('assets');
  return { title: t('editTitle') };
}

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetEdit id={id} />;
}
