'use client';

import { DatabaseBackup } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useBackupStatus } from '@/hooks/use-backup-status';
import { BACKUP_DOT } from '@/lib/backup';
import { cn } from '@/lib/utils';

/** Top-bar backup light: green / orange / red; opens Settings → Backup. */
export function BackupDot() {
  const t = useTranslations('backup');
  const { data } = useBackupStatus();
  const label = data
    ? `${t('dotLabel')}: ${t(`reasons.${data.reason}`)}`
    : `${t('dotLabel')}: ${t('loading')}`;
  return (
    <Link
      href="/settings?tab=backup"
      className="relative inline-flex size-10 items-center justify-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label={label}
      title={label}
      data-testid="backup-dot"
      data-state={data?.state ?? 'LOADING'}
    >
      <DatabaseBackup className="size-5 text-muted-foreground" aria-hidden />
      <span
        className={cn(
          'absolute right-1.5 bottom-1.5 size-3 rounded-full ring-2 ring-background',
          data ? BACKUP_DOT[data.state] : 'bg-muted-foreground/40',
          data?.running && 'animate-pulse',
        )}
        aria-hidden
      />
    </Link>
  );
}
