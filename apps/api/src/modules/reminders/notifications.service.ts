import { Injectable } from '@nestjs/common';
import {
  type NotificationCountDto,
  type NotificationDto,
  type NotificationListQuery,
  type Paginated,
  toDay,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Notification, Prisma } from '../../generated/prisma/client.js';

export function toNotificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type as NotificationDto['type'],
    severity: n.severity,
    titleKey: n.titleKey as NotificationDto['titleKey'],
    params: (n.params ?? {}) as NotificationDto['params'],
    entityType: n.entityType as NotificationDto['entityType'],
    entityId: n.entityId,
    dueDate: n.dueDate ? toDay(n.dueDate) : null,
    readAt: n.readAt?.toISOString() ?? null,
    resolvedAt: n.resolvedAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** Unresolved first, then DANGER → WARNING → INFO, then the soonest due date. */
export const NOTIFICATION_ORDER: Prisma.NotificationOrderByWithRelationInput[] = [
  { resolvedAt: { sort: 'desc', nulls: 'first' } },
  { severity: 'desc' },
  { dueDate: { sort: 'asc', nulls: 'last' } },
  { createdAt: 'desc' },
];

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: NotificationListQuery): Promise<Paginated<NotificationDto>> {
    const where: Prisma.NotificationWhereInput = {
      ...(q.status === 'open' ? { resolvedAt: null } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.severity ? { severity: q.severity } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: NOTIFICATION_ORDER, ...toSkipTake(q) }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(rows.map(toNotificationDto), total, q);
  }

  /** The most urgent open notifications (dashboard / e-mail). */
  async topOpen(take: number): Promise<{ items: NotificationDto[]; total: number }> {
    const where = { resolvedAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: NOTIFICATION_ORDER, take }),
      this.prisma.notification.count({ where }),
    ]);
    return { items: rows.map(toNotificationDto), total };
  }

  async count(): Promise<NotificationCountDto> {
    const [unread, open] = await Promise.all([
      this.prisma.notification.count({ where: { resolvedAt: null, readAt: null } }),
      this.prisma.notification.count({ where: { resolvedAt: null } }),
    ]);
    return { unread, open };
  }

  async markRead(id: string): Promise<NotificationDto> {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw AppException.notFound('Notification not found.');
    if (n.readAt) return toNotificationDto(n);
    return toNotificationDto(
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } }),
    );
  }

  async markAllRead(): Promise<{ count: number }> {
    const r = await this.prisma.notification.updateMany({
      where: { readAt: null, resolvedAt: null },
      data: { readAt: new Date() },
    });
    return { count: r.count };
  }
}
