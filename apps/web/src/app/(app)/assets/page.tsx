import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AssetsList } from '@/components/assets/assets-list';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('assets') };
}

export default async function AssetsPage() {
  const t = await getTranslations('assets');
  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild size="lg" className="h-11 text-base">
            <Link href="/assets/new" data-testid="new-asset">
              <Plus aria-hidden />
              {t('add')}
            </Link>
          </Button>
        }
      />
      <AssetsList />
    </>
  );
}
