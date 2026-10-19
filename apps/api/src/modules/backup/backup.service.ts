import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BACKUP_AGENT_OFFLINE_MINUTES,
  type BackupRunDto,
  type BackupRunsQuery,
  type BackupStatusDto,
  GDRIVE_LINK_ACTIONS,
  GDRIVE_LINK_STATES,
  GDRIVE_LINK_TIMEOUT_MINUTES,
  type GdriveLinkAction,
  type GdriveLinkDto,
  type GdriveLinkState,
  type Paginated,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { BackupAgent, BackupRun, GdriveLink } from '../../generated/prisma/client.js';
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

const agentOnline = (agent: BackupAgent | null, now: Date) =>
  agent !== null &&
  now.getTime() - agent.lastSeenAt.getTime() < BACKUP_AGENT_OFFLINE_MINUTES * 60_000;

/** The Google Drive sign-in as the app shows it (pure, unit-tested). */
export function toGdriveLinkDto(
  link: Pick<GdriveLink, 'action' | 'state' | 'authUrl' | 'message' | 'updatedAt'> | null,
  agent: BackupAgent | null,
  now: Date,
): GdriveLinkDto {
  const online = agentOnline(agent, now);
  let state = (GDRIVE_LINK_STATES as readonly string[]).includes(link?.state ?? '')
    ? (link!.state as GdriveLinkState)
    : 'IDLE';
  const busy = state === 'STARTING' || state === 'WAITING' || state === 'TESTING';
  // A sign-in the container can no longer finish (it stopped, or nobody came back to it).
  const stale =
    busy &&
    (!online ||
      now.getTime() - link!.updatedAt.getTime() > (GDRIVE_LINK_TIMEOUT_MINUTES + 1) * 60_000);
  if (stale) state = 'IDLE';
  const action = (GDRIVE_LINK_ACTIONS as readonly string[]).includes(link?.action ?? '')
    ? (link!.action as GdriveLinkAction)
    : null;
  return {
    state,
    pendingAction: action,
    authUrl: state === 'WAITING' ? (link?.authUrl ?? null) : null,
    message: state === 'FAILED' ? (link?.message ?? null) : null,
    configured: agent ? agent.gdriveConfigured : null,
    agentOnline: online,
    updatedAt: (link?.updatedAt ?? now).toISOString(),
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

  async gdrive(now = new Date()): Promise<GdriveLinkDto> {
    const [link, agent] = await Promise.all([
      this.prisma.gdriveLink.findUnique({ where: { id: 1 } }),
      this.prisma.backupAgent.findUnique({ where: { id: 1 } }),
    ]);
    return toGdriveLinkDto(link, agent, now);
  }

  /**
   * Connect / cancel / disconnect Google Drive: queued for the backup container, which picks it
   * up within a few seconds (it must be running).
   */
  async gdriveAction(action: GdriveLinkAction, now = new Date()): Promise<GdriveLinkDto> {
    const agent = await this.prisma.backupAgent.findUnique({ where: { id: 1 } });
    if (action !== 'CANCEL' && !agentOnline(agent, now)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'BACKUP_SERVICE_OFFLINE',
        'The backup service is not running.',
      );
    }
    const data = {
      action,
      requestedAt: now,
      ...(action === 'CONNECT' ? { state: 'STARTING', authUrl: null, message: null } : {}),
    };
    await this.prisma.gdriveLink.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    return this.gdrive(now);
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
