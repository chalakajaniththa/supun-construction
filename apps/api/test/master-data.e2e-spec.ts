import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WorkersService } from '../src/modules/workers/workers.service.js';
import { type TestContext, createTestApp, loginCookie, resetDb } from './helpers.js';

let ctx: TestContext;
let cookie: string;

const get = (path: string) => ctx.http().get(path).set('Cookie', cookie);
const post = (path: string, body: object) => ctx.http().post(path).set('Cookie', cookie).send(body);
const patch = (path: string, body: object) =>
  ctx.http().patch(path).set('Cookie', cookie).send(body);
const put = (path: string, body: object) => ctx.http().put(path).set('Cookie', cookie).send(body);
const del = (path: string) => ctx.http().delete(path).set('Cookie', cookie);

beforeAll(async () => {
  ctx = await createTestApp();
  await resetDb(ctx.prisma);
  cookie = await loginCookie(ctx);
});

afterAll(async () => {
  await ctx.app.close();
});

describe('auth is required', () => {
  it.each([
    '/clients',
    '/projects',
    '/workers',
    '/assets',
    '/suppliers',
    '/materials',
    '/documents',
  ])('GET %s without a cookie → 401', async (path) => {
    await ctx.http().get(path).expect(401);
  });
});

describe('clients', () => {
  let id: string;

  it('creates, lists with filters and search, updates', async () => {
    const res = await post('/clients', {
      name: 'Provincial Road Development Authority',
      type: 'GOVERNMENT',
      phone: '027 222 1111',
      email: '',
    }).expect(201);
    id = res.body.id;
    expect(res.body.email).toBeNull();
    await post('/clients', { name: 'Mr. Perera', type: 'PRIVATE' }).expect(201);

    const all = await get('/clients').expect(200);
    expect(all.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(all.body.items.map((c: { name: string }) => c.name)).toEqual([
      'Mr. Perera',
      'Provincial Road Development Authority',
    ]);
    const gov = await get('/clients?type=GOVERNMENT').expect(200);
    expect(gov.body.total).toBe(1);
    const search = await get('/clients?search=road').expect(200);
    expect(search.body.items[0].id).toBe(id);

    const upd = await patch(`/clients/${id}`, { contactPerson: 'Eng. Silva' }).expect(200);
    expect(upd.body).toMatchObject({ contactPerson: 'Eng. Silva', phone: '027 222 1111' });
  });

  it('validates input with codes', async () => {
    const res = await post('/clients', { name: '', type: 'NOPE', email: 'bad' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    const paths = res.body.details.map(
      (d: { path: string; message: string }) => `${d.path}:${d.message}`,
    );
    expect(paths).toEqual(expect.arrayContaining(['name:REQUIRED', 'email:INVALID_EMAIL']));
    await get('/clients?type=NOPE').expect(400);
    await get('/clients/not-a-uuid').expect(400);
    await get('/clients/6f1c4a52-4a2a-4c43-9d55-4b0d2b8f2d10').expect(404);
  });

  it('writes an audit row', async () => {
    const audit = await get(`/audit?entity=Client&entityId=${id}`).expect(200);
    expect(audit.body.items.map((a: { action: string }) => a.action)).toEqual(['UPDATE', 'CREATE']);
  });
});

describe('suppliers & materials', () => {
  it('suppliers get codes SUP-NNN, filter by type, soft delete', async () => {
    const a = await post('/suppliers', { name: 'Lanka Cement Dealer', type: 'MATERIAL' }).expect(
      201,
    );
    const b = await post('/suppliers', { name: 'Ceypetco Fuel Station', type: 'FUEL' }).expect(201);
    expect([a.body.code, b.body.code]).toEqual(['SUP-001', 'SUP-002']);
    expect((await get('/suppliers?type=FUEL').expect(200)).body.items[0].id).toBe(b.body.id);
    await del(`/suppliers/${a.body.id}`).expect(200);
    await get(`/suppliers/${a.body.id}`).expect(404);
    await patch(`/suppliers/${a.body.id}`, { name: 'x' }).expect(404);
    expect((await get('/suppliers').expect(200)).body.total).toBe(1);
    // a deleted code is never reused
    const c = await post('/suppliers', { name: 'Tyre shop', type: 'OTHER' }).expect(201);
    expect(c.body.code).toBe('SUP-003');
  });

  it('materials CRUD with Sinhala names', async () => {
    const m = await post('/materials', {
      name: 'Cement (50 kg)',
      nameSinhala: 'සිමෙන්ති',
      unit: 'bag',
      category: 'CEMENT',
    }).expect(201);
    await post('/materials', { name: 'Sand', unit: 'cube', category: 'SAND' }).expect(201);
    expect((await get('/materials?search=සිමෙන්ති').expect(200)).body.items[0].id).toBe(m.body.id);
    expect((await get('/materials?category=SAND').expect(200)).body.total).toBe(1);
    await patch(`/materials/${m.body.id}`, { unit: 'bags' }).expect(200);
    await post('/materials', { name: 'X', unit: '', category: 'CEMENT' }).expect(400);
    await del(`/materials/${m.body.id}`).expect(200);
    expect((await get('/materials').expect(200)).body.total).toBe(1);
  });
});

describe('projects', () => {
  let clientId: string;
  let projectId: string;

  beforeAll(async () => {
    clientId = (await post('/clients', { name: 'Pradeshiya Sabha', type: 'GOVERNMENT' })).body.id;
  });

  const base = () => ({
    name: 'Hingurakgoda road rehabilitation',
    type: 'ROAD',
    source: 'GOVERNMENT_TENDER',
    clientId,
    startDate: '2026-03-01',
    plannedEndDate: '2026-12-31',
    contractValue: '45000000.00',
  });

  it('creates with a PRJ-YYYY-NNN code and billing defaults', async () => {
    await patch('/settings/billing', { defaultRetentionPct: '7.5' }).expect(200);
    const res = await post('/projects', base()).expect(201);
    projectId = res.body.id;
    expect(res.body).toMatchObject({
      code: 'PRJ-2026-001',
      status: 'PLANNING',
      retentionPct: '7.50',
      retentionCapPct: '5.00',
      contractValue: '45000000.00',
      advanceAmount: '0.00',
      dlpMonths: 12,
      client: { id: clientId, name: 'Pradeshiya Sabha' },
      budgetLines: [],
      totalBudget: '0.00',
    });
    const second = await post('/projects', {
      ...base(),
      name: 'School block',
      retentionPct: '10',
    }).expect(201);
    expect(second.body.code).toBe('PRJ-2026-002');
    expect(second.body.retentionPct).toBe('10.00');
    const other = await post('/projects', {
      ...base(),
      startDate: '2025-06-01',
      name: 'Culvert',
    }).expect(201);
    expect(other.body.code).toBe('PRJ-2025-001');
  });

  it('rejects bad dates, an unknown client, bad money', async () => {
    const r1 = await post('/projects', { ...base(), plannedEndDate: '2026-01-01' }).expect(400);
    expect(r1.body.details[0]).toMatchObject({
      path: 'plannedEndDate',
      message: 'END_BEFORE_START',
    });
    const r2 = await post('/projects', {
      ...base(),
      clientId: '6f1c4a52-4a2a-4c43-9d55-4b0d2b8f2d10',
    }).expect(400);
    expect(r2.body.details[0]).toMatchObject({ path: 'clientId', message: 'NOT_FOUND' });
    const r3 = await post('/projects', { ...base(), contractValue: '12.345' }).expect(400);
    expect(r3.body.details[0]).toMatchObject({ path: 'contractValue', message: 'INVALID_MONEY' });
    // PATCH checks the dates against the stored ones
    const r4 = await patch(`/projects/${projectId}`, { startDate: '2027-01-01' }).expect(400);
    expect(r4.body.details[0]).toMatchObject({
      path: 'plannedEndDate',
      message: 'END_BEFORE_START',
    });
  });

  it('filters and searches', async () => {
    await patch(`/projects/${projectId}`, { status: 'ONGOING' }).expect(200);
    expect(
      (await get('/projects?status=ONGOING').expect(200)).body.items.map(
        (p: { id: string }) => p.id,
      ),
    ).toEqual([projectId]);
    expect((await get('/projects?search=school').expect(200)).body.total).toBe(1);
    expect((await get(`/projects?clientId=${clientId}&type=ROAD`).expect(200)).body.total).toBe(3);
    expect((await get('/projects?source=PRIVATE').expect(200)).body.total).toBe(0);
  });

  it('PUT budget upserts all lines at once, removes left-out categories, totals exactly', async () => {
    const r1 = await put(`/projects/${projectId}/budget`, {
      lines: [
        { category: 'MATERIALS', amount: '15000000.10' },
        { category: 'LABOUR', amount: '8000000.20', notes: 'Masons and helpers' },
        { category: 'EQUIPMENT', amount: '6500000' },
      ],
    }).expect(200);
    expect(r1.body.total).toBe('29500000.30');
    expect(r1.body.lines.map((l: { category: string }) => l.category)).toEqual([
      'LABOUR',
      'MATERIALS',
      'EQUIPMENT',
    ]);

    const r2 = await put(`/projects/${projectId}/budget`, {
      lines: [
        { category: 'LABOUR', amount: '9000000' },
        { category: 'OTHER', amount: '0.05' },
      ],
    }).expect(200);
    expect(r2.body.total).toBe('9000000.05');
    expect(r2.body.lines).toHaveLength(2);

    const detail = await get(`/projects/${projectId}`).expect(200);
    expect(detail.body.totalBudget).toBe('9000000.05');
    expect(detail.body.budgetLines[0]).toMatchObject({
      category: 'LABOUR',
      amount: '9000000.00',
      notes: null,
    });
    const list = await get('/projects?status=ONGOING').expect(200);
    expect(list.body.items[0].totalBudget).toBe('9000000.05');

    const dup = await put(`/projects/${projectId}/budget`, {
      lines: [
        { category: 'LABOUR', amount: '1' },
        { category: 'LABOUR', amount: '2' },
      ],
    }).expect(400);
    expect(dup.body.details[0].message).toBe('DUPLICATE_CATEGORY');
  });

  it('a client with projects cannot be deleted; soft-deleted projects disappear', async () => {
    const r = await del(`/clients/${clientId}`).expect(409);
    expect(r.body.code).toBe('CLIENT_HAS_PROJECTS');
    await del(`/projects/${projectId}`).expect(200);
    await get(`/projects/${projectId}`).expect(404);
    expect((await get('/projects').expect(200)).body.total).toBe(2);
    expect(await ctx.prisma.project.count()).toBe(3);
  });
});

describe('workers & rates', () => {
  let dailyId: string;
  let permId: string;

  const daily = {
    fullName: 'K. A. Sunil Perera',
    nameSinhala: 'කේ. ඒ. සුනිල් පෙරේරා',
    skill: 'MASON',
    type: 'DAILY',
    joinedDate: '2026-01-15',
    dailyRate: '3500',
    nic: '851234567v',
  };

  it('creates with a W-NNNN code and the first rate', async () => {
    const res = await post('/workers', daily).expect(201);
    dailyId = res.body.id;
    expect(res.body).toMatchObject({
      code: 'W-0001',
      nic: '851234567V',
      active: true,
      currentRate: { dailyRate: '3500.00', monthlySalary: null },
    });
    const p = await post('/workers', {
      fullName: 'R. M. Nimal Bandara',
      skill: 'SUPERVISOR',
      type: 'PERMANENT',
      joinedDate: '2025-05-01',
      monthlySalary: '95000',
      nic: '198512345678',
    }).expect(201);
    permId = p.body.id;
    expect(p.body.code).toBe('W-0002');
  });

  it('validates the NIC and keeps it unique', async () => {
    const bad = await post('/workers', { ...daily, nic: '12345V' }).expect(400);
    expect(bad.body.details[0]).toMatchObject({ path: 'nic', message: 'INVALID_NIC' });
    const dup = await post('/workers', { ...daily, nic: '851234567V' }).expect(409);
    expect(dup.body).toMatchObject({
      code: 'DUPLICATE',
      details: [{ path: 'nic', message: 'NIC_TAKEN' }],
    });
    const dupPatch = await patch(`/workers/${permId}`, { nic: '851234567v' }).expect(409);
    expect(dupPatch.body.details[0].message).toBe('NIC_TAKEN');
    // no NIC is fine, and many workers may have none
    await post('/workers', { ...daily, nic: '' }).expect(201);
    await post('/workers', { ...daily, nic: null, fullName: 'Another' }).expect(201);
    // own NIC unchanged is fine
    await patch(`/workers/${dailyId}`, { nic: '851234567V', phone: '077 123 4567' }).expect(200);
  });

  it('needs the right kind of pay', async () => {
    const r = await post('/workers', { ...daily, nic: undefined, dailyRate: '' }).expect(400);
    expect(r.body.details[0]).toMatchObject({ path: 'dailyRate', message: 'REQUIRED' });
    const r2 = await post(`/workers/${permId}/rates`, {
      effectiveFrom: '2026-09-01',
      dailyRate: '4000',
    }).expect(400);
    expect(r2.body.details[0]).toMatchObject({ path: 'monthlySalary', message: 'REQUIRED' });
  });

  it('rate history: one per date, newest first', async () => {
    await post(`/workers/${dailyId}/rates`, {
      effectiveFrom: '2026-09-01',
      dailyRate: '3800',
    }).expect(201);
    await post(`/workers/${dailyId}/rates`, {
      effectiveFrom: '2099-01-01',
      dailyRate: '9000',
    }).expect(201);
    const dup = await post(`/workers/${dailyId}/rates`, {
      effectiveFrom: '2026-09-01',
      dailyRate: '1',
    }).expect(409);
    expect(dup.body.details[0]).toMatchObject({
      path: 'effectiveFrom',
      message: 'RATE_DATE_TAKEN',
    });
    const rates = await get(`/workers/${dailyId}/rates`).expect(200);
    expect(rates.body.map((r: { dailyRate: string }) => r.dailyRate)).toEqual([
      '9000.00',
      '3800.00',
      '3500.00',
    ]);
    // current rate = latest on or before today (the future raise does not count yet)
    const w = await get(`/workers/${dailyId}`).expect(200);
    expect(w.body.currentRate.dailyRate).toBe('3800.00');
    const list = await get('/workers?search=sunil').expect(200);
    expect(
      list.body.items.find((x: { id: string }) => x.id === dailyId).currentRate.dailyRate,
    ).toBe('3800.00');
  });

  it('getRateOn around the rate change dates', async () => {
    const workers = ctx.app.get(WorkersService);
    const rate = async (day: string) =>
      (await workers.getRateOn(dailyId, day))?.dailyRate?.toString() ?? null;
    expect(await rate('2026-01-14')).toBeNull();
    expect(await rate('2026-01-15')).toBe('3500');
    expect(await rate('2026-08-31')).toBe('3500');
    expect(await rate('2026-09-01')).toBe('3800');
    expect(await rate('2098-12-31')).toBe('3800');
    expect(await rate('2099-01-01')).toBe('9000');
  });

  it('removes a wrong rate but never the last one', async () => {
    const rates = (await get(`/workers/${dailyId}/rates`)).body as { id: string }[];
    await del(`/workers/${dailyId}/rates/${rates[0]!.id}`).expect(200);
    const permRates = (await get(`/workers/${permId}/rates`)).body as { id: string }[];
    await del(`/workers/${permId}/rates/${permRates[0]!.id}`).expect(409);
  });

  it('filters by type, skill and active; soft delete', async () => {
    expect((await get('/workers?type=PERMANENT').expect(200)).body.total).toBe(1);
    expect((await get('/workers?skill=MASON').expect(200)).body.total).toBe(3);
    await patch(`/workers/${permId}`, { active: false, leftDate: '2026-09-30' }).expect(200);
    expect((await get('/workers?active=true').expect(200)).body.total).toBe(3);
    expect((await get('/workers?active=false').expect(200)).body.total).toBe(1);
    await get('/workers?active=maybe').expect(400);
    const bad = await patch(`/workers/${permId}`, { leftDate: '2020-01-01' }).expect(400);
    expect(bad.body.details[0].message).toBe('END_BEFORE_START');
    await del(`/workers/${permId}`).expect(200);
    await get(`/workers/${permId}`).expect(404);
    expect((await get('/workers').expect(200)).body.total).toBe(3);
  });
});

describe('assets', () => {
  it('creates with AST-NNN, defaults, filters, unique registration', async () => {
    const jcb = await post('/assets', {
      name: 'JCB 3CX backhoe',
      category: 'JCB_BACKHOE',
      registrationNo: 'pc 4512',
      isVehicle: true,
      serviceIntervalMeter: '250',
      internalRatePerHour: '6500',
    }).expect(201);
    expect(jcb.body).toMatchObject({
      code: 'AST-001',
      registrationNo: 'PC 4512',
      status: 'AVAILABLE',
      ownership: 'OWNED',
      meterType: 'HOURS',
      currentMeter: '0.00',
      serviceIntervalMeter: '250.00',
      nextExpiry: null,
    });
    const mixer = await post('/assets', {
      name: 'Concrete mixer',
      category: 'CONCRETE_MIXER',
      meterType: 'NONE',
    }).expect(201);
    expect(mixer.body.code).toBe('AST-002');
    const dup = await post('/assets', {
      name: 'Tipper',
      category: 'TIPPER',
      registrationNo: 'PC 4512',
    }).expect(409);
    expect(dup.body.details[0].message).toBe('REG_NO_TAKEN');

    expect((await get('/assets?isVehicle=true').expect(200)).body.total).toBe(1);
    expect((await get('/assets?category=CONCRETE_MIXER').expect(200)).body.total).toBe(1);
    expect((await get('/assets?search=4512').expect(200)).body.total).toBe(1);
    const upd = await patch(`/assets/${mixer.body.id}`, {
      status: 'UNDER_REPAIR',
      currentMeter: '',
    }).expect(200);
    expect(upd.body).toMatchObject({ status: 'UNDER_REPAIR', currentMeter: '0.00' });
    expect((await get('/assets?status=UNDER_REPAIR').expect(200)).body.total).toBe(1);
    await del(`/assets/${mixer.body.id}`).expect(200);
    await get(`/assets/${mixer.body.id}`).expect(404);
  });

  it('rejects bad values', async () => {
    const r = await post('/assets', {
      name: 'X',
      category: 'TOOL',
      yearOfManufacture: 1800,
      currentMeter: '-5',
    }).expect(400);
    const paths = r.body.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['yearOfManufacture', 'currentMeter']));
  });
});
