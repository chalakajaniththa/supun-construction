import { createHash } from 'node:crypto';
import { buffer } from 'node:stream/consumers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageService } from '../src/common/storage/storage.service.js';
import { seedSampleData } from '../src/seed/sample-data.js';
import { type TestContext, createTestApp, loginCookie, resetDb } from './helpers.js';

const TODAY = '2026-10-15';

describe('sample data seed', () => {
  let ctx: TestContext;
  let cookie: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    cookie = await loginCookie(ctx);
    const loaded = await seedSampleData(ctx.prisma, {
      fresh: true,
      storage: ctx.app.get(StorageService),
      today: TODAY,
    });
    expect(loaded).toBe(true);
  }, 120_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('loads the overview §10 master data', async () => {
    const p = ctx.prisma;
    expect(await p.client.count()).toBe(5);
    expect(await p.project.count()).toBe(6);
    expect(await p.worker.count({ where: { type: 'DAILY' } })).toBe(18);
    expect(await p.worker.count({ where: { type: 'PERMANENT' } })).toBe(7);
    expect(await p.asset.count()).toBe(12);
    expect(await p.supplier.count()).toBeGreaterThanOrEqual(8);
    expect(await p.material.count()).toBeGreaterThanOrEqual(20);
    const statuses = (await p.project.findMany({ select: { status: true } }))
      .map((r) => r.status)
      .sort();
    expect(statuses).toEqual(['COMPLETED', 'ONGOING', 'ONGOING', 'ONGOING', 'ON_HOLD', 'PLANNING']);
    expect(await p.projectBudgetLine.count({ where: { project: { status: 'PLANNING' } } })).toBe(3);
    const company = await p.setting.findUniqueOrThrow({ where: { key: 'company' } });
    expect((company.value as { name: string }).name).toBe('Supun Construction (Pvt) Ltd');
  });

  it('gives some workers a raise from the first of last month', async () => {
    const raised = await ctx.prisma.workerRate.count({
      where: { effectiveFrom: new Date('2026-09-01T00:00:00Z') },
    });
    expect(raised).toBeGreaterThanOrEqual(5);
    const res = await ctx.http().get('/workers?search=Sunil').set('Cookie', cookie).expect(200);
    expect(res.body.items[0].currentRate.dailyRate).toBe('4500.00');
  });

  it('project codes follow PRJ-<start year>-NNN', async () => {
    const codes = (
      await ctx.prisma.project.findMany({ select: { code: true }, orderBy: { code: 'asc' } })
    ).map((p) => p.code);
    expect(codes).toEqual([
      'PRJ-2025-001',
      'PRJ-2026-001',
      'PRJ-2026-002',
      'PRJ-2026-003',
      'PRJ-2026-004',
      'PRJ-2026-005',
    ]);
    // the API continues the sequence
    const client = await ctx.prisma.client.findFirstOrThrow();
    const res = await ctx
      .http()
      .post('/projects')
      .set('Cookie', cookie)
      .send({
        name: 'New',
        type: 'OTHER',
        source: 'PRIVATE',
        clientId: client.id,
        startDate: '2026-11-01',
        plannedEndDate: '2026-12-01',
      })
      .expect(201);
    expect(res.body.code).toBe('PRJ-2026-006');
  });

  it('spreads vehicle document expiries (expired, ≤7 days, ≤30 days, fine)', async () => {
    const res = await ctx
      .http()
      .get('/documents?ownerType=ASSET&pageSize=100')
      .set('Cookie', cookie)
      .expect(200);
    const days = res.body.items
      .map((d: { currentVersion: { expiryDate: string | null } }) => d.currentVersion.expiryDate)
      .filter(Boolean)
      .map((e: string) => (Date.parse(e) - Date.parse(`${TODAY}T00:00:00Z`)) / 86_400_000);
    expect(days.filter((d: number) => d < 0).length).toBeGreaterThanOrEqual(2);
    expect(days.filter((d: number) => d >= 0 && d <= 7).length).toBeGreaterThanOrEqual(2);
    expect(days.filter((d: number) => d > 7 && d <= 30).length).toBeGreaterThanOrEqual(2);
    expect(days.filter((d: number) => d > 30).length).toBeGreaterThan(days.length / 2);
  });

  it('has a 3-version document, company CIDA registration and worker NIC copies', async () => {
    const three = await ctx.prisma.document.findMany({
      where: { versions: { some: { versionNo: 3 } } },
    });
    expect(three.length).toBeGreaterThanOrEqual(1);
    const cida = await ctx
      .http()
      .get('/documents?ownerType=COMPANY&category=CIDA_REGISTRATION')
      .set('Cookie', cookie);
    expect(cida.body.total).toBe(1);
    expect(cida.body.items[0].versionCount).toBe(2);
    const nic = await ctx.http().get('/documents?category=NIC_COPY').set('Cookie', cookie);
    expect(nic.body.total).toBeGreaterThanOrEqual(3);
    expect(nic.body.items[0].currentVersion.mimeType).toBe('image/png');
    expect(
      await ctx.prisma.document.count({ where: { ownerType: 'PROJECT' } }),
    ).toBeGreaterThanOrEqual(6);
  });

  it('stores every file in S3 with the recorded sha256', async () => {
    const storage = ctx.app.get(StorageService);
    const versions = await ctx.prisma.documentVersion.findMany({ take: 5 });
    for (const v of versions) {
      const { stream } = await storage.getObjectStream(v.storageKey);
      const data = await buffer(stream);
      expect(createHash('sha256').update(data).digest('hex')).toBe(v.sha256);
      expect(data.length).toBe(v.sizeBytes);
    }
  });

  it('does nothing when projects already exist', async () => {
    expect(await seedSampleData(ctx.prisma, { fresh: false, today: TODAY })).toBe(false);
    expect(await ctx.prisma.client.count()).toBe(5);
  });
});
