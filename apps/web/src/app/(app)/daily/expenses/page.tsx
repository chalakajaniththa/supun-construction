import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ExpensesList } from '@/components/daily/expenses-list';
import { PageHeader } from '@/components/page-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('expenses') };
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string | string[] }>;
}) {
  const t = await getTranslations('expenses');
  const { add } = await searchParams;
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <ExpensesList initialAdd={add === '1'} />
    </>
  );
}
