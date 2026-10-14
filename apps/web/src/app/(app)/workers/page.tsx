import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { WorkersList } from '@/components/workers/workers-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('workers') };
}

export default async function WorkersPage() {
  const t = await getTranslations('workers');
  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild size="lg" className="h-11 text-base">
            <Link href="/workers/new" data-testid="new-worker">
              <Plus aria-hidden />
              {t('add')}
            </Link>
          </Button>
        }
      />
      <WorkersList />
    </>
  );
}
