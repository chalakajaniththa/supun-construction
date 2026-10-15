import { Injectable } from '@nestjs/common';
import {
  type ExpenseCreate,
  type ExpenseListQuery,
  type ExpenseUpdate,
  dayToDate,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { moneyString } from '../../common/money/money.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

type Db = PrismaService | Prisma.TransactionClient;

export const expenseInclude = {
  project: { select: { id: true, code: true, name: true } },
  asset: { select: { id: true, code: true, name: true } },
  supplier: { select: { id: true, code: true, name: true } },
  receipt: { select: { id: true, title: true, currentVersionId: true } },
} as const satisfies Prisma.ExpenseInclude;

function invalid(path: string, message = 'NOT_FOUND'): AppException {
  return AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
    { path, message, code: 'custom' },
  ]);
}

/**
 * Checks the linked records of an expense (project, asset, supplier, receipt document) and that a
 * CREDIT expense names its supplier. `prefix` is used for row errors in Daily Entry ("expenses.2.").
 */
export async function assertExpenseLinks(
  db: Db,
  v: {
    projectId?: string | null;
    assetId?: string | null;
    supplierId?: string | null;
    receiptDocumentId?: string | null;
    paidBy?: string;
  },
  prefix = '',
): Promise<void> {
  if (v.paidBy === 'CREDIT' && !v.supplierId) {
    throw invalid(`${prefix}supplierId`, 'SUPPLIER_REQUIRED_FOR_CREDIT');
  }
  if (v.projectId) {
    const ok = await db.project.count({ where: { id: v.projectId, deletedAt: null } });
    if (!ok) throw invalid(`${prefix}projectId`);
  }
  if (v.assetId) {
    const ok = await db.asset.count({ where: { id: v.assetId, deletedAt: null } });
    if (!ok) throw invalid(`${prefix}assetId`);
  }
  if (v.supplierId) {
    const ok = await db.supplier.count({ where: { id: v.supplierId, deletedAt: null } });
    if (!ok) throw invalid(`${prefix}supplierId`);
  }
  if (v.receiptDocumentId) {
    const ok = await db.document.count({ where: { id: v.receiptDocumentId, deletedAt: null } });
    if (!ok) throw invalid(`${prefix}receiptDocumentId`);
  }
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ExpenseListQuery) {
    const where: Prisma.ExpenseWhereInput = {
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.assetId ? { assetId: q.assetId } : {}),
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: dayToDate(q.from) } : {}),
              ...(q.to ? { lte: dayToDate(q.to) } : {}),
            },
          }
        : {}),
      ...(q.search ? { description: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [items, total, agg] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...toSkipTake(q),
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);
    return { ...paginated(items, total, q), totalAmount: moneyString(agg._sum.amount) };
  }

  async get(id: string) {
    const row = await this.prisma.expense.findUnique({ where: { id }, include: expenseInclude });
    if (!row) throw AppException.notFound('Expense not found.');
    return row;
  }

  async create(data: ExpenseCreate) {
    await assertExpenseLinks(this.prisma, data);
    return this.prisma.expense.create({
      data: {
        date: dayToDate(data.date),
        projectId: data.projectId ?? null,
        assetId: data.assetId ?? null,
        category: data.category,
        description: data.description,
        amount: data.amount,
        paidBy: data.paidBy,
        supplierId: data.supplierId ?? null,
        receiptDocumentId: data.receiptDocumentId ?? null,
      },
      include: expenseInclude,
    });
  }

  async update(id: string, data: ExpenseUpdate) {
    const current = await this.get(id);
    await assertExpenseLinks(this.prisma, {
      ...data,
      paidBy: data.paidBy ?? current.paidBy,
      supplierId: data.supplierId === undefined ? current.supplierId : data.supplierId,
    });
    return this.prisma.expense.update({
      where: { id },
      data: definedOnly({
        ...data,
        date: data.date ? dayToDate(data.date) : undefined,
      }) as Prisma.ExpenseUncheckedUpdateInput,
      include: expenseInclude,
    });
  }

  /** Expenses are not master data: removing one deletes it (the audit log keeps a trace). */
  async remove(id: string): Promise<{ id: string }> {
    await this.get(id);
    await this.prisma.expense.delete({ where: { id } });
    return { id };
  }
}
