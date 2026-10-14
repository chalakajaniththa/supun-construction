import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ClientsManager } from '@/components/clients/clients-manager';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clients');
  return { title: t('title') };
}

export default async function ClientsPage() {
  const t = await getTranslations('clients');
  const tp = await getTranslations('projects');
  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild variant="outline" size="lg" className="h-11 text-base">
            <Link href="/projects">
              <ArrowLeft aria-hidden />
              {tp('backToList')}
            </Link>
          </Button>
        }
      />
      <ClientsManager />
    </>
  );
}
