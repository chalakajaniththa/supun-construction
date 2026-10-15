'use client';

import type { NotificationCountDto, NotificationDto, Paginated } from '@sc/shared';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotificationText } from '@/hooks/use-notification-text';
import { useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { SEVERITY_DOT, notificationHref } from '@/lib/notifications';
import { cn } from '@/lib/utils';

const POLL_MS = 60_000;
const LATEST = 8;

/** The bell in the top bar: unread count (polled every minute) and the latest reminders. */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const text = useNotificationText();
  const router = useRouter();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);

  const count = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: ({ signal }) => api<NotificationCountDto>('/notifications/count', { signal }),
    refetchInterval: POLL_MS,
  });
  const latest = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: ({ signal }) =>
      api<Paginated<NotificationDto>>('/notifications', { query: { pageSize: LATEST }, signal }),
    enabled: open,
  });
  const unread = count.data?.unread ?? 0;

  const openItem = async (n: NotificationDto) => {
    setOpen(false);
    if (!n.readAt) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
      void invalidate('notifications');
    }
    router.push(notificationHref(n));
  };

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    await invalidate('notifications');
  };

  const items = latest.data?.items ?? [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="relative"
          aria-label={`${t('bell')} — ${t('bellCount', { count: unread })}`}
          data-testid="bell"
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white"
              data-testid="bell-count"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[26rem] max-w-[calc(100vw-2rem)] p-0"
        data-testid="bell-panel"
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="font-semibold">{t('bell')}</p>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAll} data-testid="bell-mark-all">
              <CheckCheck aria-hidden />
              {t('markAllRead')}
            </Button>
          ) : null}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {latest.isLoading ? (
            <li className="px-4 py-6 text-center text-muted-foreground">…</li>
          ) : items.length === 0 ? (
            <li className="px-4 py-6 text-center text-muted-foreground">{t('empty')}</li>
          ) : (
            items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void openItem(n)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  data-testid="bell-item"
                >
                  <span
                    className={cn('mt-2 size-2.5 shrink-0 rounded-full', SEVERITY_DOT[n.severity])}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block leading-snug', !n.readAt && 'font-semibold')}>
                      {text(n)}
                    </span>
                    {n.dueDate ? (
                      <span className="text-sm text-muted-foreground">
                        {t('due', { date: formatDate(n.dueDate) })}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t p-2">
          <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}>
            <Link href="/notifications" data-testid="bell-see-all">
              {t('seeAll')}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
