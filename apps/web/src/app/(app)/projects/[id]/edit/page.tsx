import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProjectEdit } from '@/components/projects/project-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projects');
  return { title: t('editTitle') };
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectEdit id={id} />;
}
