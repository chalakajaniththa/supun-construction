'use client';

import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMe } from '@/hooks/use-me';

/** Shown on every page while the admin still uses the password from the install. */
export function DefaultPasswordBanner() {
  const t = useTranslations('auth');
  const { data: me } = useMe();
  if (!me?.usingDefaultPassword) return null;
  return (
    <div
      role="status"
      data-testid="default-password-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/40 bg-warning/15 px-4 py-2.5 text-[0.95rem] lg:px-8"
    >
      <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden />
      <span className="flex-1">{t('defaultPasswordBanner')}</span>
      <Link
        href="/settings?tab=password"
        className="font-semibold text-primary underline underline-offset-4"
      >
        {t('changeNow')}
      </Link>
    </div>
  );
}
