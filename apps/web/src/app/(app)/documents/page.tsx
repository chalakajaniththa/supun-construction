import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { type DocumentsTab, DocumentsView } from '@/components/documents/documents-view';
import { PageHeader } from '@/components/page-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('documents') };
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; upload?: string; expiring?: string }>;
}) {
  const t = await getTranslations('documents');
  const { tab, upload, expiring } = await searchParams;
  const initialTab: DocumentsTab = tab === 'all' || expiring ? 'all' : 'company';
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <DocumentsView
        initialTab={initialTab}
        openUpload={upload === '1'}
        initialExpiring={expiring && /^\d+$/.test(expiring) ? expiring : undefined}
      />
    </>
  );
}
