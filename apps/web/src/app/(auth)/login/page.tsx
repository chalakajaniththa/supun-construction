import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LanguageToggle } from '@/components/layout/language-toggle';
import { BrandMark } from '@/components/layout/brand';
import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('login') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const t = await getTranslations();
  const { next } = await searchParams;
  const nextPath =
    typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
      ? next
      : '/dashboard';
  return (
    <div className="flex min-h-dvh flex-col bg-sidebar">
      <div className="flex justify-end p-4">
        <LanguageToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-3 text-sidebar-foreground">
            <BrandMark className="flex size-12 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground [&_svg]:size-7" />
            <span className="text-2xl font-bold">{t('common.appName')}</span>
          </div>
          <div className="rounded-2xl bg-card p-8 shadow-xl">
            <h1 className="text-3xl font-bold">{t('auth.title')}</h1>
            <p className="mt-1 mb-6 text-lg text-muted-foreground">{t('auth.subtitle')}</p>
            <LoginForm nextPath={nextPath} />
          </div>
        </div>
      </main>
    </div>
  );
}
