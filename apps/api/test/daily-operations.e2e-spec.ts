import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type TestContext, createTestApp, loginCookie, resetDb } from './helpers.js';

/** Step 3: allocations, daily entry, store, supplier accounts, advances, maintenance. */
let ctx: TestContext;
let cookie: string;

const get = (path: string) => ctx.http().get(path).set('Cookie', cookie);
const post = (path: string, body: object = {}) =>
  ctx.http().post(path).set('Cookie', cookie).send(body);
const patch = (path: string, body: object) =>
  ctx.http().patch(path).set('Cookie', cookie).send(body);
const put = (path: string, body: object) => ctx.http().put(path).set('Cookie', cookie).send(body);
const del = (path: string) => ctx.http().delete(path).set('Cookie', cookie);

interface Fixture {
  roadId: string;
  schoolId: string;
  workers: string[];
  jcbId: string;
  mixerId: string;
  supplierId: string;
  cementId: string;
  sandId: string;
}
let f: Fixture;

async function fixture(): Promise<Fixture> {
  const p = ctx.prisma;
  const client = await p.client.create({ data: { name: 'Sample PS', type: 'GOVERNMENT' } });
  const project = (code: string, name: string) =>
    p.project.create({
      data: {
        code,
        name,
        type: 'ROAD',
        source: 'GOVERNMENT_TENDER',
        clientId: client.id,
        startDate: new Date('2026-09-01'),
        plannedEndDate: new Date('2027-03-31'),
        status: 'ONGOING',
      },
    });
  const road = await project('PRJ-2026-001', 'Road A');
  const school = await project('PRJ-2026-002', 'School B');
  const workers: string[] = [];
  for (const [i, name] of ['Sunil', 'Ruwan', 'Saman'].entries()) {
    const w = await p.worker.create({
      data: {
        code: `W-000${i + 1}`,
        fullName: name,
        skill: 'MASON',
        type: 'DAILY',
        joinedDate: new Date('2026-01-01'),
        rates: { create: { effectiveFrom: new Date('2026-01-01'), dailyRate: '4000' } },
      },
    });
    workers.push(w.id);
  }
  const jcb = await p.asset.create({
    data: {
      code: 'AST-001',
      name: 'JCB',
      category: 'JCB_BACKHOE',
      meterType: 'HOURS',
      currentMeter: '1000',
      serviceIntervalMeter: '250',
      lastServiceMeter: '770',
      internalRatePerHour: '6500',
    },
  });
  const mixer = await p.asset.create({
    data: { code: 'AST-002', name: 'Mixer', category: 'CONCRETE_MIXER', meterType: 'NONE' },
  });
  const supplier = await p.supplier.create({
    data: { code: 'SUP-001', name: 'Cement Co', type: 'MATERIAL' },
  });
  const cement = await p.material.create({
    data: { name: 'Cement', unit: 'bag', category: 'CEMENT' },
  });
  const sand = await p.material.create({ data: { name: 'Sand', unit: 'cube', category: 'SAND' } });
  return {
    roadId: road.id,
    schoolId: school.id,
    workers,
    jcbId: jcb.id,
    mixerId: mixer.id,
    supplierId: supplier.id,
    cementId: cement.id,
    sandId: sand.id,
  };
}

beforeAll(async () => {
  ctx = await createTestApp();
});

beforeEach(async () => {
  await resetDb(ctx.prisma);
  cookie = await loginCookie(ctx);
  f = await fixture();
});

afterAll(async () => {
  await ctx.app.close();
});

describe('allocations', () => {
  const book = (body: object) =>
    post('/allocations/workers', {
      workerIds: [f.workers[0]],
      projectId: f.roadId,
      fromDate: '2026-10-14',
      startTime: '08:00',
      endTime: '12:00',
      ...body,
    });

  it('creates an allocation in Colombo time and lists it', async () => {
    const res = await book({}).expect(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      kind: 'worker',
      startAt: '2026-10-14T02:30:00.000Z',
      endAt: '2026-10-14T06:30:00.000Z',
      project: { name: 'Road A' },
      worker: { fullName: 'Sunil' },
    });
    const list = await get('/allocations?kind=worker&from=2026-10-12&to=2026-10-18').expect(200);
    expect(list.body).toHaveLength(1);
    const other = await get('/allocations?kind=worker&from=2026-10-15&to=2026-10-18').expect(200);
    expect(other.body).toHaveLength(0);
  });

  it('rejects an overlap with 409 and the conflict details; back-to-back is fine', async () => {
    await book({}).expect(201);
    const res = await book({ projectId: f.schoolId, startTime: '11:00', endTime: '15:00' }).expect(
      409,
    );
    expect(res.body.code).toBe('ALLOCATION_OVERLAP');
    expect(res.body.details.conflicts).toEqual([
      expect.objectContaining({
        kind: 'worker',
        resourceId: f.workers[0],
        resourceName: 'Sunil',
        projectName: 'Road A',
        startAt: '2026-10-14T02:30:00.000Z',
        endAt: '2026-10-14T06:30:00.000Z',
        requestedStartAt: '2026-10-14T05:30:00.000Z',
      }),
    ]);
    // same-day move to another site in the afternoon
    await book({ projectId: f.schoolId, startTime: '12:00', endTime: '17:00' }).expect(201);
    expect(await ctx.prisma.workerAllocation.count()).toBe(2);
  });

  it('cancelling frees the slot', async () => {
    const [a] = (await book({}).expect(201)).body;
    await book({}).expect(409);
    const cancelled = await post(`/allocations/${a.id}/cancel`).expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');
    await book({}).expect(201);
    const list = await get('/allocations?kind=worker&from=2026-10-14&to=2026-10-14').expect(200);
    expect(list.body).toHaveLength(1);
    const all = await get(
      '/allocations?kind=worker&from=2026-10-14&to=2026-10-14&includeCancelled=true',
    ).expect(200);
    expect(all.body).toHaveLength(2);
  });

  it('bulk is all-or-nothing and lists every conflict', async () => {
    // Ruwan is busy on Wednesday and Friday
    await book({ workerIds: [f.workers[1]], fromDate: '2026-10-14', startTime: '07:00' }).expect(
      201,
    );
    await book({
      workerIds: [f.workers[1]],
      fromDate: '2026-10-16',
      projectId: f.schoolId,
      startTime: '16:00',
      endTime: '18:00',
    }).expect(201);
    const res = await post('/allocations/workers', {
      workerIds: [f.workers[0], f.workers[1]],
      projectId: f.roadId,
      fromDate: '2026-10-12',
      toDate: '2026-10-18',
      startTime: '08:00',
      endTime: '17:00',
      skipSundays: true,
    }).expect(409);
    expect(res.body.details.conflicts).toHaveLength(2);
    expect(
      res.body.details.conflicts.map((c: { projectName: string }) => c.projectName).sort(),
    ).toEqual(['Road A', 'School B']);
    expect(await ctx.prisma.workerAllocation.count()).toBe(2);

    // without Ruwan it works: 6 days (Sunday skipped)
    const ok = await post('/allocations/workers', {
      workerIds: [f.workers[0], f.workers[2]],
      projectId: f.roadId,
      fromDate: '2026-10-12',
      toDate: '2026-10-18',
      startTime: '08:00',
      endTime: '17:00',
      skipSundays: true,
    }).expect(201);
    expect(ok.body).toHaveLength(12);
  });

  it('validates times, ranges and references', async () => {
    const bad = await book({ startTime: '17:00', endTime: '08:00' }).expect(400);
    expect(bad.body.details).toEqual([
      expect.objectContaining({ path: 'endTime', message: 'END_TIME_BEFORE_START' }),
    ]);
    await book({ toDate: '2027-02-01' }).expect(400);
    await book({ workerIds: ['00000000-0000-4000-8000-000000000000'] }).expect(400);
  });

  it('moves / resizes with PATCH and rejects an overlapping move', async () => {
    const [a] = (await book({}).expect(201)).body;
    const [b] = (
      await book({ projectId: f.schoolId, startTime: '13:00', endTime: '17:00' }).expect(201)
    ).body;
    const resized = await patch(`/allocations/${a.id}`, { endTime: '12:30' }).expect(200);
    expect(resized.body.endAt).toBe('2026-10-14T07:00:00.000Z');
    const clash = await patch(`/allocations/${a.id}`, { endTime: '14:00' }).expect(409);
    expect(clash.body.details.conflicts[0].allocationId).toBe(b.id);
    const moved = await patch(`/allocations/${a.id}`, {
      date: '2026-10-15',
      projectId: f.schoolId,
    }).expect(200);
    expect(moved.body).toMatchObject({
      startAt: '2026-10-15T02:30:00.000Z',
      project: { name: 'School B' },
    });
  });

  it('asset allocations: same machine at two sites on the same day, operator, availability', async () => {
    await post('/allocations/assets', {
      assetIds: [f.jcbId],
      projectId: f.roadId,
      fromDate: '2026-10-14',
      startTime: '07:30',
      endTime: '12:00',
      operatorWorkerId: f.workers[2],
    }).expect(201);
    await post('/allocations/assets', {
      assetIds: [f.jcbId],
      projectId: f.schoolId,
      fromDate: '2026-10-14',
      startTime: '13:00',
      endTime: '17:00',
    }).expect(201);
    const clash = await post('/allocations/assets', {
      assetIds: [f.jcbId, f.mixerId],
      projectId: f.schoolId,
      fromDate: '2026-10-14',
      startTime: '11:00',
      endTime: '14:00',
    }).expect(409);
    expect(clash.body.details.conflicts).toHaveLength(2);
    expect(await ctx.prisma.assetAllocation.count()).toBe(2);

    const list = await get(`/allocations?kind=asset&from=2026-10-14&to=2026-10-14`).expect(200);
    expect(list.body.map((a: { project: { name: string } }) => a.project.name)).toEqual([
      'Road A',
      'School B',
    ]);
    expect(list.body[0].operator.fullName).toBe('Saman');

    const avail = await get(
      '/allocations/availability?kind=asset&fromDate=2026-10-14&startTime=08:00&endTime=10:00',
    ).expect(200);
    expect(avail.body.busy).toEqual([
      expect.objectContaining({ id: f.jcbId, projects: ['Road A'] }),
    ]);
    expect(avail.body.free.map((a: { id: string }) => a.id)).toEqual([f.mixerId]);
  });
});

describe('daily entry', () => {
  const day = '2026-10-14';
  const save = (body: object) =>
    put('/daily-entry', {
      date: day,
      projectId: f.roadId,
      attendance: [],
      usage: [],
      expenses: [],
      ...body,
    });

  it('lists planned workers and machines and saves everything in one go', async () => {
    await post('/allocations/workers', {
      workerIds: [f.workers[0], f.workers[1]],
      projectId: f.roadId,
      fromDate: day,
      startTime: '08:00',
      endTime: '17:00',
    }).expect(201);
    await post('/allocations/assets', {
      assetIds: [f.jcbId],
      projectId: f.roadId,
      fromDate: day,
      startTime: '08:00',
      endTime: '17:00',
      operatorWorkerId: f.workers[1],
    }).expect(201);

    const before = await get(`/daily-entry?date=${day}&projectId=${f.roadId}`).expect(200);
    expect(before.body.locked).toBe(false);
    expect(before.body.workers.map((w: { fullName: string }) => w.fullName)).toEqual([
      'Sunil',
      'Ruwan',
    ]);
    expect(before.body.workers[0]).toMatchObject({
      allocated: true,
      plannedTimes: ['08:00–17:00'],
      attendance: null,
    });
    expect(before.body.usage).toEqual([
      expect.objectContaining({
        id: null,
        assetId: f.jcbId,
        currentMeter: '1000.00',
        operatorWorkerId: f.workers[1],
      }),
    ]);

    const res = await save({
      attendance: [
        { workerId: f.workers[0], status: 'PRESENT', otHours: '2' },
        { workerId: f.workers[1], status: 'HALF_DAY', otHours: '' },
        { workerId: f.workers[2], status: 'ABSENT', notes: 'sick' },
      ],
      usage: [
        {
          assetId: f.jcbId,
          startMeter: '1000',
          endMeter: '1007.5',
          fuelLitres: '45',
          fuelCost: '13500',
          operatorWorkerId: f.workers[1],
        },
        { assetId: f.mixerId, hoursUsed: '6' },
      ],
      expenses: [
        { category: 'MEALS', description: 'Lunch for workers', amount: '3500', paidBy: 'CASH' },
        {
          category: 'EQUIPMENT_HIRE',
          description: 'Roller hire',
          amount: '25000',
          paidBy: 'CREDIT',
          supplierId: f.supplierId,
        },
      ],
    }).expect(200);
    expect(res.body.workers).toHaveLength(3);
    expect(
      res.body.workers.find((w: { fullName: string }) => w.fullName === 'Sunil'),
    ).toMatchObject({ attendance: { status: 'PRESENT', otHours: '2.00' } });
    expect(res.body.usage).toHaveLength(2);
    const jcbLog = res.body.usage.find((u: { assetId: string }) => u.assetId === f.jcbId);
    expect(jcbLog).toMatchObject({ hoursUsed: '7.50', startMeter: '1000.00', endMeter: '1007.50' });
    expect(res.body.expenses).toHaveLength(2);

    const jcb = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: f.jcbId } });
    expect(jcb.currentMeter.toString()).toBe('1007.5');
    const mixerLog = await ctx.prisma.assetUsageLog.findFirstOrThrow({
      where: { assetId: f.mixerId },
    });
    expect(mixerLog.hoursUsed.toString()).toBe('6');

    // saving again with fewer rows replaces the day (rows left out are removed)
    const again = await save({
      attendance: [{ workerId: f.workers[0], status: 'PRESENT' }],
      usage: [{ id: jcbLog.id, assetId: f.jcbId, startMeter: '1000', endMeter: '1006' }],
      expenses: [{ ...res.body.expenses[0], amount: '4000' }],
    }).expect(200);
    expect(await ctx.prisma.attendance.count()).toBe(1);
    expect(await ctx.prisma.assetUsageLog.count()).toBe(1);
    expect(again.body.expenses).toEqual([
      expect.objectContaining({ id: res.body.expenses[0].id, amount: '4000.00' }),
    ]);
    // the meter never goes backwards
    const jcb2 = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: f.jcbId } });
    expect(jcb2.currentMeter.toString()).toBe('1007.5');
  });

  it('is transactional: one bad row and nothing is saved', async () => {
    const res = await save({
      attendance: [{ workerId: f.workers[0], status: 'PRESENT' }],
      usage: [{ assetId: f.jcbId, startMeter: '1000', endMeter: '1010' }],
      expenses: [
        { category: 'MEALS', description: 'ok', amount: '100', paidBy: 'CASH' },
        {
          category: 'OTHER',
          description: 'bad supplier',
          amount: '100',
          paidBy: 'CREDIT',
          supplierId: '00000000-0000-4000-8000-000000000000',
        },
      ],
    }).expect(400);
    expect(res.body.details[0].path).toBe('expenses.1.supplierId');
    expect(await ctx.prisma.attendance.count()).toBe(0);
    expect(await ctx.prisma.assetUsageLog.count()).toBe(0);
    expect(await ctx.prisma.expense.count()).toBe(0);
    const jcb = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: f.jcbId } });
    expect(jcb.currentMeter.toString()).toBe('1000');
  });

  it('validates rows (end meter before start, duplicate worker)', async () => {
    const res = await save({
      attendance: [
        { workerId: f.workers[0], status: 'PRESENT' },
        { workerId: f.workers[0], status: 'ABSENT' },
      ],
      usage: [{ assetId: f.jcbId, startMeter: '1010', endMeter: '1000' }],
    }).expect(400);
    expect(res.body.details.map((d: { message: string }) => d.message).sort()).toEqual([
      'DUPLICATE_WORKER',
      'END_METER_BEFORE_START',
    ]);
  });

  it('rejects attendance at a second project on the same day', async () => {
    await save({ attendance: [{ workerId: f.workers[0], status: 'PRESENT' }] }).expect(200);
    const res = await save({
      projectId: f.schoolId,
      attendance: [
        { workerId: f.workers[1], status: 'PRESENT' },
        { workerId: f.workers[0], status: 'PRESENT' },
      ],
    }).expect(409);
    expect(res.body.code).toBe('ATTENDANCE_EXISTS_OTHER_PROJECT');
    expect(res.body.details.conflicts).toEqual([
      expect.objectContaining({ workerName: 'Sunil', projectName: 'Road A' }),
    ]);
    expect(await ctx.prisma.attendance.count()).toBe(1);
    // the other project's daily entry shows where the planned worker already is
    await post('/allocations/workers', {
      workerIds: [f.workers[0]],
      projectId: f.schoolId,
      fromDate: day,
      startTime: '13:00',
      endTime: '17:00',
    }).expect(201);
    const school = await get(`/daily-entry?date=${day}&projectId=${f.schoolId}`).expect(200);
    expect(school.body.workers[0].otherProject).toMatchObject({ name: 'Road A' });
  });

  it('is locked when the month payroll is finalized', async () => {
    await ctx.prisma.payrollRun.create({
      data: { year: 2026, month: 10, status: 'FINALIZED', finalizedAt: new Date() },
    });
    const res = await save({ attendance: [{ workerId: f.workers[0], status: 'PRESENT' }] }).expect(
      409,
    );
    expect(res.body.code).toBe('PAYROLL_LOCKED');
    const view = await get(`/daily-entry?date=${day}&projectId=${f.roadId}`).expect(200);
    expect(view.body.locked).toBe(true);
    // another month is fine
    await save({
      date: '2026-11-02',
      attendance: [{ workerId: f.workers[0], status: 'PRESENT' }],
    }).expect(200);
  });

  it('copy-from returns the last earlier day with attendance', async () => {
    await save({
      date: '2026-10-10',
      attendance: [
        { workerId: f.workers[0], status: 'PRESENT', otHours: '1.5' },
        { workerId: f.workers[1], status: 'ABSENT' },
      ],
    }).expect(200);
    const res = await get(`/daily-entry/copy-from?date=${day}&projectId=${f.roadId}`).expect(200);
    expect(res.body.date).toBe('2026-10-10');
    expect(res.body.attendance).toEqual([
      expect.objectContaining({ fullName: 'Sunil', status: 'PRESENT', otHours: '1.5' }),
      expect.objectContaining({ fullName: 'Ruwan', status: 'ABSENT' }),
    ]);
    const none = await get(`/daily-entry/copy-from?date=2026-10-10&projectId=${f.roadId}`).expect(
      200,
    );
    expect(none.body).toEqual({ date: null, attendance: [] });
  });

  it('attendance list for a worker month with a summary', async () => {
    await save({
      date: '2026-10-13',
      attendance: [{ workerId: f.workers[0], status: 'PRESENT', otHours: '2' }],
    }).expect(200);
    await save({ attendance: [{ workerId: f.workers[0], status: 'HALF_DAY' }] }).expect(200);
    const res = await get(
      `/attendance?workerId=${f.workers[0]}&from=2026-10-01&to=2026-10-31`,
    ).expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.summary).toMatchObject({
      present: 1,
      halfDays: 1,
      daysWorked: '1.5',
      otHours: '2',
    });
  });
});

describe('expenses', () => {
  it('CRUD with filters and a total', async () => {
    const a = await post('/expenses', {
      date: '2026-10-10',
      projectId: f.roadId,
      category: 'TRANSPORT',
      description: 'Lorry hire',
      amount: '12000',
      paidBy: 'CASH',
    }).expect(201);
    await post('/expenses', {
      date: '2026-10-12',
      category: 'OFFICE',
      description: 'Stationery',
      amount: '850.50',
      paidBy: 'CASH',
    }).expect(201);
    const credit = await post('/expenses', {
      date: '2026-10-12',
      category: 'OTHER',
      description: 'x',
      amount: '10',
      paidBy: 'CREDIT',
    }).expect(400);
    expect(credit.body.details[0].message).toBe('SUPPLIER_REQUIRED_FOR_CREDIT');

    const all = await get('/expenses').expect(200);
    expect(all.body).toMatchObject({ total: 2, totalAmount: '12850.50' });
    const road = await get(`/expenses?projectId=${f.roadId}&from=2026-10-01&to=2026-10-11`).expect(
      200,
    );
    expect(road.body.items).toEqual([
      expect.objectContaining({ description: 'Lorry hire', project: expect.any(Object) }),
    ]);
    await patch(`/expenses/${a.body.id}`, { amount: '12500' }).expect(200);
    await del(`/expenses/${a.body.id}`).expect(200);
    expect((await get('/expenses').expect(200)).body.totalAmount).toBe('850.50');
  });
});

describe('purchases and store', () => {
  const buy = (lines: object[], extra: object = {}) =>
    post('/purchases', {
      supplierId: f.supplierId,
      date: '2026-10-01',
      invoiceNo: 'INV-1',
      paymentType: 'CREDIT',
      lines,
      ...extra,
    });

  it('computes totals, stock, weighted average issue cost and blocks over-issuing', async () => {
    const p1 = await buy([
      { materialId: f.cementId, quantity: '100', unitPrice: '2100' },
      { materialId: f.sandId, quantity: '2.5', unitPrice: '18500', projectId: f.roadId },
    ]).expect(201);
    expect(p1.body.total).toBe('256250.00');
    expect(p1.body.lines[1]).toMatchObject({ amount: '46250.00', project: { name: 'Road A' } });
    await buy([{ materialId: f.cementId, quantity: '50', unitPrice: '2250' }], {
      date: '2026-10-05',
      paymentType: 'CASH',
    }).expect(201);

    const stock = await get('/store/stock').expect(200);
    expect(stock.body.items).toEqual([
      expect.objectContaining({
        name: 'Cement',
        purchasedQty: '150',
        stock: '150',
        averageCost: '2150.00',
        value: '322500.00',
      }),
    ]);

    // issue dated before the second purchase uses the average up to that day
    const early = await post('/store/issues', {
      materialId: f.cementId,
      projectId: f.roadId,
      date: '2026-10-03',
      quantity: '10',
    }).expect(201);
    expect(early.body).toMatchObject({ unitCost: '2100.00', amount: '21000.00' });
    const late = await post('/store/issues', {
      materialId: f.cementId,
      projectId: f.schoolId,
      date: '2026-10-06',
      quantity: '40',
    }).expect(201);
    expect(late.body.unitCost).toBe('2150.00');

    const over = await post('/store/issues', {
      materialId: f.cementId,
      projectId: f.roadId,
      date: '2026-10-07',
      quantity: '100.5',
    }).expect(409);
    expect(over.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { available: '100' } });
    const none = await post('/store/issues', {
      materialId: f.sandId,
      projectId: f.roadId,
      date: '2026-10-07',
      quantity: '1',
    }).expect(409);
    expect(none.body.details.available).toBe('0');

    const after = await get('/store/stock').expect(200);
    expect(after.body.items[0]).toMatchObject({
      issuedQty: '50',
      stock: '100',
      value: '215000.00',
    });
    const issues = await get(`/store/issues?projectId=${f.roadId}`).expect(200);
    expect(issues.body.total).toBe(1);

    // removing the first purchase would leave the store negative (50 issued, only 50 bought)
    await del(`/purchases/${p1.body.id}`).expect(200);
    await del(`/store/issues/${late.body.id}`).expect(200);
    const res = await patch(
      `/purchases/${(await get('/purchases?paymentType=CASH')).body.items[0].id}`,
      {
        lines: [{ materialId: f.cementId, quantity: '5', unitPrice: '2250' }],
      },
    ).expect(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('lists purchases with filters, edits lines and recomputes the total', async () => {
    const p = await buy([{ materialId: f.cementId, quantity: '10', unitPrice: '2000' }]).expect(
      201,
    );
    await buy(
      [{ materialId: f.sandId, quantity: '1', unitPrice: '18000', projectId: f.schoolId }],
      {
        paymentType: 'CASH',
        invoiceNo: 'C-77',
      },
    ).expect(201);
    expect((await get('/purchases').expect(200)).body).toMatchObject({
      total: 2,
      totalAmount: '38000.00',
    });
    expect((await get(`/purchases?projectId=${f.schoolId}`).expect(200)).body.total).toBe(1);
    expect((await get('/purchases?search=C-77').expect(200)).body.total).toBe(1);
    const edited = await patch(`/purchases/${p.body.id}`, {
      lines: [
        { materialId: f.cementId, quantity: '12', unitPrice: '2000' },
        { materialId: f.sandId, quantity: '0.5', unitPrice: '18000' },
      ],
    }).expect(200);
    expect(edited.body.total).toBe('33000.00');
    expect(edited.body.lines).toHaveLength(2);
    await post('/purchases', {
      supplierId: f.supplierId,
      date: '2026-10-01',
      paymentType: 'CASH',
      lines: [],
    }).expect(400);
  });
});

describe('supplier accounts', () => {
  it('statement with a running balance, balances and payments', async () => {
    await post('/purchases', {
      supplierId: f.supplierId,
      date: '2026-09-20',
      paymentType: 'CREDIT',
      invoiceNo: 'A1',
      lines: [{ materialId: f.cementId, quantity: '100', unitPrice: '2000' }],
    }).expect(201);
    await post('/purchases', {
      supplierId: f.supplierId,
      date: '2026-10-02',
      paymentType: 'CASH',
      lines: [{ materialId: f.cementId, quantity: '10', unitPrice: '2000' }],
    }).expect(201);
    await post('/expenses', {
      date: '2026-10-03',
      category: 'TRANSPORT',
      description: 'Delivery charge',
      amount: '4500.50',
      paidBy: 'CREDIT',
      supplierId: f.supplierId,
    }).expect(201);
    await post(`/suppliers/${f.supplierId}/payments`, {
      date: '2026-10-01',
      amount: '150000',
      method: 'CHEQUE',
      reference: 'CHQ 1001',
    }).expect(201);
    const pay2 = await post(`/suppliers/${f.supplierId}/payments`, {
      date: '2026-10-10',
      amount: '20000',
      method: 'CASH',
    }).expect(201);

    const st = await get(`/suppliers/${f.supplierId}/statement`).expect(200);
    expect(
      st.body.entries.map((e: { kind: string; balance: string }) => [e.kind, e.balance]),
    ).toEqual([
      ['PURCHASE', '200000.00'],
      ['PAYMENT', '50000.00'],
      ['EXPENSE', '54500.50'],
      ['PAYMENT', '34500.50'],
    ]);
    expect(st.body).toMatchObject({ openingBalance: '0.00', closingBalance: '34500.50' });

    const oct = await get(
      `/suppliers/${f.supplierId}/statement?from=2026-10-02&to=2026-10-05`,
    ).expect(200);
    expect(oct.body).toMatchObject({
      openingBalance: '50000.00',
      closingBalance: '54500.50',
      totalDebit: '4500.50',
    });
    expect(oct.body.entries).toHaveLength(1);

    const balances = await get('/suppliers/balances').expect(200);
    expect(balances.body[0]).toMatchObject({
      name: 'Cement Co',
      credit: '204500.50',
      paid: '170000.00',
      balance: '34500.50',
    });
    const list = await get('/suppliers').expect(200);
    expect(list.body.items[0].balance).toBe('34500.50');

    await del(`/suppliers/${f.supplierId}/payments/${pay2.body.id}`).expect(200);
    expect((await get('/suppliers').expect(200)).body.items[0].balance).toBe('54500.50');
  });
});

describe('advances', () => {
  it('creates, lists open ones with balances, edits only before recovery', async () => {
    const res = await post(`/workers/${f.workers[0]}/advances`, {
      date: '2026-10-05',
      amount: '20000',
      reason: 'Family need',
      recoveryPerMonth: '5000',
    }).expect(201);
    expect(res.body).toMatchObject({ status: 'OPEN', recovered: '0.00', balance: '20000.00' });
    const tooMuch = await post(`/workers/${f.workers[1]}/advances`, {
      date: '2026-10-05',
      amount: '1000',
      recoveryPerMonth: '2000',
    }).expect(400);
    expect(tooMuch.body.details[0].message).toBe('RECOVERY_MORE_THAN_AMOUNT');

    await patch(`/workers/${f.workers[0]}/advances/${res.body.id}`, { amount: '25000' }).expect(
      200,
    );
    const tooSmall = await patch(`/workers/${f.workers[0]}/advances/${res.body.id}`, {
      amount: '4000',
    }).expect(400);
    expect(tooSmall.body.details[0].message).toBe('RECOVERY_MORE_THAN_AMOUNT');

    // a recovery from payroll (Step 4) locks the advance
    const run = await ctx.prisma.payrollRun.create({ data: { year: 2026, month: 10 } });
    const line = await ctx.prisma.payrollLine.create({
      data: { payrollRunId: run.id, workerId: f.workers[0], workerType: 'DAILY' },
    });
    await ctx.prisma.advanceRecovery.create({
      data: { advanceId: res.body.id, payrollLineId: line.id, amount: '5000' },
    });
    const list = await get('/advances?status=OPEN').expect(200);
    expect(list.body).toMatchObject({ total: 1, totalBalance: '20000.00' });
    expect(list.body.items[0]).toMatchObject({
      recovered: '5000.00',
      balance: '20000.00',
      worker: { fullName: 'Sunil' },
    });
    const locked = await patch(`/workers/${f.workers[0]}/advances/${res.body.id}`, {
      amount: '30000',
    }).expect(409);
    expect(locked.body.code).toBe('ADVANCE_HAS_RECOVERIES');
    await del(`/workers/${f.workers[0]}/advances/${res.body.id}`).expect(409);
    expect((await get(`/workers/${f.workers[0]}/advances`).expect(200)).body).toHaveLength(1);
  });
});

describe('asset usage and maintenance', () => {
  it('service status, a SERVICE record resets it, usage log list', async () => {
    const before = await get(`/assets/${f.jcbId}/service-status`).expect(200);
    expect(before.body).toMatchObject({ state: 'DUE_SOON', remaining: '20', dueAt: '1020' });

    const rec = await post(`/assets/${f.jcbId}/maintenance`, {
      date: '2026-10-10',
      type: 'SERVICE',
      description: '250 h service',
      meterReading: '1002',
      cost: '45000',
      supplierId: f.supplierId,
    }).expect(201);
    expect(rec.body.supplier.name).toBe('Cement Co');
    const after = await get(`/assets/${f.jcbId}/service-status`).expect(200);
    expect(after.body).toMatchObject({
      state: 'OK',
      currentMeter: '1002',
      lastServiceMeter: '1002',
      remaining: '250',
    });
    await post(`/assets/${f.jcbId}/maintenance`, {
      date: '2026-10-11',
      type: 'REPAIR',
      description: 'Hydraulic hose',
      cost: '8000',
    }).expect(201);
    expect((await get(`/assets/${f.jcbId}/maintenance`).expect(200)).body).toHaveLength(2);
    await del(`/assets/${f.jcbId}/maintenance/${rec.body.id}`).expect(200);

    await put('/daily-entry', {
      date: '2026-10-14',
      projectId: f.roadId,
      attendance: [],
      usage: [{ assetId: f.jcbId, startMeter: '1002', endMeter: '1010', fuelLitres: '40' }],
      expenses: [],
    }).expect(200);
    const usage = await get(`/assets/${f.jcbId}/usage`).expect(200);
    expect(usage.body).toMatchObject({ total: 1, totals: { hours: '8', fuelLitres: '40' } });
    expect(usage.body.items[0].project.name).toBe('Road A');
  });
});
