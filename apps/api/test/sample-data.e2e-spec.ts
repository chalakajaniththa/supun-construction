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

  it('has ~60 days of daily operations ending today (Step 3)', async () => {
    const p = ctx.prisma;
    const get = (path: string) => ctx.http().get(path).set('Cookie', cookie).expect(200);
    // attendance up to yesterday, none today; absences, half days and OT exist
    expect(await p.attendance.count()).toBeGreaterThan(800);
    expect(await p.attendance.count({ where: { date: new Date(`${TODAY}T00:00:00Z`) } })).toBe(0);
    for (const status of ['ABSENT', 'HALF_DAY', 'LEAVE'] as const) {
      expect(await p.attendance.count({ where: { status } })).toBeGreaterThan(5);
    }
    expect(await p.attendance.count({ where: { otHours: { gt: 0 } } })).toBeGreaterThan(50);
    // allocations for today and next week (planned)
    const week = await get('/allocations?kind=worker&from=2026-10-15&to=2026-10-21');
    expect(week.body.length).toBeGreaterThan(80);
    // one machine moves between two sites on the same day
    const jcb2 = await p.asset.findFirstOrThrow({ where: { code: 'AST-002' } });
    const split = await get(
      `/allocations?kind=asset&assetId=${jcb2.id}&from=2026-10-14&to=2026-10-14`,
    );
    expect(new Set(split.body.map((a: { projectId: string }) => a.projectId)).size).toBe(2);
    // today's Daily Entry is prefilled from the plan
    const road = await p.project.findFirstOrThrow({ where: { type: 'ROAD' } });
    const daily = await get(`/daily-entry?date=${TODAY}&projectId=${road.id}`);
    expect(daily.body.workers.length).toBeGreaterThanOrEqual(8);
    expect(daily.body.usage.length).toBeGreaterThanOrEqual(2);

    // usage logs run up to the current meter
    const jcb1 = await p.asset.findFirstOrThrow({ where: { code: 'AST-001' } });
    const last = await p.assetUsageLog.findFirstOrThrow({
      where: { assetId: jcb1.id },
      orderBy: { date: 'desc' },
    });
    expect(last.endMeter?.toString()).toBe(jcb1.currentMeter.toString());
    expect(await p.assetUsageLog.count()).toBeGreaterThan(300);
    // service states vary
    const states = new Set<string>();
    for (const a of await p.asset.findMany({ select: { id: true } })) {
      states.add((await get(`/assets/${a.id}/service-status`)).body.state);
    }
    expect([...states].sort()).toEqual(['DUE_SOON', 'NOT_TRACKED', 'OK', 'OVERDUE']);

    const expenses = await p.expense.count();
    expect(expenses).toBeGreaterThan(120);
    expect(expenses).toBeLessThan(220);
    expect(await p.expense.count({ where: { receiptDocumentId: { not: null } } })).toBeGreaterThan(
      3,
    );
    // 25 in the 60-day history + 14 earlier (step 4: costs before the history window)
    expect(await p.purchase.count()).toBe(39);
    expect(await p.materialIssue.count()).toBeGreaterThanOrEqual(15);
    const stock = await get('/store/stock');
    for (const row of stock.body.items) expect(Number(row.stock)).toBeGreaterThanOrEqual(0);
    expect(Number(stock.body.totalValue)).toBeGreaterThan(0);
    const balances = (await get('/suppliers/balances')).body as { balance: string }[];
    for (const b of balances) expect(Number(b.balance)).toBeGreaterThanOrEqual(0);
    expect(balances.filter((b) => Number(b.balance) > 0).length).toBeGreaterThanOrEqual(4);
    // 8 advances; last month's payroll recovered one of them in full
    const advances = await get('/advances?status=OPEN');
    expect(advances.body.total).toBe(7);
    expect(await p.maintenanceRecord.count()).toBeGreaterThanOrEqual(10);
  });

  it('step 4: last month finalized, BOQs, bills, bonds and a project story', async () => {
    const p = ctx.prisma;
    const get = (path: string) => ctx.http().get(path).set('Cookie', cookie);
    const runs = (await get('/payroll/runs')).body as {
      year: number;
      month: number;
      status: string;
    }[];
    expect(runs.map((r) => [r.year, r.month, r.status])).toEqual([[2026, 9, 'FINALIZED']]);
    expect(await p.advanceRecovery.count()).toBeGreaterThan(0);
    // September attendance is locked, August's is not
    const inMonth = (from: string, to: string) => ({ gte: new Date(from), lte: new Date(to) });
    expect(
      await p.attendance.count({
        where: { payrollRunId: null, date: inMonth('2026-09-01', '2026-09-30') },
      }),
    ).toBe(0);
    expect(
      await p.attendance.count({
        where: { payrollRunId: null, date: inMonth('2026-08-01', '2026-08-31') },
      }),
    ).toBeGreaterThan(0);

    const project = async (name: string) =>
      p.project.findFirstOrThrow({ where: { name: { contains: name } } });
    const road = await project('Rural road');
    const school = await project('classroom');
    const culvert = await project('Box culvert');
    const drain = await project('Drain');
    const house = await project('house');
    expect(await p.boqItem.count({ where: { projectId: road.id } })).toBeGreaterThanOrEqual(25);
    expect(await p.boqItem.count({ where: { projectId: school.id } })).toBeGreaterThanOrEqual(30);
    expect(await p.variation.count({ where: { status: 'APPROVED' } })).toBe(1);
    expect(await p.extensionOfTime.count()).toBe(1);

    const bills = async (id: string) =>
      ((await get(`/projects/${id}/certificates`)).body as { code: string; status: string }[]).map(
        (c) => [c.code.slice(-2), c.status],
      );
    expect(await bills(road.id)).toEqual([
      ['01', 'PAID'],
      ['02', 'CERTIFIED'],
    ]);
    expect(await bills(school.id)).toEqual([['01', 'SUBMITTED']]);
    expect((await bills(culvert.id)).every(([, s]) => s === 'PAID')).toBe(true);

    const roadMoney = (await get(`/projects/${road.id}/finance-summary`)).body;
    expect(Number(roadMoney.receivable)).toBeGreaterThan(0);
    expect(Number(roadMoney.advanceRecovered)).toBeGreaterThan(0);
    expect(Number(roadMoney.advanceBalance)).toBeGreaterThan(0);
    const culvertMoney = (await get(`/projects/${culvert.id}/finance-summary`)).body;
    expect(culvertMoney).toMatchObject({ receivable: '0.00', retentionHeld: '222500.00' });

    const bonds = (await get('/bonds?expiringWithin=30')).body as { referenceNo: string }[];
    expect(bonds.map((b) => b.referenceNo)).toEqual(['BOC/PB/2026/0418']);
    expect(await p.bond.count({ where: { status: 'RELEASED' } })).toBe(1);

    const health = (await get('/projects/health')).body as { projectId: string; flags: string[] }[];
    const flags = (id: string) => health.find((h) => h.projectId === id)!.flags;
    expect(flags(road.id)).toEqual([]);
    expect(flags(house.id)).toEqual([]);
    expect(flags(school.id)).toEqual(['BEHIND_SCHEDULE']);
    expect(flags(drain.id)).toContain('OVER_BUDGET');
  });

  it('does nothing when projects already exist', async () => {
    expect(await seedSampleData(ctx.prisma, { fresh: false, today: TODAY })).toBe(false);
    expect(await ctx.prisma.client.count()).toBe(5);
  });
});
