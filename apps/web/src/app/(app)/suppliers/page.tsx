import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SuppliersView } from '@/components/suppliers/suppliers-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('suppliers') };
}

export default function SuppliersPage() {
  return <SuppliersView />;
}
