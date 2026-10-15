import { Injectable } from '@nestjs/common';
import {
  type BondCreate,
  type BondListQuery,
  type BondUpdate,
  dayToDate,
  isOnOrAfter,
  toDay,
} from '@sc/shared';
import { addDays, todayInColombo } from '../../common/dates/dates.js';
import { AppException } from '../../common/errors/app-exception.js';
import { definedOnly } from '../../common/pagination/search.js';
import { fieldError, requireProject } from '../../common/projects/require-project.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

const include = {
  project: { select: { id: true, code: true, name: true } },
} as const satisfies Prisma.BondInclude;

/** Bank guarantees of a project (bid, performance, advance payment, retention). */
@Injectable()
export class BondsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All bonds; `expiringWithin=N` → ACTIVE bonds expiring on or before today + N (expired ones too). */
  async list(q: BondListQuery) {
    const where: Prisma.BondWhereInput = {
      project: { deletedAt: null },
      ...(q.status ? { status: q.status } : {}),
      ...(q.expiringWithin !== undefined
        ? {
            status: 'ACTIVE',
            expiryDate: { lte: dayToDate(addDays(todayInColombo(), q.expiringWithin)) },
          }
        : {}),
    };
    return this.prisma.bond.findMany({ where, include, orderBy: [{ expiryDate: 'asc' }] });
  }

  async listForProject(projectId: string) {
    await requireProject(this.prisma, projectId);
    return this.prisma.bond.findMany({
      where: { projectId },
      include,
      orderBy: [{ status: 'asc' }, { expiryDate: 'asc' }],
    });
  }

  async create(projectId: string, data: BondCreate) {
    await requireProject(this.prisma, projectId);
    return this.prisma.bond.create({
      data: {
        projectId,
        type: data.type,
        bank: data.bank,
        referenceNo: data.referenceNo,
        amount: data.amount,
        issueDate: dayToDate(data.issueDate),
        expiryDate: dayToDate(data.expiryDate),
        status: data.status ?? 'ACTIVE',
        notes: data.notes ?? null,
      },
      include,
    });
  }

  private async bond(projectId: string, id: string) {
    await requireProject(this.prisma, projectId);
    const b = await this.prisma.bond.findFirst({ where: { id, projectId } });
    if (!b) throw AppException.notFound('Bond not found.');
    return b;
  }

  async update(projectId: string, id: string, data: BondUpdate) {
    const b = await this.bond(projectId, id);
    const issue = data.issueDate ?? toDay(b.issueDate);
    const expiry = data.expiryDate ?? toDay(b.expiryDate);
    if (!isOnOrAfter(issue, expiry)) throw fieldError('expiryDate', 'END_BEFORE_START');
    return this.prisma.bond.update({
      where: { id },
      data: definedOnly({
        ...data,
        issueDate: data.issueDate ? dayToDate(data.issueDate) : undefined,
        expiryDate: data.expiryDate ? dayToDate(data.expiryDate) : undefined,
      }) as Prisma.BondUncheckedUpdateInput,
      include,
    });
  }

  async remove(projectId: string, id: string) {
    await this.bond(projectId, id);
    await this.prisma.bond.delete({ where: { id } });
    return { id };
  }
}
