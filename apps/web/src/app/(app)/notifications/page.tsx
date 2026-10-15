import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NotificationsView } from '@/components/notifications/notifications-view';
import { PageHeader } from '@/components/page-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notifications');
  return { title: t('title') };
}

export default async function NotificationsPage() {
  const t = await getTranslations('notifications');
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <NotificationsView />
    </>
  );
}
