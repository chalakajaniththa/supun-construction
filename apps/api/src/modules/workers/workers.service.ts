import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type Paginated,
  type WorkerCreate,
  type WorkerListQuery,
  type WorkerRateCreate,
  type WorkerUpdate,
  dayToDate,
  rateIssues,
} from '@sc/shared';
import { nextCode, withCodeRetry } from '../../common/codes/codes.js';
import { todayInColombo } from '../../common/dates/dates.js';
import { AppException } from '../../common/errors/app-exception.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly, searchWhere } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma, Worker, WorkerRate } from '../../generated/prisma/client.js';

export type WorkerWithRate = Worker & { currentRate: WorkerRate | null };

const currentRateInclude = (day: string) =>
  ({
    rates: {
      where: { effectiveFrom: { lte: dayToDate(day) } },
      orderBy: { effectiveFrom: 'desc' },
      take: 1,
    },
  }) satisfies Prisma.WorkerInclude;

function withCurrentRate({ rates, ...w }: Worker & { rates: WorkerRate[] }): WorkerWithRate {
  return { ...w, currentRate: rates[0] ?? null };
}

function conflict(path: string, message: string): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'DUPLICATE',
    'A record with the same value already exists.',
    [{ path, message, code: 'custom' }],
  );
}

@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: WorkerListQuery): Promise<Paginated<WorkerWithRate>> {
    const where: Prisma.WorkerWhereInput = {
      deletedAt: null,
      ...(q.type ? { type: q.type } : {}),
      ...(q.skill ? { skill: q.skill } : {}),
      ...(q.active !== undefined ? { active: q.active } : {}),
      ...searchWhere(q.search, ['fullName', 'nameSinhala', 'code', 'nic', 'phone'] as const),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.worker.findMany({
        where,
        include: currentRateInclude(todayInColombo()),
        orderBy: { code: 'asc' },
        ...toSkipTake(q),
      }),
      this.prisma.worker.count({ where }),
    ]);
    return paginated(rows.map(withCurrentRate), total, q);
  }

  async get(id: string): Promise<WorkerWithRate> {
    const row = await this.prisma.worker.findFirst({
      where: { id, deletedAt: null },
      include: currentRateInclude(todayInColombo()),
    });
    if (!row) throw AppException.notFound('Worker not found.');
    return withCurrentRate(row);
  }

  private async assertNicFree(nic: string | null | undefined, exceptId?: string) {
    if (!nic) return;
    const other = await this.prisma.worker.findFirst({
      where: { nic, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (other) throw conflict('nic', 'NIC_TAKEN');
  }

  /** Code W-NNNN; the starting pay becomes the first rate, effective from the joined date. */
  async create(data: WorkerCreate): Promise<WorkerWithRate> {
    await this.assertNicFree(data.nic);
    const { dailyRate, monthlySalary, otHourlyRate, ...fields } = data;
    const worker = await withCodeRetry(
      () => nextCode(this.prisma, 'Worker', 'W-', 4),
      (code) =>
        this.prisma.worker.create({
          data: {
            ...fields,
            code,
            active: fields.active ?? true,
            dateOfBirth: dayToDate(fields.dateOfBirth),
            joinedDate: dayToDate(fields.joinedDate),
            leftDate: dayToDate(fields.leftDate),
            rates: {
              create: {
                effectiveFrom: dayToDate(fields.joinedDate),
                dailyRate,
                monthlySalary,
                otHourlyRate,
              },
            },
          },
        }),
    );
    return this.get(worker.id);
  }

  async update(id: string, data: WorkerUpdate): Promise<WorkerWithRate> {
    const current = await this.get(id);
    await this.assertNicFree(data.nic, id);
    const joined = data.joinedDate ?? current.joinedDate.toISOString().slice(0, 10);
    const left =
      data.leftDate === undefined ? current.leftDate?.toISOString().slice(0, 10) : data.leftDate;
    if (left && left < joined) {
      throw AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
        { path: 'leftDate', message: 'END_BEFORE_START', code: 'custom' },
      ]);
    }
    await this.prisma.worker.update({
      where: { id },
      data: definedOnly({
        ...data,
        dateOfBirth: dayToDate(data.dateOfBirth),
        joinedDate: data.joinedDate ? dayToDate(data.joinedDate) : undefined,
        leftDate: dayToDate(data.leftDate),
      }) as Prisma.WorkerUncheckedUpdateInput,
    });
    return this.get(id);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.get(id);
    await this.prisma.worker.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    return { id };
  }

  /** Rate history, newest first. */
  async listRates(workerId: string): Promise<WorkerRate[]> {
    await this.get(workerId);
    return this.prisma.workerRate.findMany({
      where: { workerId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async addRate(workerId: string, data: WorkerRateCreate): Promise<WorkerRate> {
    const worker = await this.get(workerId);
    const issue = rateIssues({ type: worker.type, ...data })[0];
    if (issue) {
      throw AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
        { path: issue.path, message: issue.message, code: 'custom' },
      ]);
    }
    const effectiveFrom = dayToDate(data.effectiveFrom);
    const existing = await this.prisma.workerRate.findUnique({
      where: { workerId_effectiveFrom: { workerId, effectiveFrom } },
      select: { id: true },
    });
    if (existing) throw conflict('effectiveFrom', 'RATE_DATE_TAKEN');
    return this.prisma.workerRate.create({
      data: {
        workerId,
        effectiveFrom,
        dailyRate: data.dailyRate ?? null,
        monthlySalary: data.monthlySalary ?? null,
        otHourlyRate: data.otHourlyRate ?? null,
      },
    });
  }

  /** Removes a wrongly entered rate. The only remaining rate cannot be removed. */
  async removeRate(workerId: string, rateId: string): Promise<{ id: string }> {
    await this.get(workerId);
    const rates = await this.prisma.workerRate.findMany({
      where: { workerId },
      select: { id: true },
    });
    if (!rates.some((r) => r.id === rateId)) throw AppException.notFound('Rate not found.');
    if (rates.length <= 1) {
      throw AppException.conflict('CONFLICT', 'A worker needs at least one pay rate.');
    }
    await this.prisma.workerRate.delete({ where: { id: rateId } });
    return { id: rateId };
  }

  /**
   * The pay rate in force for a worker on a calendar day ("YYYY-MM-DD"): the latest rate with
   * effectiveFrom ≤ day, or null. Used by payroll and costing (Steps 3–4).
   */
  getRateOn(workerId: string, day: string): Promise<WorkerRate | null> {
    return this.prisma.workerRate.findFirst({
      where: { workerId, effectiveFrom: { lte: dayToDate(day) } },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
}
