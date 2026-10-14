'use client';

import { HardHat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSettings } from '@/hooks/use-settings';

/** Company name from settings (falls back to the app name while loading). */
export function useCompanyName(): string {
  const t = useTranslations('common');
  const { data } = useSettings();
  return data?.company.name || t('appName');
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={
        className ??
        'flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'
      }
    >
      <HardHat className="size-5" aria-hidden />
    </span>
  );
}
