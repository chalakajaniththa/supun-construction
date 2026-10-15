import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { DailyEntryView } from '@/components/daily/daily-entry-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('daily') };
}

export default function DailyPage() {
  return (
    <Suspense>
      <DailyEntryView />
    </Suspense>
  );
}
