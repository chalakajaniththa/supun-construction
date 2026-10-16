import { Injectable } from '@nestjs/common';
import {
  type DashboardDto,
  type ProjectHealthDto,
  colomboDay,
  colomboDayRange,
  dayToDate,
  toDay,
} from '@sc/shared';
import { todayInColombo } from '../../common/dates/dates.js';
import { asDto } from '../../common/money/as-dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { backupAttention } from '../backup/calc/backup-health.js';
import { BackupService } from '../backup/backup.service.js';
import { BillingService } from '../billing/billing.service.js';
import { CostingService } from '../costing/costing.service.js';
import { NotificationsService } from '../reminders/notifications.service.js';
import {
  buildSeries,
  healthAttention,
  lastMonths,
  mergeAttention,
  monthBounds,
  sumMoney,
  workersOnSite,
} from './calc/dashboard.js';

const ATTENTION_LIMIT = 8;
const SERIES_MONTHS = 6;

/** Everything the dashboard shows, in one call. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costing: CostingService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService,
    private readonly backup: BackupService,
  ) {}

  async get(): Promise<DashboardDto> {
    const today = todayInColombo();
    const month = today.slice(0, 7);
    const months = lastMonths(month, SERIES_MONTHS).map((m) => monthBounds(m, today));
    const seriesFrom = months[0]!.from;
    const day = colomboDayRange(today);

    const [projects, attendance, planned, payments, looseExpenses, healthRaw, top, backup] =
      await Promise.all([
        this.prisma.project.findMany({ where: { deletedAt: null } }),
        this.prisma.attendance.findMany({
          where: { date: dayToDate(today), status: { in: ['PRESENT', 'HALF_DAY'] } },
          select: { workerId: true },
        }),
        this.prisma.workerAllocation.findMany({
          where: { status: 'PLANNED', startAt: { lt: day.end }, endAt: { gt: day.start } },
          select: { workerId: true },
        }),
        this.prisma.clientPayment.findMany({
          where: { date: { gte: dayToDate(seriesFrom), lte: dayToDate(today) } },
          select: { date: true, amount: true },
        }),
        this.prisma.expense.findMany({
          where: { projectId: null, date: { gte: dayToDate(seriesFrom), lte: dayToDate(today) } },
          select: { date: true, amount: true },
        }),
        this.costing.allHealth(),
        this.notifications.topOpen(ATTENTION_LIMIT),
        this.backup.status(),
      ]);

    const order = { ONGOING: 0, ON_HOLD: 1, PLANNING: 2 } as Record<string, number>;
    const health = asDto<ProjectHealthDto[]>(healthRaw).sort(
      (a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3),
    );
    const perProject = await Promise.all(
      projects.map(async (p) => ({
        monthly: await this.costing.monthlyActuals(p, months),
        finance: await this.billing.summaryOf(this.prisma, p),
      })),
    );

    const spent = new Map<string, string[]>();
    for (const m of months) spent.set(m.month, []);
    for (const { monthly } of perProject) {
      for (const [m, r] of monthly) spent.get(m)!.push(r.total.actual.toString());
    }
    for (const x of looseExpenses) spent.get(toDay(x.date).slice(0, 7))?.push(x.amount.toString());

    const series = buildSeries(
      months.map((m) => m.month),
      spent,
      payments.map((p) => ({ date: toDay(p.date), amount: p.amount.toString() })),
    );
    const workers = workersOnSite(
      attendance.map((a) => a.workerId),
      planned.map((a) => a.workerId),
    );
    const now = new Date().toISOString();
    const backupItem = backupAttention(
      backup,
      backup.lastSuccess
        ? colomboDay(backup.lastSuccess.finishedAt ?? backup.lastSuccess.startedAt)
        : null,
      now,
    );
    const flagged = [...healthAttention(health, now), ...(backupItem ? [backupItem] : [])];
    const attention = mergeAttention(top.items, flagged, ATTENTION_LIMIT);

    return {
      today,
      month,
      kpis: {
        activeProjects: projects.filter((p) => p.status === 'ONGOING').length,
        workersOnSiteToday: workers.count,
        workersSource: workers.source,
        spentThisMonth: series[series.length - 1]!.spent,
        moneyToReceive: sumMoney(perProject.map((p) => p.finance.receivable)),
      },
      attention: attention.items,
      attentionTotal: top.total + flagged.length,
      projects: health,
      series,
      backup,
    };
  }
}
