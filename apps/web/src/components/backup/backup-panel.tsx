'use client';

import type { BackupRunDto, BackupStatusDto, Paginated } from '@sc/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DatabaseBackup,
  KeyRound,
  Loader2,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useEnumLabel } from '@/components/forms/enum-select';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBackupStatus } from '@/hooks/use-backup-status';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { dailyTime, durationMinutes, formatBytes } from '@/lib/backup';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DriveCard } from './drive-card';

const PAGE_SIZE = 10;

const STATE_STYLE: Record<BackupStatusDto['state'], { box: string; icon: typeof CheckCircle2 }> = {
  OK: { box: 'border-success/40 bg-success/8 text-success', icon: CheckCircle2 },
  WARNING: {
    box: 'border-warning/50 bg-warning/12 text-[oklch(0.45_0.1_60)]',
    icon: TriangleAlert,
  },
  DANGER: { box: 'border-destructive/40 bg-destructive/8 text-destructive', icon: XCircle },
};

function Fact({
  label,
  value,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function StatusCard() {
  const t = useTranslations('backup');
  const enumLabel = useEnumLabel();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useBackupStatus({ fast: busy });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  /** Polls until a run that started after `since` has finished (max 30 minutes). */
  const waitForRun = async (since: string, signal: AbortSignal) => {
    for (let i = 0; i < 600 && !signal.aborted; i++) {
      await new Promise((r) => setTimeout(r, 3_000));
      const s = await api<BackupStatusDto>('/backup/status', { signal });
      qc.setQueryData(['backup', 'status'], s);
      if (!s.pending && !s.running && s.lastRun && s.lastRun.startedAt >= since) return s.lastRun;
    }
    return null;
  };

  const backupNow = async () => {
    const since = new Date(Date.now() - 2_000).toISOString();
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    try {
      await api('/backup/run', { method: 'POST' });
      if (data && !data.agentOnline) toast.warning(t('offlineToast'));
      else toast.info(t('startedToast'));
      const run = await waitForRun(since, ctrl.signal);
      if (run?.status === 'SUCCESS') toast.success(t('doneToast'));
      else if (run) toast.error(t('failedToast'));
    } catch (e) {
      if (!ctrl.signal.aborted) toast.error(errorMessage(e));
    } finally {
      if (!ctrl.signal.aborted) {
        setBusy(false);
        void invalidate('backup', 'dashboard');
      }
    }
  };

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 py-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const style = STATE_STYLE[data.state];
  const Icon = style.icon;
  const working = busy || data.running || data.pending;
  const at = dailyTime(data.schedule);
  const success = data.lastSuccess;

  return (
    <Card data-testid="backup-status-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <DatabaseBackup className="size-5 text-primary" aria-hidden />
          {t('title')}
        </CardTitle>
        <CardDescription className="text-[0.95rem]">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div
          className={cn('flex items-start gap-3 rounded-lg border px-4 py-3', style.box)}
          data-testid="backup-state"
          data-state={data.state}
          data-reason={data.reason}
        >
          <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-lg font-semibold">{t(`reasons.${data.reason}`)}</p>
            <p className="text-[0.95rem] text-foreground/80">{t(`advice.${data.reason}`)}</p>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            label={t('lastSuccess')}
            testId="backup-last-success"
            value={
              success ? (
                <>
                  {formatDateTime(success.finishedAt ?? success.startedAt)}
                  {data.hoursSinceSuccess !== null ? (
                    <span className="block text-sm font-normal text-muted-foreground">
                      {t('hoursAgo', { hours: data.hoursSinceSuccess })}
                    </span>
                  ) : null}
                </>
              ) : (
                t('never')
              )
            }
          />
          <Fact label={t('size')} value={success ? formatBytes(success.sizeBytes) : '—'} />
          <Fact
            label={t('savedTo')}
            value={success ? enumLabel('BackupDestination', success.destination) : '—'}
          />
          <Fact
            label={t('automatic')}
            value={
              <>
                {at ? t('everyDayAt', { time: at }) : (data.schedule ?? '—')}
                <span
                  className={cn(
                    'block text-sm font-normal',
                    data.agentOnline ? 'text-success' : 'text-destructive',
                  )}
                  data-testid="backup-agent"
                >
                  {data.agentOnline ? t('agentOnline') : t('agentOffline')}
                </span>
              </>
            }
          />
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="h-11 text-base"
            onClick={() => void backupNow()}
            disabled={working}
            data-testid="backup-now"
          >
            {working ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <DatabaseBackup aria-hidden />
            )}
            {working ? (data.running ? t('running') : t('waiting')) : t('backupNow')}
          </Button>
          <p className="text-sm text-muted-foreground">{t('backupNowHint')}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const t = useTranslations('backup.password');
  return (
    <Card className="border-warning/50" data-testid="backup-password-card">
      <CardContent className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-6 shrink-0 text-[oklch(0.5_0.12_60)]" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{t('title')}</p>
          <p className="text-[0.95rem] text-foreground/80">{t('text')}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryCard() {
  const t = useTranslations('backup.history');
  const enumLabel = useEnumLabel();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['backup', 'runs', page],
    queryFn: ({ signal }) =>
      api<Paginated<BackupRunDto>>('/backup/runs', {
        query: { page, pageSize: PAGE_SIZE },
        signal,
      }),
    refetchInterval: 15_000,
  });
  const items = data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Card data-testid="backup-history">
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">{t('empty')}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('when')}</TableHead>
                  <TableHead>{t('result')}</TableHead>
                  <TableHead>{t('type')}</TableHead>
                  <TableHead>{t('savedTo')}</TableHead>
                  <TableHead className="text-right">{t('size')}</TableHead>
                  <TableHead className="text-right">{t('took')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => {
                  const minutes = durationMinutes(r.startedAt, r.finishedAt);
                  return (
                    <TableRow key={r.id} data-testid="backup-run">
                      <TableCell className="align-top">
                        {formatDateTime(r.startedAt)}
                        {r.message ? (
                          <span className="block max-w-xl text-sm whitespace-normal text-muted-foreground">
                            {r.message}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusChip status={r.status}>
                          {enumLabel('BackupStatus', r.status)}
                        </StatusChip>
                      </TableCell>
                      <TableCell className="align-top">
                        {enumLabel('BackupTrigger', r.trigger)}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        {r.status === 'SUCCESS'
                          ? enumLabel('BackupDestination', r.destination)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums">
                        {formatBytes(r.sizeBytes)}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums">
                        {minutes === null
                          ? '—'
                          : minutes === 0
                            ? t('underMinute')
                            : t('minutes', { count: minutes })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {pages > 1 ? (
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                  aria-label={t('newer')}
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <span className="text-sm text-muted-foreground">{t('page', { page, pages })}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= pages}
                  aria-label={t('older')}
                >
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Settings → Backup. */
export function BackupPanel() {
  return (
    <div className="flex flex-col gap-4">
      <StatusCard />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <DriveCard />
        <PasswordCard />
      </div>
      <HistoryCard />
    </div>
  );
}
