import { Injectable } from '@nestjs/common';
import {
  type AdvanceCreate,
  type AdvanceListQuery,
  type AdvanceUpdate,
  dayToDate,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { dec, moneyString, sum } from '../../common/money/money.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

const advanceInclude = {
  worker: { select: { id: true, code: true, fullName: true, type: true } },
  recoveries: { select: { amount: true } },
} as const satisfies Prisma.AdvanceInclude;

type Row = Prisma.AdvanceGetPayload<{ include: typeof advanceInclude }>;

/** Adds what was recovered so far (payroll, Step 4) and the remaining balance. */
export function withBalance({ recoveries, ...a }: Row) {
  const recovered = sum(recoveries.map((r) => r.amount));
  return {
    ...a,
    recovered: recovered.toFixed(2),
    balance: dec(a.amount).minus(recovered).toFixed(2),
    recoveryCount: recoveries.length,
  };
}

@Injectable()
export class AdvancesService {
  constructor(private readonly prisma: PrismaService) {}

  private async worker(id: string) {
    const w = await this.prisma.worker.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!w) throw AppException.notFound('Worker not found.');
  }

  /** All advances (optionally only OPEN ones), newest first, with the total balance. */
  async list(q: AdvanceListQuery) {
    const where: Prisma.AdvanceWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.workerId ? { workerId: q.workerId } : {}),
      worker: {
        deletedAt: null,
        ...(q.search
          ? {
              OR: [
                { fullName: { contains: q.search, mode: 'insensitive' as const } },
                { code: { contains: q.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
    };
    const [rows, total, all] = await this.prisma.$transaction([
      this.prisma.advance.findMany({
        where,
        include: advanceInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...toSkipTake(q),
      }),
      this.prisma.advance.count({ where }),
      this.prisma.advance.findMany({
        where,
        include: { recoveries: { select: { amount: true } } },
      }),
    ]);
    const totalBalance = sum(
      all.map((a) => dec(a.amount).minus(sum(a.recoveries.map((r) => r.amount)))),
    );
    return {
      ...paginated(rows.map(withBalance), total, q),
      totalBalance: moneyString(totalBalance),
    };
  }

  async listForWorker(workerId: string) {
    await this.worker(workerId);
    const rows = await this.prisma.advance.findMany({
      where: { workerId },
      include: advanceInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(withBalance);
  }

  async create(workerId: string, data: AdvanceCreate) {
    await this.worker(workerId);
    const row = await this.prisma.advance.create({
      data: {
        workerId,
        date: dayToDate(data.date),
        amount: data.amount,
        reason: data.reason ?? null,
        recoveryPerMonth: data.recoveryPerMonth ?? null,
      },
      include: advanceInclude,
    });
    return withBalance(row);
  }

  private async find(workerId: string, id: string) {
    await this.worker(workerId);
    const row = await this.prisma.advance.findFirst({
      where: { id, workerId },
      include: advanceInclude,
    });
    if (!row) throw AppException.notFound('Advance not found.');
    if (row.recoveries.length) {
      throw AppException.conflict(
        'ADVANCE_HAS_RECOVERIES',
        'Part of this advance was already recovered from salary, so it cannot be changed.',
      );
    }
    return row;
  }

  /** Only while nothing was recovered yet. */
  async update(workerId: string, id: string, data: AdvanceUpdate) {
    const current = await this.find(workerId, id);
    const amount = data.amount ?? current.amount.toString();
    const perMonth =
      data.recoveryPerMonth === undefined
        ? current.recoveryPerMonth?.toString()
        : data.recoveryPerMonth;
    if (perMonth && dec(perMonth).gt(dec(amount))) {
      throw AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
        { path: 'recoveryPerMonth', message: 'RECOVERY_MORE_THAN_AMOUNT', code: 'custom' },
      ]);
    }
    const row = await this.prisma.advance.update({
      where: { id },
      data: definedOnly({
        ...data,
        date: data.date ? dayToDate(data.date) : undefined,
      }) as Prisma.AdvanceUncheckedUpdateInput,
      include: advanceInclude,
    });
    return withBalance(row);
  }

  async remove(workerId: string, id: string): Promise<{ id: string }> {
    await this.find(workerId, id);
    await this.prisma.advance.delete({ where: { id } });
    return { id };
  }
}
