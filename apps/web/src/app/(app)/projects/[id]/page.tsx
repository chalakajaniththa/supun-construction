import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProjectDetail } from '@/components/projects/project-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('projects') };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail id={id} />;
}
