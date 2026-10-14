import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SupplierDetail } from '@/components/suppliers/suppliers-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('suppliers') };
}

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierDetail id={id} />;
}
