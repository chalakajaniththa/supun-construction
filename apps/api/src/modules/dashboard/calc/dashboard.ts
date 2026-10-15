import type {
  DashboardSeriesPoint,
  HealthFlag,
  NotificationDto,
  NotificationSeverity,
  NotificationTitleKey,
  ProjectHealthDto,
} from '@sc/shared';
import { type DecimalInput, sum } from '../../../common/money/money.js';

/** "YYYY-MM" of the n months up to and including `month`, oldest first. */
export function lastMonths(month: string, n: number): string[] {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** First and last day of a month; the current month ends today. */
export function monthBounds(
  month: string,
  today: string,
): { month: string; from: string; to: string } {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { month, from: `${month}-01`, to: last < today ? last : today };
}

/**
 * Workers on site today: those with PRESENT / HALF_DAY attendance today; before anything is
 * recorded, those planned (allocated) for today.
 */
export function workersOnSite(
  attendanceWorkerIds: readonly string[],
  plannedWorkerIds: readonly string[],
): { count: number; source: 'ATTENDANCE' | 'PLAN' } {
  const recorded = new Set(attendanceWorkerIds);
  if (recorded.size) return { count: recorded.size, source: 'ATTENDANCE' };
  return { count: new Set(plannedWorkerIds).size, source: 'PLAN' };
}

/** Spend vs received per month (spent = project costs + expenses without a project). */
export function buildSeries(
  months: readonly string[],
  spent: ReadonlyMap<string, readonly DecimalInput[]>,
  payments: readonly { date: string; amount: DecimalInput }[],
): DashboardSeriesPoint[] {
  return months.map((month) => ({
    month,
    spent: sum(spent.get(month) ?? []).toFixed(2),
    received: sum(payments.filter((p) => p.date.startsWith(month)).map((p) => p.amount)).toFixed(2),
  }));
}

export const sumMoney = (values: readonly DecimalInput[]) => sum(values).toFixed(2);

const FLAG_ITEM: Record<
  HealthFlag,
  { severity: NotificationSeverity; titleKey: NotificationTitleKey }
> = {
  OVER_BUDGET: { severity: 'DANGER', titleKey: 'overBudget' },
  COST_AHEAD_OF_PROGRESS: { severity: 'WARNING', titleKey: 'costAheadOfProgress' },
  BEHIND_SCHEDULE: { severity: 'WARNING', titleKey: 'behindSchedule' },
};

/** Project health flags as attention items (not stored as notifications). */
export function healthAttention(
  projects: readonly ProjectHealthDto[],
  now: string,
): NotificationDto[] {
  const out: NotificationDto[] = [];
  for (const p of projects) {
    for (const flag of p.flags) {
      const f = FLAG_ITEM[flag];
      out.push({
        id: `health:${p.projectId}:${flag}`,
        type: 'HEALTH',
        severity: f.severity,
        titleKey: f.titleKey,
        params: { projectCode: p.code, projectName: p.name, flag },
        entityType: 'PROJECT',
        entityId: p.projectId,
        dueDate: null,
        readAt: null,
        resolvedAt: null,
        createdAt: now,
      });
    }
  }
  return out;
}

const RANK: Record<NotificationSeverity, number> = { DANGER: 0, WARNING: 1, INFO: 2 };

/** Most urgent first (DANGER → WARNING → INFO, then the soonest due date); at most `limit`. */
export function mergeAttention(
  notifications: readonly NotificationDto[],
  health: readonly NotificationDto[],
  limit: number,
): { items: NotificationDto[]; total: number } {
  const all = [...notifications, ...health].sort(
    (a, b) =>
      RANK[a.severity] - RANK[b.severity] ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
  );
  return { items: all.slice(0, limit), total: all.length };
}
