'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isActive } from './nav-items';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav aria-label={t('dashboard')} className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            onClick={onNavigate}
            data-testid={`nav-${key}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] leading-snug font-medium transition-colors',
              'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              active &&
                'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
