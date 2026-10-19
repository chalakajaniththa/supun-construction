import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DATA_MODE_SETTING_KEY, type ResetDataInput, type ResetMode } from '@sc/shared';
import * as argon2 from 'argon2';
import { AppException } from '../../common/errors/app-exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { seedSampleData } from '../../seed/sample-data.js';
import { ReminderScanner } from '../reminders/reminder-scanner.service.js';

export interface ResetResult {
  ok: true;
  mode: ResetMode;
  deletedFiles: number;
}

/** Tables that survive a reset: the login, settings, the audit trail and backups. */
export const KEPT_TABLES = [
  '_prisma_migrations',
  'User',
  'Setting',
  'AuditLog',
  'backup_runs',
  'backup_requests',
  'backup_agent',
  'gdrive_link',
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
   * Settings → "Reset data": deletes every project, worker, machine, record and document.
   * SAMPLE loads the sample data again; EMPTY leaves the system empty for real use and remembers
   * that, so the next start does not load the sample data again. The login, settings, the audit
   * log and the backups (history, Google Drive connection and the backups themselves) stay.
   * The owner's login password is checked first.
   */
  async resetData(userId: string, input: ResetDataInput): Promise<ResetResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const ok = user
      ? await argon2.verify(user.passwordHash, input.password).catch(() => false)
      : false;
    if (!ok) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WRONG_PASSWORD',
        'The password is not correct.',
      );
    }
    return this.reset(input.mode);
  }

  private async reset(mode: ResetMode): Promise<ResetResult> {
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

      await this.prisma.setting.upsert({
        where: { key: DATA_MODE_SETTING_KEY },
        create: { key: DATA_MODE_SETTING_KEY, value: { mode, at: new Date().toISOString() } },
        update: { value: { mode, at: new Date().toISOString() } },
      });
      if (mode === 'SAMPLE') {
        await seedSampleData(this.prisma, { fresh: false, storage: this.storage });
      }

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
      this.logger.log(`Data reset to ${mode} (${deletedFiles} old files removed)`);
      return { ok: true, mode, deletedFiles };
    } finally {
      this.resetting = false;
    }
  }
}
