import { cn } from '@/lib/utils';

export type ChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<ChipTone, string> = {
  neutral: 'bg-muted text-foreground/80 ring-border',
  info: 'bg-primary/10 text-primary ring-primary/25',
  success: 'bg-success/12 text-success ring-success/30',
  warning: 'bg-warning/20 text-[oklch(0.45_0.1_60)] ring-warning/40',
  danger: 'bg-destructive/10 text-destructive ring-destructive/30',
};

/** Default colour for well-known status values; anything else is neutral. */
const STATUS_TONES: Record<string, ChipTone> = {
  ONGOING: 'info',
  PLANNING: 'neutral',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  ACTIVE: 'success',
  RELEASED: 'neutral',
  EXPIRED: 'danger',
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  CERTIFIED: 'success',
  PAID: 'success',
  FINALIZED: 'success',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  AVAILABLE: 'success',
  IN_USE: 'info',
  UNDER_REPAIR: 'warning',
  DISPOSED: 'neutral',
  SUCCESS: 'success',
  FAILED: 'danger',
  RUNNING: 'info',
  OPEN: 'warning',
  RECOVERED: 'success',
};

export function toneForStatus(status: string): ChipTone {
  return STATUS_TONES[status] ?? 'neutral';
}

/** A small rounded status label. Pass the translated label as children. */
export function StatusChip({
  status,
  tone,
  children,
  className,
}: {
  status?: string;
  tone?: ChipTone;
  children: React.ReactNode;
  className?: string;
}) {
  const t = tone ?? (status ? toneForStatus(status) : 'neutral');
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[t],
        className,
      )}
    >
      {children}
    </span>
  );
}
