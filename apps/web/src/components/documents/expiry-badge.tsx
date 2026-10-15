'use client';

import { daysUntil, expiryStatus } from '@sc/shared';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/status-chip';
import { formatDate, todayInColombo } from '@/lib/format';

/** Red = expired, orange = within 30 days, green = fine. Nothing when there is no expiry date. */
export function ExpiryBadge({
  expiry,
  wrap = false,
}: {
  expiry: string | null | undefined;
  /** Allow the text to wrap (narrow table columns). */
  wrap?: boolean;
}) {
  const t = useTranslations('documents.expiry');
  if (!expiry) return <span className="text-muted-foreground">—</span>;
  const today = todayInColombo();
  const status = expiryStatus(expiry, today)!;
  const days = daysUntil(expiry.slice(0, 10), today);
  const date = formatDate(expiry);
  const cls = wrap ? 'whitespace-normal' : undefined;
  if (status === 'EXPIRED') {
    return (
      <StatusChip tone="danger" status="EXPIRED" className={cls}>
        {t('expired', { date })}
      </StatusChip>
    );
  }
  if (status === 'SOON') {
    return (
      <StatusChip tone="warning" status="SOON" className={cls}>
        {days === 0 ? t('today', { date }) : t('soon', { date, days })}
      </StatusChip>
    );
  }
  return (
    <StatusChip tone="success" status="OK" className={cls}>
      {t('ok', { date })}
    </StatusChip>
  );
}
