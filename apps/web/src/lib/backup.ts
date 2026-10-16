import type { BackupState } from '@sc/shared';

/** "18.4 MB" (1024-based, like Finder's "MB" closely enough for an owner). */
export function formatBytes(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  let n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return i === 0 ? `${n} B` : `${n.toFixed(1)} ${units[i]}`;
}

/** "HH:mm" of a daily cron schedule ("0 23 * * *" → "23:00"); null for anything else. */
export function dailyTime(cron: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*\s*$/.exec(cron ?? '');
  if (!m) return null;
  const minute = Number(m[1]);
  const hour = Number(m[2]);
  if (minute > 59 || hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Whole minutes between two instants (0 = less than a minute; null = not finished). */
export function durationMinutes(start: string, end: string | null): number | null {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60_000);
}

export const BACKUP_DOT: Record<BackupState, string> = {
  OK: 'bg-success',
  WARNING: 'bg-warning',
  DANGER: 'bg-destructive',
};
