import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { ProjectForm } from '@/components/projects/project-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projects');
  return { title: t('addTitle') };
}

export default async function NewProjectPage() {
  const t = await getTranslations('projects');
  return (
    <>
      <PageHeader title={t('addTitle')} description={t('addSubtitle')} />
      <ProjectForm />
    </>
  );
}
