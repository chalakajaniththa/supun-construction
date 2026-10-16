import type { BackupStatusDto, NotificationDto } from '@sc/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageService } from '../src/common/storage/storage.service.js';
import { seedBackupHistory, seedSampleData } from '../src/seed/sample-data.js';
import { type TestContext, createTestApp, loginCookie, resetDb } from './helpers.js';

const HOUR = 3_600_000;

describe('backup (Step 6)', () => {
  let ctx: TestContext;
  let cookie: string;
  const get = (path: string) => ctx.http().get(path).set('Cookie', cookie);

  /** What the backup container writes (plain SQL, like docker/backup/backup.sh). */
  async function insertRun(over: {
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    hoursAgo: number;
    destination?: 'LOCAL' | 'GDRIVE' | 'BOTH';
  }) {
    const started = new Date(Date.now() - over.hoursAgo * HOUR);
    const finished = over.status === 'RUNNING' ? null : new Date(started.getTime() + 60_000);
    await ctx.prisma.$executeRaw`
      INSERT INTO backup_runs (id, started_at, finished_at, status, "trigger", size_bytes, destination, message)
      VALUES (gen_random_uuid(), ${started}, ${finished}, ${over.status}::"BackupStatus",
              'SCHEDULED'::"BackupTrigger", 1048576, ${over.destination ?? 'LOCAL'}::"BackupDestination", 'test')`;
  }
  async function heartbeat(gdrive = false, minutesAgo = 0) {
    const seen = new Date(Date.now() - minutesAgo * 60_000);
    await ctx.prisma.$executeRaw`
      INSERT INTO backup_agent (id, last_seen_at, gdrive_configured, schedule, version)
      VALUES (1, ${seen}, ${gdrive}, '0 23 * * *', '1')
      ON CONFLICT (id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at,
        gdrive_configured = EXCLUDED.gdrive_configured`;
  }
  const status = async () => (await get('/backup/status').expect(200)).body as BackupStatusDto;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    cookie = await loginCookie(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('reads timestamps written by SQL now() at the right instant (session time zone)', async () => {
    await ctx.prisma.$executeRaw`
      INSERT INTO backup_runs (id, started_at, status, "trigger", destination)
      VALUES (gen_random_uuid(), now(), 'FAILED', 'MANUAL', 'LOCAL')`;
    const row = await ctx.prisma.backupRun.findFirstOrThrow();
    expect(Math.abs(row.startedAt.getTime() - Date.now())).toBeLessThan(60_000);
    // …and Prisma-written instants are stored as the same absolute time.
    const user = await ctx.prisma.user.update({
      where: { username: 'admin' },
      data: { lastLoginAt: new Date() },
    });
    const [{ diff }] = await ctx.prisma.$queryRaw<{ diff: number }[]>`
      SELECT abs(extract(epoch FROM (now() - "lastLoginAt")))::float AS diff
      FROM "User" WHERE id = ${user.id}::uuid`;
    expect(diff).toBeLessThan(60);
    await ctx.prisma.backupRun.deleteMany();
  });

  it('needs a login', async () => {
    await ctx.http().get('/backup/status').expect(401);
    await ctx.http().post('/backup/run').expect(401);
  });

  it('is red with no backups and no backup service', async () => {
    const s = await status();
    expect(s).toMatchObject({
      state: 'DANGER',
      reason: 'NEVER',
      lastRun: null,
      lastSuccess: null,
      agentOnline: false,
      gdriveConfigured: null,
      running: false,
      pending: false,
    });
  });

  it('turns green after a fresh local backup with the service running', async () => {
    await heartbeat(false);
    await insertRun({ status: 'SUCCESS', hoursAgo: 2 });
    const s = await status();
    expect(s).toMatchObject({
      state: 'OK',
      reason: 'OK',
      agentOnline: true,
      gdriveConfigured: false,
      schedule: '0 23 * * *',
    });
    expect(s.lastSuccess?.sizeBytes).toBe('1048576');
    expect(s.hoursSinceSuccess).toBe(1);
  });

  it('is orange when Google Drive is set up but the backup stayed local', async () => {
    await heartbeat(true);
    expect((await status()).reason).toBe('LOCAL_ONLY');
    await insertRun({ status: 'SUCCESS', hoursAgo: 1, destination: 'BOTH' });
    expect((await status()).reason).toBe('OK');
  });

  it('is red after a failed run and shows it on the dashboard', async () => {
    await insertRun({ status: 'FAILED', hoursAgo: 0.5 });
    expect(await status()).toMatchObject({ state: 'DANGER', reason: 'FAILED' });
    const dash = (await get('/dashboard').expect(200)).body as {
      backup: BackupStatusDto;
      attention: NotificationDto[];
    };
    expect(dash.backup.reason).toBe('FAILED');
    expect(dash.attention.find((a) => a.type === 'BACKUP')).toMatchObject({
      id: 'backup:FAILED',
      severity: 'DANGER',
      titleKey: 'backupFailed',
      entityType: 'BACKUP',
    });
  });

  it('"Backup now" queues one request; the container picks it up', async () => {
    const first = await ctx.http().post('/backup/run').set('Cookie', cookie).expect(202);
    expect(first.body.queued).toBe(true);
    const again = await ctx.http().post('/backup/run').set('Cookie', cookie).expect(202);
    expect(again.body).toEqual({ requestId: first.body.requestId, queued: false });
    expect((await status()).pending).toBe(true);
    expect(await ctx.prisma.backupRequest.count()).toBe(1);

    // backup.sh: picks waiting requests and inserts a RUNNING row in one statement.
    await ctx.prisma.$executeRaw`
      WITH picked AS (UPDATE backup_requests SET picked_at = now() WHERE picked_at IS NULL RETURNING id)
      INSERT INTO backup_runs (id, started_at, status, "trigger", destination)
      VALUES (gen_random_uuid(), now(), 'RUNNING', 'MANUAL', 'LOCAL')`;
    const s = await status();
    expect(s).toMatchObject({ pending: false, running: true });
    expect(s.lastRun?.status).toBe('RUNNING');
    expect(s.lastRun?.trigger).toBe('MANUAL');

    // While a run is going, another click does not queue a second backup.
    const during = await ctx.http().post('/backup/run').set('Cookie', cookie).expect(202);
    expect(during.body.queued).toBe(false);
    expect(await ctx.prisma.backupRequest.count({ where: { pickedAt: null } })).toBe(0);

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { entity: 'BackupRequest' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.action).toBe('CREATE');
  });

  it('lists runs newest first, paginated', async () => {
    const res = await get('/backup/runs?page=1&pageSize=2').expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].status).toBe('RUNNING');
    expect(res.body.items[0].startedAt >= res.body.items[1].startedAt).toBe(true);
    await get('/backup/runs?pageSize=1000').expect(400);
  });

  it('seeds a sample history only when there are no runs', async () => {
    expect(await seedBackupHistory(ctx.prisma, '2026-10-16')).toBe(0);
    await ctx.prisma.backupRun.deleteMany();
    expect(await seedBackupHistory(ctx.prisma, '2026-10-16')).toBe(3);
    const statuses = (await ctx.prisma.backupRun.findMany({ orderBy: { startedAt: 'asc' } })).map(
      (r) => r.status,
    );
    expect(statuses).toEqual(['FAILED', 'SUCCESS', 'SUCCESS']);
  });
});

describe('reset sample data (Step 6)', () => {
  let ctx: TestContext;
  let cookie: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    cookie = await loginCookie(ctx);
    await seedSampleData(ctx.prisma, {
      fresh: true,
      storage: ctx.app.get(StorageService),
    });
  }, 180_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('refuses without the typed word', async () => {
    const res = await ctx
      .http()
      .post('/admin/reset-sample-data')
      .set('Cookie', cookie)
      .send({ confirm: 'reset' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details[0]).toMatchObject({ path: 'confirm', message: 'TYPE_RESET' });
  });

  it('wipes changes, reloads the sample data and keeps login, settings, audit and backups', async () => {
    const storage = ctx.app.get(StorageService);
    await ctx.prisma.client.create({ data: { name: 'Owner test client', type: 'PRIVATE' } });
    await ctx.prisma.setting.update({
      where: { key: 'reminders' },
      data: { value: { daysBefore: [45, 10] } },
    });
    await ctx.prisma.backupRun.create({
      data: { status: 'SUCCESS', trigger: 'MANUAL', destination: 'LOCAL' },
    });
    const runsBefore = await ctx.prisma.backupRun.count();
    const oldKey = (await ctx.prisma.documentVersion.findFirstOrThrow()).storageKey;
    const auditBefore = await ctx.prisma.auditLog.count();

    const res = await ctx
      .http()
      .post('/admin/reset-sample-data')
      .set('Cookie', cookie)
      .send({ confirm: 'RESET' })
      .timeout(180_000)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.deletedFiles).toBeGreaterThan(10);

    expect(await ctx.prisma.client.count({ where: { name: 'Owner test client' } })).toBe(0);
    expect(await ctx.prisma.client.count()).toBe(5);
    expect(await ctx.prisma.project.count()).toBe(6);
    expect(await ctx.prisma.documentVersion.count()).toBeGreaterThan(10);
    expect(await storage.headObject(oldKey)).toBeNull();
    const reminders = await ctx.prisma.setting.findUniqueOrThrow({ where: { key: 'reminders' } });
    expect(reminders.value).toEqual({ daysBefore: [45, 10] });
    expect(await ctx.prisma.user.count()).toBe(1);
    expect(await ctx.prisma.backupRun.count()).toBe(runsBefore);
    expect(await ctx.prisma.auditLog.count()).toBeGreaterThan(auditBefore);
    expect(await ctx.prisma.notification.count({ where: { resolvedAt: null } })).toBeGreaterThan(0);
    // Still logged in, and the app works on the new data.
    await ctx.http().get('/dashboard').set('Cookie', cookie).expect(200);
  }, 180_000);
});
