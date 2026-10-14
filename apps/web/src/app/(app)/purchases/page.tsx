import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PurchasesView } from '@/components/materials/purchases-view';
import { PageHeader } from '@/components/page-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('purchases') };
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const t = await getTranslations('purchases');
  const { tab } = await searchParams;
  // Until purchases exist (Step 3), the materials catalog is the useful tab.
  const initialTab = tab === 'purchases' || tab === 'store' ? tab : 'materials';
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <PurchasesView initialTab={initialTab} />
    </>
  );
}
