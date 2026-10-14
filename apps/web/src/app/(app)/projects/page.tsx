import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { ProjectsHeaderActions, ProjectsList } from '@/components/projects/projects-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('projects') };
}

export default async function ProjectsPage() {
  const t = await getTranslations('projects');
  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={<ProjectsHeaderActions />}
      />
      <ProjectsList />
    </>
  );
}
