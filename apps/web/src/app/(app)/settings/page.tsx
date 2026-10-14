import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { SETTINGS_TABS, type SettingsTab } from './settings-tabs';
import { SettingsView } from './settings-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const t = await getTranslations('settings');
  const { tab } = await searchParams;
  const initialTab: SettingsTab = (SETTINGS_TABS as readonly string[]).includes(String(tab))
    ? (tab as SettingsTab)
    : 'company';
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <SettingsView initialTab={initialTab} />
    </>
  );
}
