import { Injectable } from '@nestjs/common';
import { type CostQuery, dayToDate, toDay } from '@sc/shared';
import { todayInColombo } from '../../common/dates/dates.js';
import { requireProject } from '../../common/projects/require-project.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma, Project } from '../../generated/prisma/client.js';
import { BoqService } from '../boq/boq.service.js';
import { PayrollService } from '../payroll/payroll.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  type CostingInput,
  type CostingResult,
  type LabourWorker,
  calculateCosts,
  sliceCostingInput,
} from './calc/costing.js';
import { projectHealth } from './calc/health.js';

/** Project actual cost vs budget, and health (time / budget / physical progress + flags). */
@Injectable()
export class CostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly payroll: PayrollService,
    private readonly boq: BoqService,
  ) {}

  async compute(project: Project, from?: string, to?: string): Promise<CostingResult> {
    return calculateCosts(await this.loadInput(project, from, to));
  }

  /**
   * Actual cost per month (dashboard / monthly summary): loads the whole range once, then runs
   * the calculator on each month's slice — the same result as compute() per month.
   */
  async monthlyActuals(
    project: Project,
    months: readonly { month: string; from: string; to: string }[],
  ): Promise<Map<string, CostingResult>> {
    const out = new Map<string, CostingResult>();
    if (!months.length) return out;
    const input = await this.loadInput(project, months[0]!.from, months[months.length - 1]!.to);
    for (const m of months)
      out.set(m.month, calculateCosts(sliceCostingInput(input, m.from, m.to)));
    return out;
  }

  /** Everything the costing calculator needs for one project and (optional) date range. */
  async loadInput(project: Project, from?: string, to?: string): Promise<CostingInput> {
    const date: Prisma.DateTimeFilter | undefined =
      from || to
        ? { ...(from ? { gte: dayToDate(from) } : {}), ...(to ? { lte: dayToDate(to) } : {}) }
        : undefined;
    const projectId = project.id;
    const [settings, budget, attendance, shares, purchaseLines, issues, usage, expenses] =
      await Promise.all([
        this.settings.get('payroll'),
        this.prisma.projectBudgetLine.findMany({ where: { projectId } }),
        this.prisma.attendance.findMany({
          where: { projectId, ...(date ? { date } : {}) },
          select: {
            date: true,
            status: true,
            otHours: true,
            worker: {
              select: { id: true, code: true, fullName: true, type: true, rates: true },
            },
          },
        }),
        this.payroll.finalizedShares(projectId, from, to),
        this.prisma.purchaseLine.findMany({
          where: { projectId, ...(date ? { purchase: { date } } : {}) },
          include: {
            material: { select: { name: true, unit: true } },
            purchase: { select: { id: true, date: true, invoiceNo: true } },
          },
        }),
        this.prisma.materialIssue.findMany({
          where: { projectId, ...(date ? { date } : {}) },
          include: { material: { select: { name: true, unit: true } } },
        }),
        this.prisma.assetUsageLog.findMany({
          where: { projectId, ...(date ? { date } : {}) },
          include: {
            asset: {
              select: {
                id: true,
                code: true,
                name: true,
                internalRatePerHour: true,
                internalRatePerDay: true,
              },
            },
          },
        }),
        this.prisma.expense.findMany({
          where: { projectId, ...(date ? { date } : {}) },
          include: { supplier: { select: { name: true } } },
        }),
      ]);

    const labour = new Map<string, LabourWorker>();
    for (const a of attendance) {
      let w = labour.get(a.worker.id);
      if (!w) {
        w = {
          workerId: a.worker.id,
          code: a.worker.code,
          name: a.worker.fullName,
          type: a.worker.type,
          rates: a.worker.rates.map((r) => ({
            effectiveFrom: toDay(r.effectiveFrom),
            dailyRate: r.dailyRate?.toString() ?? null,
            monthlySalary: r.monthlySalary?.toString() ?? null,
            otHourlyRate: r.otHourlyRate?.toString() ?? null,
          })),
          days: [],
          finalized: shares.get(a.worker.id) ?? [],
        };
        labour.set(a.worker.id, w);
      }
      (w.days as { date: string; status: typeof a.status; otHours: string }[]).push({
        date: toDay(a.date),
        status: a.status,
        otHours: a.otHours.toString(),
      });
    }

    return {
      budget: Object.fromEntries(budget.map((b) => [b.category, b.amount.toString()])),
      settings,
      labour: [...labour.values()],
      purchases: purchaseLines.map((l) => ({
        date: toDay(l.purchase.date),
        material: l.material.name,
        unit: l.material.unit,
        quantity: l.quantity.toString(),
        amount: l.amount.toString(),
        reference: l.purchase.invoiceNo,
        refId: l.purchase.id,
      })),
      issues: issues.map((i) => ({
        date: toDay(i.date),
        material: i.material.name,
        unit: i.material.unit,
        quantity: i.quantity.toString(),
        unitCost: i.unitCost.toString(),
        refId: i.id,
      })),
      usage: usage.map((u) => ({
        date: toDay(u.date),
        assetId: u.asset.id,
        assetCode: u.asset.code,
        assetName: u.asset.name,
        hoursUsed: u.hoursUsed.toString(),
        ratePerHour: u.asset.internalRatePerHour?.toString() ?? null,
        ratePerDay: u.asset.internalRatePerDay?.toString() ?? null,
        fuelLitres: u.fuelLitres?.toString() ?? null,
        fuelCost: u.fuelCost?.toString() ?? null,
      })),
      expenses: expenses.map((x) => ({
        id: x.id,
        date: toDay(x.date),
        category: x.category,
        description: x.description,
        amount: x.amount.toString(),
        supplier: x.supplier?.name ?? null,
      })),
    };
  }

  async costs(projectId: string, q: CostQuery) {
    const project = await requireProject(this.prisma, projectId);
    const r = await this.compute(project, q.from, q.to);
    const category = q.category ?? 'LABOUR';
    const list = r.byCategory.find((c) => c.category === category)!.entries;
    const start = (q.page - 1) * q.pageSize;
    return {
      from: q.from ?? null,
      to: q.to ?? null,
      byCategory: r.byCategory.map(({ entries, ...c }) => ({ ...c, count: entries.length })),
      total: r.total,
      estimated: r.estimated,
      entries: {
        category,
        items: list.slice(start, start + q.pageSize),
        total: list.length,
        page: q.page,
        pageSize: q.pageSize,
      },
    };
  }

  private async healthOf(project: Project & { client: { name: string } }, today: string) {
    const [costs, progress] = await Promise.all([
      this.compute(project),
      this.boq.progressOf(this.prisma, project.id, today),
    ]);
    const currentEndDate = toDay(project.revisedEndDate ?? project.plannedEndDate);
    const h = projectHealth({
      today,
      status: project.status,
      startDate: toDay(project.startDate),
      currentEndDate,
      budget: costs.total.budget,
      actual: costs.total.actual,
      boqPct: progress ? progress.physicalPct : null,
      manualPct: project.progressPct?.toString() ?? null,
    });
    return {
      projectId: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      clientName: project.client.name,
      ...h,
      budget: costs.total.budget,
      actual: costs.total.actual,
      estimated: costs.estimated,
      currentEndDate,
    };
  }

  async health(projectId: string) {
    await requireProject(this.prisma, projectId);
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { client: { select: { name: true } } },
    });
    return this.healthOf(project, todayInColombo());
  }

  /** Health of every active project (not completed / cancelled), for the dashboard. */
  async allHealth() {
    const projects = await this.prisma.project.findMany({
      where: { deletedAt: null, status: { in: ['ONGOING', 'ON_HOLD', 'PLANNING'] } },
      include: { client: { select: { name: true } } },
      orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
    });
    const today = todayInColombo();
    const out = [];
    for (const p of projects) out.push(await this.healthOf(p, today));
    return out;
  }
}
