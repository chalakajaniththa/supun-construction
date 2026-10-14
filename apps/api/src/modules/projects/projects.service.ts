import { Injectable } from '@nestjs/common';
import {
  BUDGET_CATEGORIES,
  type BudgetUpdate,
  type ProjectCreate,
  type ProjectListQuery,
  type ProjectUpdate,
  dayToDate,
  projectDateIssues,
  toDay,
} from '@sc/shared';
import { nextCode, withCodeRetry } from '../../common/codes/codes.js';
import { AppException } from '../../common/errors/app-exception.js';
import { type Decimal, sum } from '../../common/money/money.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly, searchWhere } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma, ProjectBudgetLine } from '../../generated/prisma/client.js';
import { SettingsService } from '../settings/settings.service.js';

const listInclude = {
  client: { select: { id: true, name: true, type: true } },
  budgetLines: { select: { amount: true } },
} satisfies Prisma.ProjectInclude;

const detailInclude = {
  client: { select: { id: true, name: true, type: true } },
  budgetLines: true,
  siteSupervisor: { select: { id: true, code: true, fullName: true } },
} satisfies Prisma.ProjectInclude;

const categoryOrder = (c: string) =>
  BUDGET_CATEGORIES.indexOf(c as (typeof BUDGET_CATEGORIES)[number]);

export function sortBudgetLines<T extends Pick<ProjectBudgetLine, 'category'>>(lines: T[]): T[] {
  return [...lines].sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
}

export function budgetTotal(lines: { amount: Decimal | Prisma.Decimal }[]): Decimal {
  return sum(lines.map((l) => l.amount));
}

/** Validation error on one field (shown next to that field in the form). */
function fieldError(path: string, message: string): AppException {
  return AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
    { path, message, code: 'custom' },
  ]);
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async list(q: ProjectListQuery) {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.source ? { source: q.source } : {}),
      ...(q.clientId ? { clientId: q.clientId } : {}),
      ...searchWhere(q.search, ['name', 'code', 'location', 'contractNo', 'tenderNo'] as const),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: listInclude,
        orderBy: [{ startDate: 'desc' }, { code: 'desc' }],
        ...toSkipTake(q),
      }),
      this.prisma.project.count({ where }),
    ]);
    const items = rows.map(({ budgetLines, ...p }) => ({
      ...p,
      totalBudget: budgetTotal(budgetLines),
    }));
    return paginated(items, total, q);
  }

  async get(id: string) {
    const row = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: detailInclude,
    });
    if (!row) throw AppException.notFound('Project not found.');
    return {
      ...row,
      budgetLines: sortBudgetLines(row.budgetLines),
      totalBudget: budgetTotal(row.budgetLines),
    };
  }

  private async assertRefs(data: { clientId?: string; siteSupervisorWorkerId?: string | null }) {
    if (data.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: data.clientId, deletedAt: null },
        select: { id: true },
      });
      if (!client) throw fieldError('clientId', 'NOT_FOUND');
    }
    if (data.siteSupervisorWorkerId) {
      const worker = await this.prisma.worker.findFirst({
        where: { id: data.siteSupervisorWorkerId, deletedAt: null },
        select: { id: true },
      });
      if (!worker) throw fieldError('siteSupervisorWorkerId', 'NOT_FOUND');
    }
  }

  /** Code PRJ-<start year>-NNN. Retention defaults come from the `billing` settings. */
  async create(data: ProjectCreate) {
    await this.assertRefs(data);
    const billing = await this.settings.get('billing');
    const year = data.startDate.slice(0, 4);
    const created = await withCodeRetry(
      () => nextCode(this.prisma, 'Project', `PRJ-${year}-`, 3),
      (code) =>
        this.prisma.project.create({
          data: {
            code,
            name: data.name,
            type: data.type,
            source: data.source,
            clientId: data.clientId,
            location: data.location,
            description: data.description,
            contractValue: data.contractValue ?? '0',
            contractNo: data.contractNo,
            tenderNo: data.tenderNo,
            startDate: dayToDate(data.startDate),
            plannedEndDate: dayToDate(data.plannedEndDate),
            revisedEndDate: dayToDate(data.revisedEndDate),
            actualEndDate: dayToDate(data.actualEndDate),
            status: data.status ?? 'PLANNING',
            retentionPct: data.retentionPct ?? billing.defaultRetentionPct,
            retentionCapPct: data.retentionCapPct ?? billing.defaultRetentionCapPct,
            advanceAmount: data.advanceAmount ?? '0',
            advanceRecoveryPct: data.advanceRecoveryPct ?? '0',
            dlpMonths: data.dlpMonths ?? 12,
            progressPct: data.progressPct,
            siteSupervisorWorkerId: data.siteSupervisorWorkerId,
            notes: data.notes,
          },
        }),
    );
    return this.get(created.id);
  }

  async update(id: string, data: ProjectUpdate) {
    const current = await this.get(id);
    const merged = {
      startDate: data.startDate ?? toDay(current.startDate),
      plannedEndDate: data.plannedEndDate ?? toDay(current.plannedEndDate),
      revisedEndDate:
        data.revisedEndDate === undefined ? toDay(current.revisedEndDate) : data.revisedEndDate,
      actualEndDate:
        data.actualEndDate === undefined ? toDay(current.actualEndDate) : data.actualEndDate,
    };
    const issue = projectDateIssues(merged)[0];
    if (issue) throw fieldError(issue.path, issue.message);
    await this.assertRefs(data);

    // Columns that cannot be empty fall back to their defaults when cleared.
    const billing = await this.settings.get('billing');
    const orDefault = <T>(v: T | null | undefined, d: T) => (v === null ? d : v);
    await this.prisma.project.update({
      where: { id },
      data: definedOnly({
        name: data.name,
        type: data.type,
        source: data.source,
        clientId: data.clientId,
        location: data.location,
        description: data.description,
        contractValue: orDefault(data.contractValue, '0'),
        contractNo: data.contractNo,
        tenderNo: data.tenderNo,
        startDate: data.startDate ? dayToDate(data.startDate) : undefined,
        plannedEndDate: data.plannedEndDate ? dayToDate(data.plannedEndDate) : undefined,
        revisedEndDate: dayToDate(data.revisedEndDate),
        actualEndDate: dayToDate(data.actualEndDate),
        status: data.status,
        retentionPct: orDefault(data.retentionPct, billing.defaultRetentionPct),
        retentionCapPct: orDefault(data.retentionCapPct, billing.defaultRetentionCapPct),
        advanceAmount: orDefault(data.advanceAmount, '0'),
        advanceRecoveryPct: orDefault(data.advanceRecoveryPct, '0'),
        dlpMonths: orDefault(data.dlpMonths, 12),
        progressPct: data.progressPct,
        siteSupervisorWorkerId: data.siteSupervisorWorkerId,
        notes: data.notes,
      }) as Prisma.ProjectUncheckedUpdateInput,
    });
    return this.get(id);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.get(id);
    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  async getBudget(id: string) {
    const project = await this.get(id);
    return { lines: project.budgetLines, total: project.totalBudget };
  }

  /** Replaces the whole budget: given categories are upserted, the others removed. */
  async putBudget(id: string, body: BudgetUpdate) {
    await this.get(id);
    const categories = body.lines.map((l) => l.category);
    await this.prisma.$transaction([
      this.prisma.projectBudgetLine.deleteMany({
        where: { projectId: id, category: { notIn: categories } },
      }),
      ...body.lines.map((l) =>
        this.prisma.projectBudgetLine.upsert({
          where: { projectId_category: { projectId: id, category: l.category } },
          create: { projectId: id, category: l.category, amount: l.amount, notes: l.notes ?? null },
          update: { amount: l.amount, notes: l.notes ?? null },
        }),
      ),
    ]);
    return this.getBudget(id);
  }
}
