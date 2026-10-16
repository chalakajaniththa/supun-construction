import { Injectable } from '@nestjs/common';
import type { BackupRunDto, BackupRunsQuery, BackupStatusDto, Paginated } from '@sc/shared';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { BackupRun } from '../../generated/prisma/client.js';
import { backupHealth, isRunning } from './calc/backup-health.js';

const RECENT = 5;

export function toBackupRunDto(r: BackupRun): BackupRunDto {
  return {
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    status: r.status,
    trigger: r.trigger,
    sizeBytes: r.sizeBytes === null ? null : r.sizeBytes.toString(),
    destination: r.destination,
    message: r.message,
  };
}

/**
 * Backups are made by the `backup` container (docker/backup): it writes `backup_runs` and a
 * heartbeat in `backup_agent`, and polls `backup_requests` for "Backup now".
 */
@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  async status(now = new Date()): Promise<BackupStatusDto> {
    const [recent, lastSuccess, agent, pendingRequests] = await Promise.all([
      this.prisma.backupRun.findMany({ orderBy: { startedAt: 'desc' }, take: RECENT }),
      this.prisma.backupRun.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.backupAgent.findUnique({ where: { id: 1 } }),
      this.prisma.backupRequest.count({ where: { pickedAt: null } }),
    ]);
    const recentDto = recent.map(toBackupRunDto);
    const lastSuccessDto = lastSuccess ? toBackupRunDto(lastSuccess) : null;
    const h = backupHealth({
      recent: recentDto,
      lastSuccess: lastSuccessDto,
      agent: agent
        ? { lastSeenAt: agent.lastSeenAt.toISOString(), gdriveConfigured: agent.gdriveConfigured }
        : null,
      pendingRequests,
      now,
    });
    return {
      state: h.state,
      reason: h.reason,
      lastRun: recentDto[0] ?? null,
      lastSuccess: lastSuccessDto,
      hoursSinceSuccess: h.hoursSinceSuccess,
      running: h.running,
      pending: h.pending,
      agentOnline: h.agentOnline,
      agentSeenAt: agent?.lastSeenAt.toISOString() ?? null,
      gdriveConfigured: agent ? agent.gdriveConfigured : null,
      schedule: agent?.schedule ?? null,
    };
  }

  async runs(q: BackupRunsQuery): Promise<Paginated<BackupRunDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.backupRun.findMany({ orderBy: { startedAt: 'desc' }, ...toSkipTake(q) }),
      this.prisma.backupRun.count(),
    ]);
    return paginated(rows.map(toBackupRunDto), total, q);
  }

  /**
   * "Backup now": queues a request for the container. Not again while one is waiting or a backup
   * is already running (`queued: false`, the existing request / null is returned).
   */
  async request(now = new Date()): Promise<{ requestId: string | null; queued: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('backup_requests'))`;
      const waiting = await tx.backupRequest.findFirst({
        where: { pickedAt: null },
        orderBy: { requestedAt: 'asc' },
      });
      if (waiting) return { requestId: waiting.id, queued: false };
      const running = await tx.backupRun.findFirst({
        where: { status: 'RUNNING' },
        orderBy: { startedAt: 'desc' },
      });
      if (running && isRunning(toBackupRunDto(running), now)) {
        return { requestId: null, queued: false };
      }
      const created = await tx.backupRequest.create({ data: {} });
      return { requestId: created.id, queued: true };
    });
  }
}
