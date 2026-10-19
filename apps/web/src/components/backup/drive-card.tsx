'use client';

import type { GdriveLinkDto } from '@sc/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud,
  CloudOff,
  ExternalLink,
  Loader2,
  Monitor,
  TriangleAlert,
  Unplug,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useErrorMessage } from '@/hooks/use-error-message';
import { api } from '@/lib/api-client';

const KEY = ['backup', 'gdrive'] as const;
const BUSY = ['STARTING', 'WAITING', 'TESTING'] as const;

/** The Google sign-in answers on 127.0.0.1, so it only works in a browser on this computer. */
function onThisComputer(): boolean {
  if (typeof window === 'undefined') return true;
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
}

/**
 * Settings → Backup → Google Drive: connect, disconnect, and the sign-in in between.
 * The sign-in itself runs in the backup container (see docker/backup/gdrive-link.sh).
 */
export function DriveCard() {
  const t = useTranslations('backup.drive');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => api<GdriveLinkDto>('/backup/gdrive', { signal }),
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && (d.pendingAction || (BUSY as readonly string[]).includes(d.state))
        ? 2_000
        : 30_000;
    },
  });

  // Tell the owner when the sign-in finished (the page updates by itself).
  const last = useRef(data?.state);
  useEffect(() => {
    const prev = last.current;
    last.current = data?.state;
    if (!prev || prev === data?.state) return;
    if (data?.state === 'DONE') {
      toast.success(t('doneToast'));
      void qc.invalidateQueries({ queryKey: ['backup', 'status'] });
    }
  }, [data?.state, qc, t]);

  const send = async (action: 'connect' | 'cancel' | 'disconnect') => {
    setSending(true);
    try {
      const next = await api<GdriveLinkDto>(`/backup/gdrive/${action}`, { method: 'POST' });
      qc.setQueryData(KEY, next);
      if (action === 'disconnect') {
        toast.success(t('disconnectedToast'));
        void qc.invalidateQueries({ queryKey: ['backup', 'status'] });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const connected = data?.configured === true;
  const state = data?.pendingAction === 'CONNECT' ? 'STARTING' : (data?.state ?? 'IDLE');
  const busy = (BUSY as readonly string[]).includes(state);
  const offline = data !== undefined && !data.agentOnline;
  const local = onThisComputer();
  const steps = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;

  return (
    <Card data-testid="backup-drive-card" data-state={state}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          {connected ? (
            <Cloud className="size-5 text-success" aria-hidden />
          ) : (
            <CloudOff className="size-5 text-muted-foreground" aria-hidden />
          )}
          {t('title')}
        </CardTitle>
        <CardDescription className="text-[0.95rem]">
          {connected ? t('connected') : t('notConnected')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state === 'WAITING' && data?.authUrl ? (
          <div
            className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
            data-testid="gdrive-waiting"
          >
            <p className="text-lg font-semibold">{t('waitingTitle')}</p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[0.95rem]">
              <li>{t('wait1')}</li>
              <li>{t('wait2')}</li>
              <li>{t('wait3')}</li>
              <li>{t('wait4')}</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg" className="h-11 text-base">
                <a
                  href={data.authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="gdrive-open-signin"
                >
                  <ExternalLink aria-hidden />
                  {t('openSignIn')}
                </a>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11 text-base"
                onClick={() => void send('cancel')}
                disabled={sending}
              >
                {tc('cancel')}
              </Button>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('waitingHint')}
            </p>
          </div>
        ) : busy ? (
          <div className="flex flex-wrap items-center gap-3" data-testid="gdrive-busy">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            <p className="text-[0.95rem]">{state === 'TESTING' ? t('testing') : t('starting')}</p>
            <Button variant="outline" onClick={() => void send('cancel')} disabled={sending}>
              {tc('cancel')}
            </Button>
          </div>
        ) : (
          <>
            {state === 'FAILED' ? (
              <div
                className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3 text-destructive"
                data-testid="gdrive-failed"
              >
                <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold">{t('failedTitle')}</p>
                  <p className="text-sm break-words text-foreground/80">{data?.message}</p>
                </div>
              </div>
            ) : null}
            {!local && !connected ? (
              <p className="flex items-start gap-2 text-[0.95rem] text-[oklch(0.45_0.1_60)]">
                <Monitor className="mt-0.5 size-5 shrink-0" aria-hidden />
                {t('thisComputer')}
              </p>
            ) : null}
            {offline ? <p className="text-[0.95rem] text-destructive">{t('offline')}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              {connected ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 text-base"
                  onClick={() => setConfirmOff(true)}
                  disabled={sending || offline}
                  data-testid="gdrive-disconnect"
                >
                  <Unplug aria-hidden />
                  {t('disconnect')}
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="h-11 text-base"
                  onClick={() => void send('connect')}
                  disabled={sending || offline || data === undefined}
                  data-testid="gdrive-connect"
                >
                  {sending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Cloud aria-hidden />
                  )}
                  {state === 'FAILED' ? t('tryAgain') : t('connect')}
                </Button>
              )}
              {!connected ? (
                <p className="text-sm text-muted-foreground">{t('connectHint')}</p>
              ) : null}
            </div>
          </>
        )}

        <p className="text-sm text-muted-foreground">{t('privacy')}</p>

        <details className="rounded-lg border px-4 py-3">
          <summary className="cursor-pointer font-semibold">{t('howTo')}</summary>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[0.95rem]">
            {steps.map((s) => (
              <li key={s}>{t(s)}</li>
            ))}
          </ol>
        </details>
      </CardContent>

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title={t('disconnectTitle')}
        description={t('disconnectText')}
        confirmLabel={t('disconnect')}
        pending={sending}
        onConfirm={async () => {
          await send('disconnect');
          setConfirmOff(false);
        }}
      />
    </Card>
  );
}
