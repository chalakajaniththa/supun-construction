import { Injectable } from '@nestjs/common';
import {
  type StatementDto,
  type StatementQuery,
  type SupplierBalanceDto,
  type SupplierPaymentCreate,
  dayToDate,
  toDay,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { dec } from '../../common/money/money.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { buildStatement, supplierBalance } from './calc/balance.js';

/** Supplier payments, balances and statements. */
@Injectable()
export class SupplierAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  private async supplier(id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (!s) throw AppException.notFound('Supplier not found.');
    return s;
  }

  /** Balance owed per supplier id (only suppliers with any credit or payment appear). */
  async balancesFor(
    supplierIds?: string[],
  ): Promise<Map<string, { credit: string; paid: string; balance: string }>> {
    const idFilter = supplierIds ? { supplierId: { in: supplierIds } } : {};
    const [purchases, expenses, payments] = await Promise.all([
      this.prisma.purchase.groupBy({
        by: ['supplierId'],
        where: { paymentType: 'CREDIT', ...idFilter },
        _sum: { total: true },
      }),
      this.prisma.expense.groupBy({
        by: ['supplierId'],
        where: { paidBy: 'CREDIT', supplierId: supplierIds ? { in: supplierIds } : { not: null } },
        _sum: { amount: true },
      }),
      this.prisma.supplierPayment.groupBy({
        by: ['supplierId'],
        where: idFilter,
        _sum: { amount: true },
      }),
    ]);
    const ids = new Set<string>();
    const p = new Map(purchases.map((r) => [r.supplierId, r._sum.total]));
    const e = new Map(
      expenses.filter((r) => r.supplierId).map((r) => [r.supplierId!, r._sum.amount]),
    );
    const pay = new Map(payments.map((r) => [r.supplierId, r._sum.amount]));
    for (const m of [p, e, pay]) for (const k of m.keys()) ids.add(k);
    const out = new Map<string, { credit: string; paid: string; balance: string }>();
    for (const id of ids) {
      const credit = dec(p.get(id)).plus(dec(e.get(id)));
      const balance = supplierBalance([p.get(id) ?? 0], [e.get(id) ?? 0], [pay.get(id) ?? 0]);
      out.set(id, {
        credit: credit.toFixed(2),
        paid: dec(pay.get(id)).toFixed(2),
        balance: balance.toFixed(2),
      });
    }
    return out;
  }

  /** Every (not deleted) supplier with what we owe, largest balance first. */
  async balances(): Promise<SupplierBalanceDto[]> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    const map = await this.balancesFor();
    return suppliers
      .map((s) => {
        const b = map.get(s.id) ?? { credit: '0.00', paid: '0.00', balance: '0.00' };
        return { supplierId: s.id, code: s.code, name: s.name, ...b };
      })
      .sort((a, b) => dec(b.balance).comparedTo(dec(a.balance)) || a.name.localeCompare(b.name));
  }

  async statement(id: string, q: StatementQuery): Promise<StatementDto> {
    const supplier = await this.supplier(id);
    const [purchases, expenses, payments] = await Promise.all([
      this.prisma.purchase.findMany({
        where: { supplierId: id, paymentType: 'CREDIT' },
        include: { lines: { include: { material: { select: { name: true } } } } },
      }),
      this.prisma.expense.findMany({ where: { supplierId: id, paidBy: 'CREDIT' } }),
      this.prisma.supplierPayment.findMany({ where: { supplierId: id } }),
    ]);
    const s = buildStatement(
      [
        ...purchases.map((p) => ({
          kind: 'PURCHASE' as const,
          id: p.id,
          date: toDay(p.date),
          createdAt: p.createdAt,
          description: [...new Set(p.lines.map((l) => l.material.name))].join(', '),
          reference: p.invoiceNo,
          amount: p.total,
        })),
        ...expenses.map((e) => ({
          kind: 'EXPENSE' as const,
          id: e.id,
          date: toDay(e.date),
          createdAt: e.createdAt,
          description: e.description,
          reference: null,
          amount: e.amount,
        })),
        ...payments.map((p) => ({
          kind: 'PAYMENT' as const,
          id: p.id,
          date: toDay(p.date),
          createdAt: p.createdAt,
          description: p.notes ?? '',
          reference: p.reference,
          amount: p.amount,
          method: p.method,
        })),
      ],
      q.from,
      q.to,
    );
    return {
      supplier,
      from: q.from ?? null,
      to: q.to ?? null,
      openingBalance: s.openingBalance.toFixed(2),
      entries: s.rows.map((r) => ({
        kind: r.kind,
        id: r.id,
        date: r.date,
        description: r.description,
        reference: r.reference,
        debit: r.debit.toFixed(2),
        credit: r.credit.toFixed(2),
        balance: r.balance.toFixed(2),
        ...(r.method ? { method: r.method as StatementDto['entries'][number]['method'] } : {}),
      })),
      totalDebit: s.totalDebit.toFixed(2),
      totalCredit: s.totalCredit.toFixed(2),
      closingBalance: s.closingBalance.toFixed(2),
    };
  }

  async addPayment(supplierId: string, data: SupplierPaymentCreate) {
    await this.supplier(supplierId);
    return this.prisma.supplierPayment.create({
      data: {
        supplierId,
        date: dayToDate(data.date),
        amount: data.amount,
        method: data.method,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  async removePayment(supplierId: string, paymentId: string): Promise<{ id: string }> {
    await this.supplier(supplierId);
    const row = await this.prisma.supplierPayment.findFirst({
      where: { id: paymentId, supplierId },
    });
    if (!row) throw AppException.notFound('Payment not found.');
    await this.prisma.supplierPayment.delete({ where: { id: paymentId } });
    return { id: paymentId };
  }
}
