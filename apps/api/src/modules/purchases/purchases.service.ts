import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type PurchaseCreate,
  type PurchaseListQuery,
  type PurchaseUpdate,
  type StockDto,
  type StoreIssueCreate,
  type StoreIssueListQuery,
  dayToDate,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { dec, moneyString, roundMoney, sum } from '../../common/money/money.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { lineAmount, stockLevel, stockRow, weightedAverageCost } from './calc/stock.js';

type Tx = Prisma.TransactionClient;

const purchaseInclude = {
  supplier: { select: { id: true, code: true, name: true } },
  lines: {
    include: {
      material: { select: { id: true, name: true, nameSinhala: true, unit: true } },
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const satisfies Prisma.PurchaseInclude;

const issueInclude = {
  material: { select: { id: true, name: true, nameSinhala: true, unit: true } },
  project: { select: { id: true, code: true, name: true } },
} as const;

function invalid(path: string, message = 'NOT_FOUND'): AppException {
  return AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
    { path, message, code: 'custom' },
  ]);
}

/** Serialises store changes per material (issues and purchase edits) inside a transaction. */
async function lockMaterials(tx: Tx, materialIds: Iterable<string>): Promise<void> {
  for (const id of [...new Set(materialIds)].sort()) {
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${id}))`;
  }
}

/** Store quantities of one material: purchased into the store, issued out of it. */
async function storeTotals(tx: Tx | PrismaService, materialId: string) {
  const [bought, issued] = await Promise.all([
    tx.purchaseLine.aggregate({
      where: { materialId, projectId: null },
      _sum: { quantity: true, amount: true },
    }),
    tx.materialIssue.aggregate({ where: { materialId }, _sum: { quantity: true } }),
  ]);
  return {
    purchasedQty: dec(bought._sum.quantity),
    purchasedAmount: dec(bought._sum.amount),
    issuedQty: dec(issued._sum.quantity),
  };
}

async function assertStockNotNegative(tx: Tx, materialIds: Iterable<string>): Promise<void> {
  for (const id of new Set(materialIds)) {
    const t = await storeTotals(tx, id);
    const stock = stockLevel(t.purchasedQty, t.issuedQty);
    if (stock.lt(0)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'INSUFFICIENT_STOCK',
        'Part of this was already issued from the store, so it cannot be removed.',
        { materialId: id, available: stock.toString() },
      );
    }
  }
}

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Purchases ──
  async list(q: PurchaseListQuery) {
    const where: Prisma.PurchaseWhereInput = {
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.paymentType ? { paymentType: q.paymentType } : {}),
      ...(q.projectId ? { lines: { some: { projectId: q.projectId } } } : {}),
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: dayToDate(q.from) } : {}),
              ...(q.to ? { lte: dayToDate(q.to) } : {}),
            },
          }
        : {}),
      ...(q.search
        ? {
            OR: [
              { invoiceNo: { contains: q.search, mode: 'insensitive' as const } },
              { notes: { contains: q.search, mode: 'insensitive' as const } },
              { supplier: { name: { contains: q.search, mode: 'insensitive' as const } } },
              {
                lines: {
                  some: {
                    material: { name: { contains: q.search, mode: 'insensitive' as const } },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total, agg] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        where,
        include: purchaseInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...toSkipTake(q),
      }),
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.aggregate({ where, _sum: { total: true } }),
    ]);
    return { ...paginated(items, total, q), totalAmount: moneyString(agg._sum.total) };
  }

  async get(id: string) {
    const row = await this.prisma.purchase.findUnique({ where: { id }, include: purchaseInclude });
    if (!row) throw AppException.notFound('Purchase not found.');
    return row;
  }

  private async assertLinks(
    tx: Tx,
    data: { supplierId?: string; lines?: PurchaseCreate['lines'] },
  ) {
    if (data.supplierId) {
      const ok = await tx.supplier.count({ where: { id: data.supplierId, deletedAt: null } });
      if (!ok) throw invalid('supplierId');
    }
    for (const [i, l] of (data.lines ?? []).entries()) {
      const m = await tx.material.count({ where: { id: l.materialId, deletedAt: null } });
      if (!m) throw invalid(`lines.${i}.materialId`);
      if (l.projectId) {
        const p = await tx.project.count({ where: { id: l.projectId, deletedAt: null } });
        if (!p) throw invalid(`lines.${i}.projectId`);
      }
    }
  }

  private linesData(lines: PurchaseCreate['lines']) {
    const rows = lines.map((l) => ({
      materialId: l.materialId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: lineAmount(l.quantity, l.unitPrice).toFixed(2),
      projectId: l.projectId ?? null,
    }));
    return { rows, total: roundMoney(sum(rows.map((r) => r.amount))).toFixed(2) };
  }

  /** The total is always computed here: Σ round(quantity × unit price). */
  async create(data: PurchaseCreate) {
    const { rows, total } = this.linesData(data.lines);
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertLinks(tx, data);
      return tx.purchase.create({
        data: {
          supplierId: data.supplierId,
          date: dayToDate(data.date),
          invoiceNo: data.invoiceNo ?? null,
          paymentType: data.paymentType,
          notes: data.notes ?? null,
          total,
          lines: { create: rows },
        },
      });
    });
    return this.get(created.id);
  }

  /** `lines`, when given, replace all lines. The store may not go below what was issued. */
  async update(id: string, data: PurchaseUpdate) {
    const current = await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      await this.assertLinks(tx, data);
      const head = {
        ...(data.supplierId ? { supplierId: data.supplierId } : {}),
        ...(data.date ? { date: dayToDate(data.date) } : {}),
        ...(data.invoiceNo !== undefined ? { invoiceNo: data.invoiceNo } : {}),
        ...(data.paymentType ? { paymentType: data.paymentType } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      };
      if (data.lines) {
        const affected = [
          ...current.lines.filter((l) => !l.projectId).map((l) => l.materialId),
          ...data.lines.filter((l) => !l.projectId).map((l) => l.materialId),
        ];
        await lockMaterials(tx, affected);
        const { rows, total } = this.linesData(data.lines);
        await tx.purchaseLine.deleteMany({ where: { purchaseId: id } });
        await tx.purchase.update({
          where: { id },
          data: { ...head, total, lines: { create: rows } },
        });
        await assertStockNotNegative(tx, affected);
      } else {
        await tx.purchase.update({ where: { id }, data: head });
      }
    });
    return this.get(id);
  }

  async remove(id: string): Promise<{ id: string }> {
    const current = await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      const affected = current.lines.filter((l) => !l.projectId).map((l) => l.materialId);
      await lockMaterials(tx, affected);
      await tx.purchase.delete({ where: { id } });
      await assertStockNotNegative(tx, affected);
    });
    return { id };
  }

  // ── Store ──
  /** Per material: bought into the store, issued, in stock, average cost and value. */
  async stock(): Promise<StockDto> {
    const [bought, issued] = await Promise.all([
      this.prisma.purchaseLine.groupBy({
        by: ['materialId'],
        where: { projectId: null },
        _sum: { quantity: true, amount: true },
      }),
      this.prisma.materialIssue.groupBy({ by: ['materialId'], _sum: { quantity: true } }),
    ]);
    const ids = [...new Set([...bought, ...issued].map((r) => r.materialId))];
    const materials = await this.prisma.material.findMany({
      where: { id: { in: ids } },
      orderBy: { name: 'asc' },
    });
    const issuedBy = new Map(issued.map((r) => [r.materialId, dec(r._sum.quantity)]));
    const boughtBy = new Map(bought.map((r) => [r.materialId, r._sum]));
    const items = materials.map((m) => {
      const b = boughtBy.get(m.id);
      const purchasedQty = dec(b?.quantity);
      const issuedQty = issuedBy.get(m.id) ?? dec(0);
      const row = stockRow({ purchasedQty, purchasedAmount: dec(b?.amount), issuedQty });
      return {
        materialId: m.id,
        name: m.name,
        nameSinhala: m.nameSinhala,
        unit: m.unit,
        category: m.category,
        purchasedQty: purchasedQty.toString(),
        issuedQty: issuedQty.toString(),
        stock: row.stock.toString(),
        averageCost: row.averageCost.toFixed(2),
        value: row.value.toFixed(2),
      };
    });
    return { items, totalValue: moneyString(sum(items.map((i) => i.value))) };
  }

  /**
   * Issue from the main store to a project. Unit cost = weighted average of the store purchases
   * up to the issue date (all store purchases when none are that old). 409 INSUFFICIENT_STOCK when
   * the store does not have enough.
   */
  async issue(data: StoreIssueCreate) {
    const created = await this.prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({
        where: { id: data.materialId, deletedAt: null },
      });
      if (!material) throw invalid('materialId');
      const project = await tx.project.count({ where: { id: data.projectId, deletedAt: null } });
      if (!project) throw invalid('projectId');
      await lockMaterials(tx, [data.materialId]);
      const totals = await storeTotals(tx, data.materialId);
      const available = stockLevel(totals.purchasedQty, totals.issuedQty);
      if (available.lt(dec(data.quantity))) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'INSUFFICIENT_STOCK',
          'There is not enough stock in the store.',
          { materialId: data.materialId, available: available.toString(), unit: material.unit },
        );
      }
      const upToDate = await tx.purchaseLine.findMany({
        where: {
          materialId: data.materialId,
          projectId: null,
          purchase: { date: { lte: dayToDate(data.date) } },
        },
        select: { quantity: true, amount: true },
      });
      const unitCost = upToDate.length
        ? weightedAverageCost(upToDate)
        : weightedAverageCost([{ quantity: totals.purchasedQty, amount: totals.purchasedAmount }]);
      return tx.materialIssue.create({
        data: {
          materialId: data.materialId,
          projectId: data.projectId,
          date: dayToDate(data.date),
          quantity: data.quantity,
          unitCost: unitCost.toFixed(2),
          notes: data.notes ?? null,
        },
        include: issueInclude,
      });
    });
    return withAmount(created);
  }

  async listIssues(q: StoreIssueListQuery) {
    const where: Prisma.MaterialIssueWhereInput = {
      ...(q.materialId ? { materialId: q.materialId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: dayToDate(q.from) } : {}),
              ...(q.to ? { lte: dayToDate(q.to) } : {}),
            },
          }
        : {}),
      ...(q.search
        ? {
            OR: [
              { material: { name: { contains: q.search, mode: 'insensitive' as const } } },
              { project: { name: { contains: q.search, mode: 'insensitive' as const } } },
              { notes: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.materialIssue.findMany({
        where,
        include: issueInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...toSkipTake(q),
      }),
      this.prisma.materialIssue.count({ where }),
    ]);
    return paginated(items.map(withAmount), total, q);
  }

  /** Undo a wrong issue: the quantity goes back into the store. */
  async removeIssue(id: string): Promise<{ id: string }> {
    const row = await this.prisma.materialIssue.findUnique({ where: { id } });
    if (!row) throw AppException.notFound('Issue not found.');
    await this.prisma.materialIssue.delete({ where: { id } });
    return { id };
  }
}

function withAmount<T extends { quantity: Prisma.Decimal; unitCost: Prisma.Decimal }>(row: T) {
  return { ...row, amount: roundMoney(dec(row.quantity).times(dec(row.unitCost))).toFixed(2) };
}
