'use client';

import { daysUntil, expiryStatus } from '@sc/shared';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/status-chip';
import { formatDate, todayInColombo } from '@/lib/format';

/** Red = expired, orange = within 30 days, green = fine. Nothing when there is no expiry date. */
export function ExpiryBadge({ expiry }: { expiry: string | null | undefined }) {
  const t = useTranslations('documents.expiry');
  if (!expiry) return <span className="text-muted-foreground">—</span>;
  const today = todayInColombo();
  const status = expiryStatus(expiry, today)!;
  const days = daysUntil(expiry.slice(0, 10), today);
  const date = formatDate(expiry);
  if (status === 'EXPIRED') {
    return (
      <StatusChip tone="danger" status="EXPIRED">
        {t('expired', { date })}
      </StatusChip>
    );
  }
  if (status === 'SOON') {
    return (
      <StatusChip tone="warning" status="SOON">
        {days === 0 ? t('today', { date }) : t('soon', { date, days })}
      </StatusChip>
    );
  }
  return (
    <StatusChip tone="success" status="OK">
      {t('ok', { date })}
    </StatusChip>
  );
}
