import { Injectable } from '@nestjs/common';
import type { Paginated, SupplierCreate, SupplierListQuery, SupplierUpdate } from '@sc/shared';
import { nextCode, withCodeRetry } from '../../common/codes/codes.js';
import { AppException } from '../../common/errors/app-exception.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly, searchWhere } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma, Supplier } from '../../generated/prisma/client.js';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: SupplierListQuery): Promise<Paginated<Supplier>> {
    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(q.type ? { type: q.type } : {}),
      ...searchWhere(q.search, ['name', 'code', 'phone', 'address'] as const),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, ...toSkipTake(q) }),
      this.prisma.supplier.count({ where }),
    ]);
    return paginated(items, total, q);
  }

  async get(id: string): Promise<Supplier> {
    const row = await this.prisma.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw AppException.notFound('Supplier not found.');
    return row;
  }

  /** Code SUP-NNN. */
  create(data: SupplierCreate): Promise<Supplier> {
    return withCodeRetry(
      () => nextCode(this.prisma, 'Supplier', 'SUP-', 3),
      (code) => this.prisma.supplier.create({ data: { ...data, code } }),
    );
  }

  async update(id: string, data: SupplierUpdate): Promise<Supplier> {
    await this.get(id);
    return this.prisma.supplier.update({ where: { id }, data: definedOnly(data) });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.get(id);
    await this.prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }
}
