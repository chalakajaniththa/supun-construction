import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NOTIFICATION_TYPES, dayToDate, toDay } from '@sc/shared';
import { TIME_ZONE, addDays, todayInColombo } from '../../common/dates/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DocumentsService } from '../documents/documents.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  type ReminderCandidate,
  bondReminders,
  deadlineReminders,
  documentReminders,
  reconcile,
  serviceReminders,
} from './calc/rules.js';
import { DigestService } from './digest.service.js';

export interface ScanResult {
  today: string;
  created: number;
  updated: number;
  resolved: number;
  open: number;
}

/**
 * Turns the reminder rules into notifications: daily at 06:00 Asia/Colombo, once on start, after
 * changes that can affect a reminder (see ReminderTriggerInterceptor) and on POST /reminders/run.
 * Runs are serialised, so two scans never race on the same dedupe key.
 */
@Injectable()
export class ReminderScanner implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReminderScanner.name);
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly documents: DocumentsService,
    private readonly digest: DigestService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.get('REMINDERS_ON_START', { infer: true })) return;
    this.run().then(
      (r) => this.logger.log(`Reminder scan on start: ${r.open} open (${r.created} new)`),
      (err: unknown) => this.logger.error(`Reminder scan on start failed: ${String(err)}`),
    );
  }

  @Cron('0 6 * * *', { name: 'daily-reminders', timeZone: TIME_ZONE })
  async daily() {
    try {
      const r = await this.run();
      this.logger.log(
        `Daily reminder scan: ${r.open} open (${r.created} new, ${r.resolved} cleared)`,
      );
      await this.digest.sendDaily();
    } catch (err) {
      this.logger.error(`Daily reminder scan failed: ${String(err)}`);
    }
  }

  /** One scan (queued behind any scan already running). */
  run(today: string = todayInColombo()): Promise<ScanResult> {
    const next = this.queue.then(() => this.scan(today));
    this.queue = next.catch(() => undefined);
    return next;
  }

  async candidates(today: string): Promise<ReminderCandidate[]> {
    const { daysBefore } = await this.settings.get('reminders');
    const horizon = addDays(today, Math.max(0, ...daysBefore));
    const [docs, bonds, assets, projects] = await Promise.all([
      this.documents.expiringUntil(horizon),
      this.prisma.bond.findMany({
        where: {
          status: 'ACTIVE',
          project: { deletedAt: null },
          expiryDate: { lte: dayToDate(horizon) },
        },
        include: { project: { select: { code: true, name: true } } },
      }),
      this.prisma.asset.findMany({
        where: {
          deletedAt: null,
          status: { not: 'DISPOSED' },
          meterType: { not: 'NONE' },
          serviceIntervalMeter: { not: null },
        },
      }),
      this.prisma.project.findMany({ where: { deletedAt: null, status: 'ONGOING' } }),
    ]);
    return [
      ...documentReminders(
        docs
          // a bond's scanned copy is reminded through the bond itself
          .filter((d) => d.currentVersion?.expiryDate && d.category !== 'BOND_COPY')
          .map((d) => ({
            documentId: d.id,
            versionId: d.currentVersion!.id,
            title: d.title,
            category: d.category,
            ownerType: d.ownerType,
            ownerId: d.ownerId,
            ownerName: d.ownerName,
            ownerCode: d.ownerCode,
            expiryDate: toDay(d.currentVersion!.expiryDate),
          })),
        today,
        daysBefore,
      ),
      ...bondReminders(
        bonds.map((b) => ({
          bondId: b.id,
          type: b.type,
          referenceNo: b.referenceNo,
          bank: b.bank,
          projectId: b.projectId,
          projectCode: b.project.code,
          projectName: b.project.name,
          expiryDate: toDay(b.expiryDate),
        })),
        today,
        daysBefore,
      ),
      ...serviceReminders(
        assets.map((a) => ({
          assetId: a.id,
          code: a.code,
          name: a.name,
          meterType: a.meterType,
          currentMeter: a.currentMeter,
          lastServiceMeter: a.lastServiceMeter,
          serviceIntervalMeter: a.serviceIntervalMeter,
        })),
      ),
      ...deadlineReminders(
        projects.map((p) => ({
          projectId: p.id,
          code: p.code,
          name: p.name,
          status: p.status,
          currentEndDate: toDay(p.revisedEndDate ?? p.plannedEndDate),
        })),
        today,
      ),
    ];
  }

  private async scan(today: string): Promise<ScanResult> {
    const candidates = await this.candidates(today);
    const keys = candidates.map((c) => c.dedupeKey);
    const existing = await this.prisma.notification.findMany({
      where: {
        type: { in: [...NOTIFICATION_TYPES] },
        OR: [{ resolvedAt: null }, { dedupeKey: { in: keys } }],
      },
      select: { id: true, dedupeKey: true, resolvedAt: true },
    });
    const plan = reconcile(existing, candidates);
    const data = (c: ReminderCandidate) => ({
      type: c.type,
      severity: c.severity,
      titleKey: c.titleKey,
      params: c.params as Prisma.InputJsonObject,
      entityType: c.entityType,
      entityId: c.entityId,
      dueDate: c.dueDate ? dayToDate(c.dueDate) : null,
    });
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (plan.create.length) {
        await tx.notification.createMany({
          data: plan.create.map((c) => ({ ...data(c), dedupeKey: c.dedupeKey })),
          skipDuplicates: true,
        });
      }
      for (const u of plan.update) {
        await tx.notification.update({
          where: { id: u.id },
          data: { ...data(u.candidate), ...(u.reopen ? { resolvedAt: null, readAt: null } : {}) },
        });
      }
      if (plan.resolve.length) {
        await tx.notification.updateMany({
          where: { id: { in: plan.resolve } },
          data: { resolvedAt: now },
        });
      }
    });
    const open = await this.prisma.notification.count({ where: { resolvedAt: null } });
    return {
      today,
      created: plan.create.length,
      updated: plan.update.length,
      resolved: plan.resolve.length,
      open,
    };
  }
}
