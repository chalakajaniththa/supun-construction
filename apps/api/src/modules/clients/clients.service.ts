import { HttpStatus, Injectable } from '@nestjs/common';
import type { ClientCreate, ClientListQuery, ClientUpdate, Paginated } from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly, searchWhere } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Client, Prisma } from '../../generated/prisma/client.js';

type ClientWithCount = Client & { projectCount: number };

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ClientListQuery): Promise<Paginated<ClientWithCount>> {
    const where: Prisma.ClientWhereInput = {
      deletedAt: null,
      ...(q.type ? { type: q.type } : {}),
      ...searchWhere(q.search, ['name', 'contactPerson', 'phone', 'email'] as const),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { _count: { select: { projects: { where: { deletedAt: null } } } } },
        ...toSkipTake(q),
      }),
      this.prisma.client.count({ where }),
    ]);
    return paginated(
      rows.map(({ _count, ...c }) => ({ ...c, projectCount: _count.projects })),
      total,
      q,
    );
  }

  async get(id: string): Promise<ClientWithCount> {
    const row = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { projects: { where: { deletedAt: null } } } } },
    });
    if (!row) throw AppException.notFound('Client not found.');
    const { _count, ...client } = row;
    return { ...client, projectCount: _count.projects };
  }

  create(data: ClientCreate): Promise<Client> {
    return this.prisma.client.create({ data });
  }

  async update(id: string, data: ClientUpdate): Promise<Client> {
    await this.get(id);
    return this.prisma.client.update({ where: { id }, data: definedOnly(data) });
  }

  /** Soft delete. A client that still has projects cannot be removed. */
  async remove(id: string): Promise<{ id: string }> {
    const client = await this.get(id);
    if (client.projectCount > 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CLIENT_HAS_PROJECTS',
        'This client still has projects.',
        { projectCount: client.projectCount },
      );
    }
    await this.prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }
}
