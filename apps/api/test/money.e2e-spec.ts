import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestContext, createTestApp, loginCookie, resetDb } from './helpers.js';

/**
 * Step 4: payroll (generate → edit → finalize → locked → reopen), project costs, BOQ import &
 * progress, IPC sequence with the retention cap, client payments, finance summary, EOT, bonds.
 */
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
  projectId: string;
  d1: string;
  d2: string;
  p1: string;
  advD2: string;
  advP1: string;
}
let f: Fixture;

async function fixture(): Promise<Fixture> {
  const p = ctx.prisma;
  const client = await p.client.create({ data: { name: 'Sample PS', type: 'GOVERNMENT' } });
  const project = await p.project.create({
    data: {
      code: 'PRJ-2026-001',
      name: 'Road A',
      type: 'ROAD',
      source: 'GOVERNMENT_TENDER',
      clientId: client.id,
      contractValue: '1000000',
      retentionPct: '10',
      retentionCapPct: '5',
      advanceAmount: '100000',
      advanceRecoveryPct: '20',
      startDate: new Date('2026-08-01'),
      plannedEndDate: new Date('2027-01-31'),
      status: 'ONGOING',
      budgetLines: {
        create: [
          { category: 'LABOUR', amount: '100000' },
          { category: 'EQUIPMENT', amount: '50000' },
          { category: 'SUBCONTRACT', amount: '20000' },
        ],
      },
    },
  });
  const worker = (code: string, name: string, type: 'DAILY' | 'PERMANENT', pay: string) =>
    p.worker.create({
      data: {
        code,
        fullName: name,
        skill: type === 'DAILY' ? 'MASON' : 'SUPERVISOR',
        type,
        joinedDate: new Date('2026-01-01'),
        rates: {
          create: {
            effectiveFrom: new Date('2026-01-01'),
            ...(type === 'DAILY' ? { dailyRate: pay } : { monthlySalary: pay }),
          },
        },
      },
    });
  const d1 = await worker('W-0001', 'Sunil', 'DAILY', '4000');
  const d2 = await worker('W-0002', 'Ruwan', 'DAILY', '3000');
  const p1 = await worker('W-0003', 'Kamal', 'PERMANENT', '78000');
  const advD2 = await p.advance.create({
    data: { workerId: d2.id, date: new Date('2026-07-20'), amount: '5000' },
  });
  const advP1 = await p.advance.create({
    data: {
      workerId: p1.id,
      date: new Date('2026-07-25'),
      amount: '10000',
      recoveryPerMonth: '10000',
    },
  });
  return {
    projectId: project.id,
    d1: d1.id,
    d2: d2.id,
    p1: p1.id,
    advD2: advD2.id,
    advP1: advP1.id,
  };
}

const dailyEntry = (
  date: string,
  attendance: { workerId: string; status: string; otHours?: string }[],
  expenses: object[] = [],
) => put('/daily-entry', { date, projectId: f.projectId, attendance, usage: [], expenses });

beforeAll(async () => {
  ctx = await createTestApp();
  await resetDb(ctx.prisma);
  cookie = await loginCookie(ctx);
  f = await fixture();
  // August 2026 (1 Aug is a Saturday)
  await dailyEntry(
    '2026-08-03',
    [
      { workerId: f.d1, status: 'PRESENT', otHours: '2' },
      { workerId: f.d2, status: 'PRESENT' },
      { workerId: f.p1, status: 'PRESENT' },
    ],
    [
      { category: 'SUBCONTRACT', description: 'Culvert labour', amount: '25000', paidBy: 'CASH' },
      { category: 'EQUIPMENT_HIRE', description: 'Roller hire', amount: '15000', paidBy: 'CASH' },
    ],
  ).expect(200);
  await dailyEntry('2026-08-04', [
    { workerId: f.d1, status: 'PRESENT' },
    { workerId: f.p1, status: 'ABSENT' },
  ]).expect(200);
  await dailyEntry('2026-08-05', [{ workerId: f.d1, status: 'HALF_DAY' }]).expect(200);
}, 60_000);

afterAll(async () => {
  await ctx.app.close();
});

describe('payroll', () => {
  let runId: string;
  const line = (run: { lines: { workerId: string }[] }, workerId: string) =>
    run.lines.find((l) => l.workerId === workerId) as Record<string, string>;

  it('generates a DRAFT with hand-checked numbers', async () => {
    const res = await post('/payroll/runs', { year: 2026, month: 8 }).expect(201);
    runId = res.body.id;
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.stale).toBe(false);
    expect(res.body.lines).toHaveLength(3);
    // D1: 4000 + 4000 + 2000 + OT 2 × (4000 / 8 × 1.5)
    expect(line(res.body, f.d1)).toMatchObject({
      daysWorked: '2.50',
      basicPay: '10000.00',
      otPay: '1500.00',
      grossPay: '11500.00',
      netPay: '11500.00',
    });
    // D2: an advance of 5000 larger than the pay → capped at 3000, net 0
    expect(line(res.body, f.d2)).toMatchObject({
      grossPay: '3000.00',
      advanceDeduction: '3000.00',
      netPay: '0.00',
      advanceBalance: '5000.00',
    });
    // P1: 78000 − 1 absence × 3000; EPF 8/12, ETF 3 on 75000; advance instalment 10000
    expect(line(res.body, f.p1)).toMatchObject({
      basicPay: '75000.00',
      epfEmployee: '6000.00',
      epfEmployer: '9000.00',
      etfEmployer: '2250.00',
      advanceDeduction: '10000.00',
      netPay: '59000.00',
    });
    expect(res.body.totals.grossPay).toBe('89500.00');
  });

  it('a draft goes stale when attendance changes, and cannot be finalized', async () => {
    await dailyEntry('2026-08-06', [{ workerId: f.d1, status: 'PRESENT' }]).expect(200);
    expect((await get(`/payroll/runs/${runId}`).expect(200)).body.stale).toBe(true);
    const res = await post(`/payroll/runs/${runId}/finalize`).expect(409);
    expect(res.body.code).toBe('PAYROLL_STALE');
    const again = await post('/payroll/runs', { year: 2026, month: 8 }).expect(201);
    expect(again.body.id).toBe(runId);
    expect(again.body.stale).toBe(false);
    expect(line(again.body, f.d1).grossPay).toBe('15500.00');
  });

  it('edits deductions in the draft and recomputes the net', async () => {
    const run = (await get(`/payroll/runs/${runId}`)).body;
    const l1 = line(run, f.d1);
    const l2 = line(run, f.d2);
    const l3 = line(run, f.p1);

    const tooMuch = await patch(`/payroll/runs/${runId}/lines/${l1.id}`, {
      advanceDeduction: '100',
    }).expect(400);
    expect(tooMuch.body.details[0]).toMatchObject({
      path: 'advanceDeduction',
      message: 'DEDUCTION_MORE_THAN_BALANCE',
    });
    const negative = await patch(`/payroll/runs/${runId}/lines/${l3.id}`, {
      otherDeductions: '60000',
    }).expect(400);
    expect(negative.body.details[0].message).toBe('NET_BELOW_ZERO');

    const e2 = await patch(`/payroll/runs/${runId}/lines/${l2.id}`, {
      advanceDeduction: '1000',
    }).expect(200);
    expect(e2.body.netPay).toBe('2000.00');
    const e3 = await patch(`/payroll/runs/${runId}/lines/${l3.id}`, {
      otherDeductions: '500',
      otherDeductionsNote: 'Uniform',
    }).expect(200);
    expect(e3.body).toMatchObject({ netPay: '58500.00', otherDeductionsNote: 'Uniform' });

    const totals = (await get(`/payroll/runs/${runId}`)).body.totals;
    expect(totals).toMatchObject({
      workers: 3,
      grossPay: '93500.00',
      epfEmployee: '6000.00',
      advanceDeduction: '11000.00',
      otherDeductions: '500.00',
      netPay: '76000.00',
      employerCost: '104750.00',
    });
  });

  it('finalize locks attendance, recovers advances and closes the fully recovered one', async () => {
    const res = await post(`/payroll/runs/${runId}/finalize`).expect(201);
    expect(res.body.status).toBe('FINALIZED');
    expect(res.body.canReopen).toBe(true);

    const locked = await dailyEntry('2026-08-04', [{ workerId: f.d1, status: 'ABSENT' }]).expect(
      409,
    );
    expect(locked.body.code).toBe('PAYROLL_LOCKED');
    expect(await ctx.prisma.attendance.count({ where: { payrollRunId: runId } })).toBe(7);

    const advances = (await get('/advances').expect(200)).body.items as Record<string, string>[];
    expect(advances.find((a) => a.id === f.advP1)).toMatchObject({
      status: 'RECOVERED',
      balance: '0.00',
    });
    expect(advances.find((a) => a.id === f.advD2)).toMatchObject({
      status: 'OPEN',
      recovered: '1000.00',
      balance: '4000.00',
    });

    const regen = await post('/payroll/runs', { year: 2026, month: 8 }).expect(409);
    expect(regen.body.code).toBe('PAYROLL_NOT_DRAFT');
    const edit = await patch(`/payroll/runs/${runId}/lines/${line(res.body, f.d1).id}`, {
      otherDeductions: '1',
    }).expect(409);
    expect(edit.body.code).toBe('PAYROLL_NOT_DRAFT');

    const slips = (await get(`/workers/${f.p1}/payslips`).expect(200)).body;
    expect(slips).toHaveLength(1);
    expect(slips[0]).toMatchObject({ netPay: '58500.00', run: { year: 2026, month: 8 } });
  });

  it('only the latest finalized month can be reopened; reopening reverses recoveries', async () => {
    const sep = await post('/payroll/runs', { year: 2026, month: 9 }).expect(201);
    // only the permanent worker (no attendance in September)
    expect(sep.body.lines).toHaveLength(1);
    await post(`/payroll/runs/${sep.body.id}/finalize`).expect(201);
    const notLatest = await post(`/payroll/runs/${runId}/reopen`).expect(409);
    expect(notLatest.body.code).toBe('PAYROLL_REOPEN_NOT_LATEST');

    await post(`/payroll/runs/${sep.body.id}/reopen`).expect(201);
    const reopened = await post(`/payroll/runs/${runId}/reopen`).expect(201);
    expect(reopened.body.status).toBe('DRAFT');
    expect(reopened.body.stale).toBe(false);
    expect(await ctx.prisma.advanceRecovery.count()).toBe(0);
    expect((await ctx.prisma.advance.findUniqueOrThrow({ where: { id: f.advP1 } })).status).toBe(
      'OPEN',
    );
    await dailyEntry('2026-08-05', [{ workerId: f.d1, status: 'HALF_DAY' }]).expect(200);
    // finalize again for the costing tests below
    await post('/payroll/runs', { year: 2026, month: 8 }).expect(201);
    await post(`/payroll/runs/${runId}/finalize`).expect(201);

    const list = (await get('/payroll/runs').expect(200)).body;
    expect(list.map((r: { month: number; status: string }) => [r.month, r.status])).toEqual([
      [9, 'DRAFT'],
      [8, 'FINALIZED'],
    ]);
  });
});

describe('project costs & health', () => {
  it('category totals equal the sum of their entries; labour uses the finalized payroll', async () => {
    const all = (await get(`/projects/${f.projectId}/costs?pageSize=100`).expect(200)).body;
    for (const c of all.byCategory as { category: string; actual: string }[]) {
      const res = await get(
        `/projects/${f.projectId}/costs?pageSize=100&category=${c.category}`,
      ).expect(200);
      const total = (res.body.entries.items as { amount: string }[]).reduce(
        (s, e) => s + Math.round(Number(e.amount) * 100),
        0,
      );
      expect(total).toBe(Math.round(Number(c.actual) * 100));
    }
    const labour = all.byCategory.find((c: { category: string }) => c.category === 'LABOUR');
    // D1 gross 15,500 + D2 3,000 + P1 employer cost (75,000 + EPF 9,000 + ETF 2,250), all here
    expect(labour).toMatchObject({ actual: '104750.00', budget: '100000.00', estimated: false });
    expect(labour.variance).toBe('-4750.00');
    const equipment = all.byCategory.find((c: { category: string }) => c.category === 'EQUIPMENT');
    expect(equipment.actual).toBe('15000.00');
    expect(all.total.actual).toBe('144750.00');
  });

  it('a date range limits the entries', async () => {
    const res = await get(
      `/projects/${f.projectId}/costs?from=2026-08-04&to=2026-08-04&category=LABOUR`,
    ).expect(200);
    // only D1 worked on 4 Aug (P1 was absent)
    expect(res.body.entries.items).toHaveLength(1);
    expect(res.body.entries.items[0].reference).toBe('W-0001');
    const bad = await get(`/projects/${f.projectId}/costs?from=2026-09-01&to=2026-08-01`).expect(
      400,
    );
    expect(bad.body.code).toBe('VALIDATION_FAILED');
  });

  it('health: three bars and flags (over budget in labour does not flag the whole project)', async () => {
    const h = (await get(`/projects/${f.projectId}/health`).expect(200)).body;
    expect(h).toMatchObject({ budgetPct: '85.15', physicalSource: 'NONE', physicalPct: '0.00' });
    expect(h.flags).toContain('COST_AHEAD_OF_PROGRESS');
    const all = (await get('/projects/health').expect(200)).body;
    expect(all.map((x: { projectId: string }) => x.projectId)).toContain(f.projectId);
  });
});

describe('BOQ, progress and bills', () => {
  const csv = [
    'Item No,Description,Unit,Quantity,Rate',
    '1. GENERAL,,,,',
    '1.1,Site clearance,m2,1000,100',
    '1.2,"Excavation, any soil",m3,200,"1,500"',
    '1.3,Concrete grade 25,m3,50,12000',
    '1.4,Bad row,m3,abc,10',
  ].join('\n');
  const items: Record<string, string> = {};

  it('imports a CSV: preview → confirm', async () => {
    const preview = await ctx
      .http()
      .post(`/projects/${f.projectId}/boq/import/preview`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from(csv), 'boq.csv')
      .expect(201);
    expect(preview.body).toMatchObject({ validCount: 3, errorCount: 1, total: '1000000.00' });
    expect(preview.body.rows[3].errors[0]).toEqual({
      field: 'quantity',
      message: 'INVALID_QUANTITY',
    });

    const wrongType = await ctx
      .http()
      .post(`/projects/${f.projectId}/boq/import/preview`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from('x'), 'boq.pdf')
      .expect(400);
    expect(wrongType.body.code).toBe('UNSUPPORTED_FILE_TYPE');

    const rows = (preview.body.rows as { errors: unknown[] }[])
      .filter((r) => !r.errors.length)
      .map(({ errors: _e, amount: _a, line: _l, ...r }: Record<string, unknown>) => r);
    const res = await post(`/projects/${f.projectId}/boq/import`, { rows }).expect(201);
    expect(res.body.map((i: { itemNo: string }) => i.itemNo)).toEqual(['1.1', '1.2', '1.3']);
    for (const i of res.body) items[i.itemNo] = i.id;
    expect(res.body[1]).toMatchObject({ quantity: '200.00', rate: '1500.00', amount: '300000.00' });
  });

  it('records progress; cannot go backwards; warns above the BOQ quantity', async () => {
    await post(`/projects/${f.projectId}/progress`, {
      date: '2026-08-31',
      items: [
        { boqItemId: items['1.1'], cumulativeQty: '1000' },
        { boqItemId: items['1.2'], cumulativeQty: '100' },
      ],
    }).expect(201);
    const back = await post(`/boq/${items['1.2']}/measurements`, {
      date: '2026-09-15',
      cumulativeQty: '80',
    }).expect(409);
    expect(back.body.code).toBe('MEASUREMENT_OUT_OF_ORDER');
    const over = await post(`/boq/${items['1.1']}/measurements`, {
      date: '2026-09-10',
      cumulativeQty: '1010',
    }).expect(201);
    expect(over.body.warnings).toEqual(['OVER_QUANTITY']);
    // put it back to 1000 on the same date (a same-day measurement is replaced)
    await post(`/boq/${items['1.1']}/measurements`, {
      date: '2026-09-10',
      cumulativeQty: '1000',
    }).expect(201);
    expect((await get(`/boq/${items['1.1']}/measurements`)).body).toHaveLength(2);

    const prog = (await get(`/projects/${f.projectId}/progress?asOf=2026-08-31`).expect(200)).body;
    expect(prog).toMatchObject({
      totalAmount: '1000000.00',
      totalDone: '250000.00',
      physicalPct: '25.00',
    });
    const del1 = await del(`/projects/${f.projectId}/boq/${items['1.1']}`).expect(409);
    expect(del1.body.code).toBe('BOQ_HAS_PROGRESS');
    const replace = await post(`/projects/${f.projectId}/boq/import`, {
      rows: [{ itemNo: '9', description: 'x', unit: 'nos', quantity: '1', rate: '1' }],
      replace: true,
    }).expect(409);
    expect(replace.body.code).toBe('BOQ_HAS_PROGRESS');
  });

  it('three bills: retention cap and advance recovery, statuses, payments, summary', async () => {
    const base = `/projects/${f.projectId}/certificates`;
    // Bill 1 — 250,000 done
    const preview = await post(`${base}/preview`, { periodTo: '2026-08-31' }).expect(201);
    expect(preview.body).toMatchObject({
      number: 1,
      code: 'IPC-PRJ-2026-001-01',
      periodFrom: '2026-08-01',
    });
    const b1 = (await post(base, { periodTo: '2026-08-31' }).expect(201)).body;
    expect(b1).toMatchObject({
      cumulativeWorkDone: '250000.00',
      grossThisBill: '250000.00',
      retentionDeducted: '25000.00',
      advanceRecovered: '50000.00',
      netPayable: '175000.00',
      status: 'DRAFT',
    });
    const dup = await post(base, { periodTo: '2026-09-30' }).expect(409);
    expect(dup.body.code).toBe('DRAFT_BILL_EXISTS');
    await post(`${base}/${b1.id}/status`, { status: 'CERTIFIED' }).expect(409);
    await post(`${base}/${b1.id}/status`, { status: 'SUBMITTED', date: '2026-09-02' }).expect(201);
    await post(`${base}/${b1.id}/status`, { status: 'CERTIFIED', date: '2026-09-10' }).expect(201);
    const unpaid = await post(`${base}/${b1.id}/status`, { status: 'PAID' }).expect(409);
    expect(unpaid.body.code).toBe('CERTIFICATE_NOT_PAID_IN_FULL');
    await post(`/projects/${f.projectId}/payments`, {
      date: '2026-08-05',
      amount: '100000',
      method: 'BANK_TRANSFER',
      kind: 'ADVANCE',
    }).expect(201);
    await post(`/projects/${f.projectId}/payments`, {
      date: '2026-09-20',
      amount: '175000',
      method: 'CHEQUE',
      kind: 'IPC_PAYMENT',
      certificateId: b1.id,
      reference: 'CHQ 104455',
    }).expect(201);
    const paid = await post(`${base}/${b1.id}/status`, { status: 'PAID' }).expect(201);
    expect(paid.body).toMatchObject({ status: 'PAID', paid: '175000.00' });

    // Bill 2 — cumulative 640,000: retention capped (50,000 − 25,000), advance fully recovered
    await post(`/projects/${f.projectId}/progress`, {
      date: '2026-09-30',
      items: [
        { boqItemId: items['1.2'], cumulativeQty: '200' },
        { boqItemId: items['1.3'], cumulativeQty: '20' },
      ],
    }).expect(201);
    const early = await post(base, { periodTo: '2026-08-31' }).expect(400);
    expect(early.body.details[0]).toMatchObject({
      path: 'periodTo',
      message: 'BEFORE_PREVIOUS_BILL',
    });
    const b2 = (await post(base, { periodTo: '2026-09-30' }).expect(201)).body;
    expect(b2).toMatchObject({
      periodFrom: '2026-09-01T00:00:00.000Z',
      cumulativeWorkDone: '640000.00',
      previousCertified: '250000.00',
      grossThisBill: '390000.00',
      retentionDeducted: '25000.00',
      advanceRecovered: '50000.00',
      netPayable: '315000.00',
    });
    expect(b2.calculation).toMatchObject({
      retentionCapReached: true,
      advanceFullyRecovered: true,
    });
    await post(`${base}/${b2.id}/status`, { status: 'SUBMITTED' }).expect(201);
    await post(`${base}/${b2.id}/status`, { status: 'CERTIFIED' }).expect(201);
    await post(`/projects/${f.projectId}/payments`, {
      date: '2026-10-10',
      amount: '100000',
      method: 'BANK_TRANSFER',
      kind: 'IPC_PAYMENT',
      certificateId: b2.id,
    }).expect(201);

    // Bill 3 — everything done; no retention / advance left; other deductions; manual override
    await post(`/boq/${items['1.3']}/measurements`, {
      date: '2026-10-31',
      cumulativeQty: '50',
    }).expect(201);
    const b3 = (
      await post(base, {
        periodTo: '2026-10-31',
        otherDeductions: '5000',
        otherDeductionsNote: 'LD',
      }).expect(201)
    ).body;
    expect(b3).toMatchObject({
      cumulativeWorkDone: '1000000.00',
      grossThisBill: '360000.00',
      retentionDeducted: '0.00',
      advanceRecovered: '0.00',
      netPayable: '355000.00',
    });
    const over = await patch(`${base}/${b3.id}`, { cumulativeWorkDone: '990000' }).expect(200);
    expect(over.body).toMatchObject({ grossThisBill: '350000.00', netPayable: '345000.00' });
    const reset = await patch(`${base}/${b3.id}`, { cumulativeWorkDone: '' }).expect(200);
    expect(reset.body.netPayable).toBe('355000.00');
    await post(`${base}/${b3.id}/status`, { status: 'SUBMITTED' }).expect(201);
    const locked = await patch(`${base}/${b3.id}`, { otherDeductions: '1' }).expect(409);
    expect(locked.body.code).toBe('CERTIFICATE_NOT_DRAFT');

    const summary = (await get(`/projects/${f.projectId}/finance-summary`).expect(200)).body;
    expect(summary).toMatchObject({
      effectiveContractValue: '1000000.00',
      billedToDate: '1000000.00',
      certifiedToDate: '640000.00',
      received: '375000.00',
      receivable: '570000.00', // 175,000 + 315,000 + 355,000 − 275,000
      retentionHeld: '50000.00',
      advanceRecovered: '100000.00',
      advanceBalance: '0.00',
    });

    // the rest of bill 2 and a retention release
    await post(`/projects/${f.projectId}/payments`, {
      date: '2026-10-20',
      amount: '215000',
      method: 'BANK_TRANSFER',
      kind: 'IPC_PAYMENT',
      certificateId: b2.id,
    }).expect(201);
    const release = await post(`/projects/${f.projectId}/payments`, {
      date: '2026-10-21',
      amount: '25000',
      method: 'CHEQUE',
      kind: 'RETENTION_RELEASE',
    }).expect(201);
    let s = (await get(`/projects/${f.projectId}/finance-summary`)).body;
    expect(s).toMatchObject({ receivable: '355000.00', retentionHeld: '25000.00' });
    await del(`/projects/${f.projectId}/payments/${release.body.id}`).expect(200);
    s = (await get(`/projects/${f.projectId}/finance-summary`)).body;
    expect(s.retentionHeld).toBe('50000.00');

    // a payment cannot point at a draft bill; deleting a bill payment un-pays it
    const list = (await get(base).expect(200)).body;
    expect(list.map((c: { status: string }) => c.status)).toEqual([
      'PAID',
      'CERTIFIED',
      'SUBMITTED',
    ]);
    const pays = (await get(`/projects/${f.projectId}/payments`)).body as {
      id: string;
      certificateId: string;
    }[];
    await del(
      `/projects/${f.projectId}/payments/${pays.find((p) => p.certificateId === b1.id)!.id}`,
    ).expect(200);
    expect((await get(`${base}/${b1.id}`)).body.status).toBe('CERTIFIED');
  });

  it('a variation raises the effective contract value only when approved', async () => {
    const v = await post(`/projects/${f.projectId}/variations`, {
      title: 'Extra side drain',
      date: '2026-10-01',
      amountChange: '120000',
    }).expect(201);
    expect(v.body).toMatchObject({ number: 1, status: 'PENDING' });
    await post(`/projects/${f.projectId}/boq`, {
      itemNo: 'V1.1',
      description: 'Side drain',
      unit: 'm',
      quantity: '40',
      rate: '3000',
      variationId: v.body.id,
    }).expect(201);
    let prog = (await get(`/projects/${f.projectId}/progress?asOf=2026-10-31`)).body;
    expect(prog.totalAmount).toBe('1000000.00');
    expect(prog.items.find((i: { itemNo: string }) => i.itemNo === 'V1.1').excluded).toBe(true);
    await patch(`/projects/${f.projectId}/variations/${v.body.id}`, { status: 'APPROVED' }).expect(
      200,
    );
    prog = (await get(`/projects/${f.projectId}/progress?asOf=2026-10-31`)).body;
    expect(prog.totalAmount).toBe('1120000.00');
    const s = (await get(`/projects/${f.projectId}/finance-summary`)).body;
    expect(s.effectiveContractValue).toBe('1120000.00');
    const busy = await del(`/projects/${f.projectId}/variations/${v.body.id}`).expect(409);
    expect(busy.body.code).toBe('CONFLICT');
  });

  it('the latest extension of time sets the revised end date', async () => {
    const base = `/projects/${f.projectId}/extensions`;
    const e1 = await post(base, {
      newEndDate: '2027-03-31',
      approvedDate: '2026-10-01',
      reference: 'EOT/1',
    }).expect(201);
    expect(e1.body.previousEndDate).toBe('2027-01-31T00:00:00.000Z');
    const e2 = await post(base, { newEndDate: '2027-04-30', approvedDate: '2026-10-10' }).expect(
      201,
    );
    expect(e2.body.previousEndDate).toBe('2027-03-31T00:00:00.000Z');
    expect((await get(`/projects/${f.projectId}`)).body.revisedEndDate).toBe(
      '2027-04-30T00:00:00.000Z',
    );
    await del(`${base}/${e2.body.id}`).expect(200);
    expect((await get(`/projects/${f.projectId}`)).body.revisedEndDate).toBe(
      '2027-03-31T00:00:00.000Z',
    );
    await del(`${base}/${e1.body.id}`).expect(200);
    expect((await get(`/projects/${f.projectId}`)).body.revisedEndDate).toBeNull();
    const bad = await post(base, { newEndDate: '2026-01-01', approvedDate: '2026-10-10' }).expect(
      400,
    );
    expect(bad.body.details[0].path).toBe('newEndDate');
  });
});

describe('bonds', () => {
  it('CRUD and expiring list', async () => {
    const base = `/projects/${f.projectId}/bonds`;
    const today = new Date();
    const inDays = (n: number) =>
      new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
    const perf = await post(base, {
      type: 'PERFORMANCE_BOND',
      bank: 'Bank of Ceylon',
      referenceNo: 'PB/2026/77',
      amount: '50000',
      issueDate: '2026-08-01',
      expiryDate: inDays(20),
    }).expect(201);
    expect(perf.body).toMatchObject({ status: 'ACTIVE', project: { code: 'PRJ-2026-001' } });
    const far = await post(base, {
      type: 'ADVANCE_PAYMENT_GUARANTEE',
      bank: "People's Bank",
      referenceNo: 'APG-1',
      amount: '100000',
      issueDate: '2026-08-01',
      expiryDate: inDays(200),
    }).expect(201);
    const bad = await post(base, {
      type: 'BID_BOND',
      bank: 'x',
      referenceNo: 'x',
      amount: '1',
      issueDate: '2026-08-10',
      expiryDate: '2026-08-01',
    }).expect(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');

    let expiring = (await get('/bonds?expiringWithin=30').expect(200)).body;
    expect(expiring.map((b: { id: string }) => b.id)).toEqual([perf.body.id]);
    await patch(`${base}/${perf.body.id}`, { status: 'RELEASED' }).expect(200);
    expiring = (await get('/bonds?expiringWithin=30')).body;
    expect(expiring).toHaveLength(0);
    expect((await get(base)).body).toHaveLength(2);
    await del(`${base}/${far.body.id}`).expect(200);
    expect((await get(base)).body).toHaveLength(1);
  });
});
