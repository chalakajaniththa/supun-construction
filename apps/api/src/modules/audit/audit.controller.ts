import { Controller, Get, Query } from '@nestjs/common';
import { type AuditQuery, type Paginated, auditQuerySchema } from '@sc/shared';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import type { AuditLog } from '../../generated/prisma/client.js';

@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /audit?entity=&entityId=&page=&pageSize= — newest first. */
  @Get()
  async list(
    @Query(new ZodValidationPipe(auditQuerySchema)) q: AuditQuery,
  ): Promise<Paginated<AuditLog>> {
    const where = {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(q) }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, q);
  }
}
