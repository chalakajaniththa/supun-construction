import { Injectable } from '@nestjs/common';
import type { MaterialCreate, MaterialListQuery, MaterialUpdate, Paginated } from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly, searchWhere } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Material, Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: MaterialListQuery): Promise<Paginated<Material>> {
    const where: Prisma.MaterialWhereInput = {
      deletedAt: null,
      ...(q.category ? { category: q.category } : {}),
      ...searchWhere(q.search, ['name', 'nameSinhala', 'unit'] as const),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        ...toSkipTake(q),
      }),
      this.prisma.material.count({ where }),
    ]);
    return paginated(items, total, q);
  }

  async get(id: string): Promise<Material> {
    const row = await this.prisma.material.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw AppException.notFound('Material not found.');
    return row;
  }

  create(data: MaterialCreate): Promise<Material> {
    return this.prisma.material.create({ data });
  }

  async update(id: string, data: MaterialUpdate): Promise<Material> {
    await this.get(id);
    return this.prisma.material.update({ where: { id }, data: definedOnly(data) });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.get(id);
    await this.prisma.material.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }
}
