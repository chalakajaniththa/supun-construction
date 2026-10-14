'use client';

import { ArrowLeft, Construction, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorMessage } from '@/hooks/use-error-message';

/** Loading / error states for a detail page (still renders a PageHeader). */
export function DetailState({ error, backHref }: { error?: unknown; backHref: string }) {
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  if (error) {
    return (
      <>
        <PageHeader title={errorMessage(error)} actions={<BackButton href={backHref} />} />
      </>
    );
  }
  return (
    <>
      <PageHeader title={tc('loading')} />
      <Card>
        <CardContent className="flex flex-col gap-4 py-6">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </CardContent>
      </Card>
    </>
  );
}

export function BackButton({ href, label }: { href: string; label?: string }) {
  const tc = useTranslations('common');
  return (
    <Button asChild variant="outline" size="lg" className="h-11 text-base">
      <Link href={href}>
        <ArrowLeft aria-hidden />
        {label ?? tc('back')}
      </Link>
    </Button>
  );
}

export function EditButton({ href }: { href: string }) {
  const tc = useTranslations('common');
  return (
    <Button asChild size="lg" className="h-11 text-base">
      <Link href={href} data-testid="edit-button">
        <Pencil aria-hidden />
        {tc('edit')}
      </Link>
    </Button>
  );
}

/** Tab strip for detail pages (big, wrapping). */
export function DetailTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  children,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  label: (tab: T) => string;
  children: React.ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} className="gap-4">
      <TabsList className="h-auto flex-wrap justify-start">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab}
            className="flex-none px-3 py-1.5 text-[0.95rem]"
            data-testid={`tab-${tab}`}
          >
            {label(tab)}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

/** Placeholder for a tab that a later step builds. */
export function ComingSoonPanel() {
  const t = useTranslations('common');
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-accent/20">
          <Construction className="size-7" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">{t('comingSoonTitle')}</h2>
        <p className="max-w-md text-muted-foreground">{t('comingSoonTab')}</p>
      </CardContent>
    </Card>
  );
}
