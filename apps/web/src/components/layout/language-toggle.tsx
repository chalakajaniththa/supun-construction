'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import { LOCALES, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

const LABELS: Record<Locale, string> = { en: 'EN', si: 'සිං' };

/** EN | සිං switch. The choice is stored in the NEXT_LOCALE cookie by a server action. */
export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t('language')}
      data-testid="language-toggle"
      className={cn(
        'inline-flex rounded-lg border bg-background p-0.5',
        pending && 'opacity-60',
        className,
      )}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={l === locale}
          lang={l}
          title={l === 'en' ? t('english') : t('sinhala')}
          data-testid={`locale-${l}`}
          className={cn(
            'min-w-11 rounded-md px-2.5 py-1 text-sm font-semibold transition-colors',
            l === locale
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
