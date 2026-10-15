'use client';

import { HEALTH_FLAG_THRESHOLD, type HealthFlag } from '@sc/shared';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/status-chip';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'muted';

const BAR: Record<Tone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/40',
};

/** A thin horizontal bar (0–100%; values above 100 fill the bar). */
export function ProgressBar({
  value,
  tone = 'primary',
  className,
  label,
}: {
  value: string | number | null | undefined;
  tone?: Tone;
  className?: string;
  label?: string;
}) {
  const n = Math.max(0, Math.min(100, Number(value ?? 0) || 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(n)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className={cn('h-full rounded-full', BAR[tone])} style={{ width: `${n}%` }} />
    </div>
  );
}

/**
 * The three health bars of a project (overview §7): time elapsed, budget used, physical progress.
 * Budget turns orange when it runs more than 15 points ahead of the work, red above 100%.
 */
export function ProgressTriple({
  timePct,
  budgetPct,
  physicalPct,
  compact = false,
}: {
  timePct: string;
  budgetPct: string | null;
  physicalPct: string;
  compact?: boolean;
}) {
  const t = useTranslations('health');
  const budget = budgetPct === null ? null : Number(budgetPct);
  const physical = Number(physicalPct);
  const budgetTone: Tone =
    budget === null
      ? 'muted'
      : budget > 100
        ? 'danger'
        : budget - physical > HEALTH_FLAG_THRESHOLD
          ? 'warning'
          : 'primary';
  const timeTone: Tone = Number(timePct) - physical > HEALTH_FLAG_THRESHOLD ? 'warning' : 'muted';
  const rows: { key: string; label: string; value: string | null; tone: Tone }[] = [
    { key: 'time', label: t('time'), value: timePct, tone: timeTone },
    { key: 'budget', label: t('budget'), value: budgetPct, tone: budgetTone },
    { key: 'physical', label: t('physical'), value: physicalPct, tone: 'success' },
  ];
  return (
    <div className={cn('grid', compact ? 'gap-1' : 'gap-3')} data-testid="progress-triple">
      {rows.map((r) => (
        <div
          key={r.key}
          className={cn(
            'grid items-center gap-x-3',
            compact ? 'grid-cols-[auto_1fr_3rem]' : 'grid-cols-[minmax(7rem,10rem)_1fr_4rem]',
          )}
          data-testid={`bar-${r.key}`}
        >
          <span className={cn('text-muted-foreground', compact && 'text-sm whitespace-nowrap')}>
            {r.label}
          </span>
          <ProgressBar
            value={r.value}
            tone={r.tone}
            label={r.label}
            className={compact ? 'h-1.5' : 'h-2.5'}
          />
          <span className={cn('text-right font-medium tabular-nums', compact && 'text-sm')}>
            {r.value === null ? '—' : formatPercent(r.value, 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

const FLAG_TONE: Record<HealthFlag, 'danger' | 'warning'> = {
  OVER_BUDGET: 'danger',
  COST_AHEAD_OF_PROGRESS: 'warning',
  BEHIND_SCHEDULE: 'warning',
};

/** Warning chips for a project's health flags ("On track" when there are none). */
export function HealthFlags({ flags }: { flags: HealthFlag[] }) {
  const t = useTranslations('health');
  if (!flags.length) {
    return (
      <StatusChip tone="success" className="whitespace-normal">
        {t('onTrack')}
      </StatusChip>
    );
  }
  return (
    <div className="flex flex-wrap gap-2" data-testid="health-flags">
      {flags.map((f) => (
        <StatusChip key={f} tone={FLAG_TONE[f]} status={f} className="whitespace-normal">
          {t(`flags.${f}`)}
        </StatusChip>
      ))}
    </div>
  );
}
