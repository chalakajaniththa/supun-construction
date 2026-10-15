'use client';

import { type AttendanceDto, monthRange, mondayOf, shiftDay, weekdayOf } from '@sc/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/use-resource';
import { formatMonth, formatQty, todayInColombo } from '@/lib/format';
import { cn } from '@/lib/utils';

interface AttendanceList {
  items: AttendanceDto[];
  summary: {
    present: number;
    halfDays: number;
    absent: number;
    leave: number;
    daysWorked: string;
    otHours: string;
  };
}

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-success/15 text-success ring-success/30',
  HALF_DAY: 'bg-warning/25 text-[oklch(0.45_0.1_60)] ring-warning/40',
  ABSENT: 'bg-destructive/10 text-destructive ring-destructive/30',
  LEAVE: 'bg-primary/10 text-primary ring-primary/25',
};

function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** A month calendar of one worker's attendance (read-only; Daily Entry records it). */
export function AttendanceCalendar({ workerId }: { workerId: string }) {
  const t = useTranslations('attendance');
  const today = todayInColombo();
  const [month, setMonth] = useState(today.slice(0, 7));
  const { from, to } = monthRange(month);
  const { data, isLoading } = useApi<AttendanceList>('attendance', '/attendance', {
    workerId,
    from,
    to,
  });
  const byDay = new Map((data?.items ?? []).map((a) => [a.date.slice(0, 10), a]));
  const start = mondayOf(from);
  const weeks: string[][] = [];
  for (let d = start; d <= to; d = shiftDay(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => shiftDay(d, i)));
  }
  const dayNames = Array.from({ length: 7 }, (_, i) => t(`weekdays.${i}`));
  const s = data?.summary;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={t('previousMonth')}
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="min-w-40 text-center font-semibold" data-testid="attendance-month">
            {formatMonth(month)}
          </span>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={t('nextMonth')}
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {s ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="attendance-summary">
            {[
              ['daysWorked', formatQty(s.daysWorked)],
              ['present', s.present],
              ['halfDays', s.halfDays],
              ['absent', s.absent + s.leave],
              ['otHours', formatQty(s.otHours)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border px-3 py-2">
                <dt className="text-sm text-muted-foreground">{t(`summary.${k}`)}</dt>
                <dd className="text-xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[640px] table-fixed border-collapse"
              data-testid="attendance-calendar"
            >
              <thead>
                <tr>
                  {dayNames.map((n) => (
                    <th
                      key={n}
                      className="pb-2 text-left text-sm font-medium text-muted-foreground"
                    >
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week[0]}>
                    {week.map((d) => {
                      const a = byDay.get(d);
                      const inMonth = d >= from && d <= to;
                      return (
                        <td key={d} className="p-0.5 align-top">
                          <div
                            className={cn(
                              'flex h-20 flex-col gap-1 rounded-md border p-1.5',
                              !inMonth && 'opacity-30',
                              d === today && 'border-primary',
                              weekdayOf(d) === 0 && 'bg-muted/40',
                            )}
                          >
                            <span className="text-sm tabular-nums">{Number(d.slice(8))}</span>
                            {a && inMonth ? (
                              <>
                                <span
                                  className={cn(
                                    'w-fit rounded-full px-1.5 text-xs font-medium ring-1 ring-inset',
                                    STATUS_STYLE[a.status],
                                  )}
                                >
                                  {t(`short.${a.status}`)}
                                  {Number(a.otHours) > 0 ? ` +${formatQty(a.otHours)}h` : ''}
                                </span>
                                {a.project ? (
                                  <span
                                    className="truncate text-xs text-muted-foreground"
                                    title={a.project.name}
                                  >
                                    {a.project.code}
                                  </span>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t('help')}</p>
      </CardContent>
    </Card>
  );
}
