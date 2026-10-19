import { describe, expect, it } from 'vitest';
import { truncateStatement } from './admin.service.js';

describe('truncateStatement', () => {
  it('wipes business tables and keeps login, settings, audit and backups', () => {
    const sql = truncateStatement([
      'Project',
      'User',
      'Setting',
      'AuditLog',
      'Attendance',
      'backup_runs',
      'backup_requests',
      'backup_agent',
      'gdrive_link',
      '_prisma_migrations',
    ]);
    expect(sql).toBe(
      'TRUNCATE TABLE "public"."Attendance", "public"."Project" RESTART IDENTITY CASCADE',
    );
  });

  it('returns null when there is nothing to wipe', () => {
    expect(truncateStatement(['User', 'Setting'])).toBeNull();
  });
});
