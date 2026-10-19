'use client';

import { CircleHelp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { sectionForPath } from '@/components/guide/guide-content';
import { Button } from '@/components/ui/button';

/** "?" in the top bar: opens the user guide at the help for the page you are on. */
export function HelpButton() {
  const t = useTranslations('guide');
  const pathname = usePathname();
  const section = pathname.startsWith('/guide') ? undefined : sectionForPath(pathname);
  return (
    <Button asChild variant="ghost" size="icon-lg" title={t('help')}>
      <Link
        href={section ? `/guide?section=${section}` : '/guide'}
        aria-label={t('help')}
        data-testid="help-button"
      >
        <CircleHelp className="size-5" aria-hidden />
      </Link>
    </Button>
  );
}
