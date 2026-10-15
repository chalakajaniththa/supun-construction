'use client';

import { NOTIFICATION_TYPES, type NotificationDto, type Paginated } from '@sc/shared';
import { ChevronRight, CheckCheck, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Segmented } from '@/components/segmented';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useNotificationText } from '@/hooks/use-notification-text';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { SEVERITY_DOT, notificationHref } from '@/lib/notifications';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;
type Status = 'open' | 'all';
type TypeFilter = 'ALL' | (typeof NOTIFICATION_TYPES)[number];

/** All reminders, with filters; each row opens the thing it is about. */
export function NotificationsView() {
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const text = useNotificationText();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const [status, setStatus] = useState<Status>('open');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useApi<Paginated<NotificationDto>>(
    'notifications',
    '/notifications',
    {
      status,
      type: type === 'ALL' ? undefined : type,
      page,
      pageSize: PAGE_SIZE,
    },
  );
  const items = data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const markRead = async (n: NotificationDto) => {
    if (n.readAt) return;
    await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
    void invalidate('notifications');
  };

  const run = async (action: 'scan' | 'readAll') => {
    setBusy(true);
    try {
      if (action === 'scan') {
        const r = await api<{ open: number }>('/reminders/run', { method: 'POST' });
        toast.success(t('ranOk', { open: r.open }));
      } else {
        await api('/notifications/read-all', { method: 'POST' });
        toast.success(t('markedAllRead'));
      }
      await invalidate('notifications', 'dashboard');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Status>
          label={t('title')}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: 'open', label: t('status.open') },
            { value: 'all', label: t('status.all') },
          ]}
          testId="notif-status"
        />
        <Segmented<TypeFilter>
          label={t('allTypes')}
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: t('allTypes') },
            ...NOTIFICATION_TYPES.map((v) => ({ value: v, label: t(`types.${v}`) })),
          ]}
          testId="notif-type"
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-11 text-base"
            disabled={busy}
            onClick={() => void run('readAll')}
          >
            <CheckCheck aria-hidden />
            {t('markAllRead')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 text-base"
            disabled={busy}
            onClick={() => void run('scan')}
            data-testid="notif-run"
          >
            <RefreshCw aria-hidden className={cn(busy && 'animate-spin')} />
            {t('runNow')}
          </Button>
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          {isLoading ? (
            <p className="py-10 text-center text-muted-foreground">{tc('loading')}</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground" data-testid="notif-empty">
              {status === 'open' ? t('noneOpen') : t('noneAll')}
            </p>
          ) : (
            <ul className="divide-y" data-testid="notif-list">
              {items.map((n) => (
                <li key={n.id} className={cn(n.resolvedAt && 'opacity-60')}>
                  <Link
                    href={notificationHref(n)}
                    onClick={() => void markRead(n)}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                    data-testid="notif-item"
                  >
                    <span
                      className={cn('size-3 shrink-0 rounded-full', SEVERITY_DOT[n.severity])}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-[1.05rem] leading-snug',
                          !n.readAt && !n.resolvedAt && 'font-semibold',
                        )}
                      >
                        {text(n)}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{t(`types.${n.type}`)}</span>
                        {n.dueDate ? (
                          <span>{t('due', { date: formatDate(n.dueDate) })}</span>
                        ) : null}
                      </span>
                    </span>
                    {n.resolvedAt ? (
                      <StatusChip tone="success" className="shrink-0" status="RESOLVED">
                        <span title={t('resolvedHelp')}>{t('resolved')}</span>
                      </StatusChip>
                    ) : !n.readAt ? (
                      <StatusChip tone="info" className="shrink-0">
                        {t('new')}
                      </StatusChip>
                    ) : null}
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-3">
          <span className="text-muted-foreground">{tc('pagination.page', { page, pages })}</span>
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {tc('pagination.previous')}
          </Button>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {tc('pagination.next')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
