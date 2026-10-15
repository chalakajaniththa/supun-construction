'use client';

import type { AllocationConflict } from '@sc/shared';
import { CalendarX2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { colomboTime } from '@sc/shared';

/** The conflicts of a 409 ALLOCATION_OVERLAP, or null for any other error. */
export function overlapConflicts(err: unknown): AllocationConflict[] | null {
  if (!(err instanceof ApiError) || err.code !== 'ALLOCATION_OVERLAP') return null;
  const details = err.details as { conflicts?: AllocationConflict[] } | undefined;
  return details?.conflicts ?? [];
}

/** Friendly explanation of a double booking: who is already booked where and when. */
export function ConflictDialog({
  conflicts,
  onOpenChange,
}: {
  conflicts: AllocationConflict[] | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('schedule.conflict');
  const tc = useTranslations('common');
  const list = conflicts ?? [];
  const shown = list.slice(0, 12);
  return (
    <Dialog open={conflicts !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="conflict-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarX2 className="size-6 text-destructive" aria-hidden />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="text-base">{t('description')}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {shown.map((c) => (
            <li
              key={`${c.allocationId}-${c.requestedStartAt}`}
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
            >
              <p className="font-medium">{c.resourceName}</p>
              <p className="text-sm text-muted-foreground">
                {t('alreadyAt', {
                  project: c.projectName,
                  date: formatDate(c.startAt),
                  from: colomboTime(c.startAt),
                  to: colomboTime(c.endAt),
                })}
              </p>
            </li>
          ))}
        </ul>
        {list.length > shown.length ? (
          <p className="text-sm text-muted-foreground">
            {t('more', { n: list.length - shown.length })}
          </p>
        ) : null}
        <p className="text-sm">{t('hint')}</p>
        <DialogFooter>
          <Button size="lg" className="h-11 text-base" onClick={() => onOpenChange(false)}>
            {tc('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
