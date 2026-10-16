import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app-exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { seedSampleData } from '../../seed/sample-data.js';
import { ReminderScanner } from '../reminders/reminder-scanner.service.js';

/** Tables that survive "Reset sample data": the login, settings, the audit trail and backups. */
export const KEPT_TABLES = [
  '_prisma_migrations',
  'User',
  'Setting',
  'AuditLog',
  'backup_runs',
  'backup_requests',
  'backup_agent',
] as const;

/** The TRUNCATE statement for every business table (pure, unit-tested). */
export function truncateStatement(tables: readonly string[]): string | null {
  const kept = new Set<string>(KEPT_TABLES);
  const wiped = tables.filter((t) => !kept.has(t)).sort();
  if (!wiped.length) return null;
  return `TRUNCATE TABLE ${wiped.map((t) => `"public"."${t.replaceAll('"', '""')}"`).join(', ')} RESTART IDENTITY CASCADE`;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private resetting = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly reminders: ReminderScanner,
  ) {}

  /**
   * Settings → "Reset sample data": deletes every project, worker, machine, record and document,
   * then loads the sample data again. Login, settings, the audit log and backup history stay.
   */
  async resetSampleData(): Promise<{ ok: true; deletedFiles: number }> {
    if (this.resetting) {
      throw new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'A reset is already running');
    }
    this.resetting = true;
    try {
      const oldKeys = (
        await this.prisma.documentVersion.findMany({ select: { storageKey: true } })
      ).map((v) => v.storageKey);
      const tables = await this.prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
      const sql = truncateStatement(tables.map((t) => t.tablename));
      if (sql) await this.prisma.$executeRawUnsafe(sql);

      // The company logo pointed at a document that no longer exists.
      const company = await this.prisma.setting.findUnique({ where: { key: 'company' } });
      const value = (company?.value ?? {}) as Record<string, unknown>;
      if (company && value.logoDocId) {
        await this.prisma.setting.update({
          where: { key: 'company' },
          data: { value: { ...value, logoDocId: null } },
        });
      }

      await seedSampleData(this.prisma, { fresh: false, storage: this.storage });

      // Files of the old documents (new sample files have new keys).
      let deletedFiles = 0;
      for (const key of oldKeys) {
        try {
          await this.storage.deleteObject(key);
          deletedFiles++;
        } catch (err) {
          this.logger.warn(`Could not delete ${key}: ${String(err)}`);
        }
      }
      await this.reminders.run();
      this.logger.log(`Sample data reset (${deletedFiles} old files removed)`);
      return { ok: true, deletedFiles };
    } finally {
      this.resetting = false;
    }
  }
}
