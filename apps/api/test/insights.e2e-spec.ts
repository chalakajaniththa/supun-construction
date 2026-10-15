import ExcelJS from 'exceljs';
import { REPORTS, type NotificationDto } from '@sc/shared';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, todayInColombo } from '../src/common/dates/dates.js';
import { StorageService } from '../src/common/storage/storage.service.js';
import { ReminderScanner } from '../src/modules/reminders/reminder-scanner.service.js';
import { seedSampleData } from '../src/seed/sample-data.js';
import { type TestContext, createTestApp, loginCookie, resetDb } from './helpers.js';

/** Step 5 — reminders, notifications, dashboard and reports against the sample data. */
const TODAY = '2026-10-15';
const LAST_MONTH = '2026-09';

let ctx: TestContext;
let cookie: string;
let scanner: ReminderScanner;
let roadId: string;
let roadBillId: string;

/** supertest parser that collects a binary response body into a Buffer. */
const binary = (res: Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  const stream = res as unknown as NodeJS.ReadableStream;
  stream.on('data', (c: Buffer) => chunks.push(c));
  stream.on('end', () => cb(null, Buffer.concat(chunks)));
};

const get = (path: string) => ctx.http().get(path).set('Cookie', cookie);
const post = (path: string) => ctx.http().post(path).set('Cookie', cookie);

async function openNotifications(): Promise<NotificationDto[]> {
  const res = await get('/notifications?pageSize=100').expect(200);
  return res.body.items;
}

beforeAll(async () => {
  ctx = await createTestApp();
  await resetDb(ctx.prisma);
  cookie = await loginCookie(ctx);
  await seedSampleData(ctx.prisma, {
    fresh: true,
    storage: ctx.app.get(StorageService),
    today: TODAY,
  });
  scanner = ctx.app.get(ReminderScanner);
  const road = await ctx.prisma.project.findFirstOrThrow({ where: { code: 'PRJ-2026-001' } });
  roadId = road.id;
  roadBillId = (
    await ctx.prisma.paymentCertificate.findFirstOrThrow({
      where: { projectId: roadId, number: 2 },
    })
  ).id;
}, 180_000);

afterAll(async () => {
  await ctx.app.close();
});

describe('reminders', () => {
  it('a scan creates the expected reminders from the sample data', async () => {
    const r = await scanner.run(TODAY);
    expect(r.created).toBeGreaterThan(5);
    const items = await openNotifications();
    const types = new Set(items.map((n) => n.type));
    expect(types).toEqual(new Set(['DOCUMENT_EXPIRY', 'BOND_EXPIRY', 'SERVICE_DUE']));

    const docs = items.filter((n) => n.type === 'DOCUMENT_EXPIRY');
    // expired, ≤ 7 days and ≤ 30 days vehicle papers (overview §10)
    expect(docs.some((n) => n.severity === 'DANGER' && n.titleKey === 'documentExpired')).toBe(
      true,
    );
    expect(docs.some((n) => n.severity === 'WARNING')).toBe(true);
    expect(docs.some((n) => n.severity === 'INFO')).toBe(true);
    for (const n of docs) {
      expect(n.dueDate! <= addDays(TODAY, 30)).toBe(true);
      expect(n.params.category).not.toBe('BOND_COPY');
    }
    // the road performance bond expires in 20 days
    const bond = items.find((n) => n.type === 'BOND_EXPIRY')!;
    expect(bond).toMatchObject({ severity: 'INFO', titleKey: 'bondExpires', entityType: 'BOND' });
    expect(bond.params.projectCode).toBe('PRJ-2026-001');
    // roller overdue, JCB 1 / Tipper 1 due soon
    const service = items.filter((n) => n.type === 'SERVICE_DUE');
    expect(service.find((n) => n.params.assetName === 'Vibratory roller')?.severity).toBe('DANGER');
    expect(service.filter((n) => n.severity === 'WARNING').length).toBeGreaterThanOrEqual(2);
  });

  it('is deduplicated: a second scan creates nothing new', async () => {
    const before = await ctx.prisma.notification.count();
    const r = await scanner.run(TODAY);
    expect(r.created).toBe(0);
    expect(r.resolved).toBe(0);
    expect(await ctx.prisma.notification.count()).toBe(before);
  });

  it('lists open items most urgent first, with a count for the bell', async () => {
    const items = await openNotifications();
    const rank = { DANGER: 0, WARNING: 1, INFO: 2 } as const;
    const ranks = items.map((n) => rank[n.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const count = await get('/notifications/count').expect(200);
    expect(count.body).toEqual({ unread: items.length, open: items.length });
  });

  it('read and read-all', async () => {
    const [first] = await openNotifications();
    const r = await post(`/notifications/${first!.id}/read`).expect(200);
    expect(r.body.readAt).not.toBeNull();
    let count = (await get('/notifications/count').expect(200)).body;
    expect(count.unread).toBe(count.open - 1);
    const all = await post('/notifications/read-all').expect(200);
    expect(all.body.count).toBe(count.open - 1);
    count = (await get('/notifications/count').expect(200)).body;
    expect(count.unread).toBe(0);
    await post('/notifications/00000000-0000-4000-8000-000000000000/read').expect(404);
  });

  it('a renewed paper (new version, later expiry) clears its reminder', async () => {
    const expired = (await openNotifications()).find(
      (n) => n.type === 'DOCUMENT_EXPIRY' && n.severity === 'DANGER',
    )!;
    await post(`/documents/${expired.entityId}/versions`)
      .field('issueDate', todayInColombo())
      .field('expiryDate', addDays(todayInColombo(), 365))
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), 'renewed.pdf')
      .expect(201);
    // the change itself re-runs the scan
    const open = await openNotifications();
    expect(open.find((n) => n.id === expired.id)).toBeUndefined();
    const all = (await get('/notifications?status=all&pageSize=100').expect(200)).body
      .items as NotificationDto[];
    expect(all.find((n) => n.id === expired.id)?.resolvedAt).not.toBeNull();
    // resolved items come after the open ones
    expect(all.at(-1)!.resolvedAt).not.toBeNull();
  });

  it('a project ending soon gets a deadline reminder, which goes away when the end date moves', async () => {
    const house = await ctx.prisma.project.findFirstOrThrow({
      where: { code: { startsWith: 'PRJ-' }, status: 'ONGOING', source: 'PRIVATE' },
    });
    const soon = addDays(todayInColombo(), 5);
    await ctx
      .http()
      .patch(`/projects/${house.id}`)
      .set('Cookie', cookie)
      .send({ plannedEndDate: soon })
      .expect(200);
    let deadline = (await openNotifications()).find((n) => n.type === 'PROJECT_DEADLINE');
    expect(deadline).toMatchObject({
      entityId: house.id,
      severity: 'WARNING',
      titleKey: 'deadlineSoon',
      dueDate: soon,
    });
    await ctx
      .http()
      .patch(`/projects/${house.id}`)
      .set('Cookie', cookie)
      .send({ plannedEndDate: addDays(todayInColombo(), 120) })
      .expect(200);
    deadline = (await openNotifications()).find((n) => n.type === 'PROJECT_DEADLINE');
    expect(deadline).toBeUndefined();
  });

  it('POST /reminders/run runs a scan', async () => {
    const r = await post('/reminders/run').expect(200);
    expect(r.body).toMatchObject({ today: todayInColombo() });
    expect(typeof r.body.open).toBe('number');
  });
});

describe('dashboard', () => {
  it('returns KPIs, attention items, active projects and a 6-month series in one fast call', async () => {
    const started = Date.now();
    const res = await get('/dashboard').expect(200);
    const ms = Date.now() - started;
    const d = res.body;
    expect(d.kpis.activeProjects).toBe(3);
    expect(['ATTENDANCE', 'PLAN']).toContain(d.kpis.workersSource);
    expect(Number(d.kpis.moneyToReceive)).toBeGreaterThan(0);
    expect(d.kpis.spentThisMonth).toMatch(/^\d+\.\d{2}$/);
    expect(d.attention.length).toBeLessThanOrEqual(8);
    expect(d.attentionTotal).toBeGreaterThanOrEqual(d.attention.length);
    // health flags of the sample story are on the list (drain over budget)
    expect(
      d.attention.some((a: NotificationDto) => a.type === 'HEALTH' && a.titleKey === 'overBudget'),
    ).toBe(true);
    expect(d.projects).toHaveLength(5);
    expect(d.projects[0]).toHaveProperty('timePct');
    expect(d.series).toHaveLength(6);
    expect(d.series.at(-1).month).toBe(todayInColombo().slice(0, 7));
    expect(ms).toBeLessThan(1500);
  });

  it('money to receive = Σ receivable of every project', async () => {
    const d = (await get('/dashboard').expect(200)).body;
    const projects = await ctx.prisma.project.findMany({ where: { deletedAt: null } });
    let sum = 0n;
    for (const p of projects) {
      const f = (await get(`/projects/${p.id}/finance-summary`).expect(200)).body;
      sum += BigInt(f.receivable.replace('.', ''));
    }
    expect(d.kpis.moneyToReceive.replace('.', '')).toBe(sum.toString());
  });
});

describe('reports', () => {
  const params = (id: string): string => {
    switch (id) {
      case 'project-cost':
        return `projectId=${roadId}`;
      case 'payroll-sheet':
      case 'payslips':
      case 'epf-etf':
      case 'attendance':
      case 'business-summary':
        return `month=${LAST_MONTH}`;
      case 'asset-utilisation':
      case 'expenses':
        return `from=${LAST_MONTH}-01&to=${TODAY}`;
      case 'ipc':
        return `projectId=${roadId}&certificateId=${roadBillId}`;
      case 'expiry':
        return 'days=30';
      default:
        return '';
    }
  };

  /** The first header label each report's Excel file must show. */
  const FIRST_HEADER: Record<string, string> = {
    'project-cost': 'Category',
    'payroll-sheet': 'Code',
    'epf-etf': 'Code',
    attendance: 'Code',
    'asset-utilisation': 'Code',
    expenses: 'Category',
    'supplier-statement': 'Code',
    expiry: 'Expires',
    'business-summary': 'Code',
  };

  for (const def of REPORTS) {
    for (const format of def.formats) {
      it(`${def.code} ${def.id} → ${format}`, async () => {
        const res = await get(`/reports/${def.id}?format=${format}&locale=en&${params(def.id)}`)
          .buffer(true)
          .parse(binary)
          .expect(200);
        const body = res.body as Buffer;
        expect(res.headers['content-disposition']).toMatch(
          new RegExp(
            `attachment; filename="${def.id === 'supplier-statement' ? 'supplier-balances' : def.id === 'ipc' ? 'ipc_IPC' : def.id === 'payslips' ? 'payslips' : def.id}`,
          ),
        );
        if (format === 'pdf') {
          expect(res.headers['content-type']).toBe('application/pdf');
          expect(body.subarray(0, 4).toString()).toBe('%PDF');
          expect(body.length).toBeGreaterThan(5_000);
        } else {
          expect(res.headers['content-type']).toBe(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          );
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(body as unknown as ArrayBuffer);
          const labels: unknown[] = [];
          for (const ws of wb.worksheets) ws.eachRow((row) => labels.push(row.getCell(1).value));
          expect(labels[0]).toBe('Supun Construction (Pvt) Ltd');
          expect(labels).toContain(FIRST_HEADER[def.id]);
        }
      }, 60_000);
    }
  }

  it('the file name carries the project code and the period', async () => {
    const res = await get(
      `/reports/project-cost?format=xlsx&projectId=${roadId}&from=2026-10-01&to=2026-10-15`,
    ).expect(200);
    expect(res.headers['content-disposition']).toContain(
      'project-cost_PRJ-2026-001_2026-10-01_2026-10-15.xlsx',
    );
  });

  it('a Sinhala PDF embeds the Sinhala font (glyphs really used); English does not', async () => {
    const si = await get(`/reports/payroll-sheet?format=pdf&locale=si&month=${LAST_MONTH}`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    const en = await get(`/reports/project-cost?format=pdf&locale=en&projectId=${roadId}`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect((si.body as Buffer).toString('latin1')).toContain('NotoSansSinhala');
    expect((en.body as Buffer).toString('latin1')).not.toContain('NotoSansSinhala');
  }, 60_000);

  it('the locale falls back to the NEXT_LOCALE cookie', async () => {
    const res = await ctx
      .http()
      .get(`/reports/expiry?format=xlsx`)
      .set('Cookie', `${cookie}; NEXT_LOCALE=si`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    expect(wb.worksheets[0]!.name).toBe('ලේඛන');
  });

  it('errors: unknown report, wrong format, missing filter, month without payroll', async () => {
    expect((await get('/reports/nope').expect(404)).body.code).toBe('REPORT_NOT_FOUND');
    expect(
      (await get(`/reports/payslips?format=xlsx&month=${LAST_MONTH}`).expect(400)).body.code,
    ).toBe('REPORT_FORMAT_NOT_AVAILABLE');
    expect((await get('/reports/project-cost?format=pdf').expect(400)).body.code).toBe(
      'VALIDATION_FAILED',
    );
    expect(
      (await get('/reports/payroll-sheet?format=pdf&month=13-2026').expect(400)).body.code,
    ).toBe('VALIDATION_FAILED');
    expect(
      (await get('/reports/payroll-sheet?format=pdf&month=2020-01').expect(404)).body.code,
    ).toBe('NO_PAYROLL_FOR_MONTH');
  });
});
