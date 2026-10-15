import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { PayrollView } from '@/components/payroll/payroll-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('payroll') };
}

export default async function PayrollPage() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t('nav.payroll')} description={t('payroll.subtitle')} />
      <PayrollView />
    </>
  );
}
