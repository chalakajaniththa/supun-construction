import { createHash, randomUUID } from 'node:crypto';
import {
  type ExpenseCategory,
  type ExpensePaidBy,
  type PaymentMethod,
  colomboInstant,
  dayToDate,
  weekdayOf,
} from '@sc/shared';
import { addDays } from '../common/dates/dates.js';
import { dec, roundMoney } from '../common/money/money.js';
import type { StorageService } from '../common/storage/storage.service.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { storageKeyFor } from '../modules/documents/documents.service.js';
import { lineAmount, weightedAverageCost } from '../modules/purchases/calc/stock.js';
import { makePdf } from './files.js';

/**
 * Step 3 sample history (overview §10): ~60 days ending today for the ONGOING projects —
 * allocations (also next week's plan), attendance, machine usage with meter progression,
 * expenses, purchases, store issues, supplier payments, advances and maintenance.
 * Today has allocations but no attendance yet, so Daily Entry is ready to try.
 * Deterministic: the same `today` always gives the same data.
 */

export interface SampleIds {
  projectIds: Map<string, string>;
  workerIds: Map<string, string>;
  assetIds: string[];
  supplierIds: string[];
  materialIds: Map<string, string>;
}

/** Days of history (attendance, usage, expenses) before today. */
export const HISTORY_DAYS = 60;
/** Days of planned allocations after today. */
const PLAN_AHEAD_DAYS = 7;
const DIESEL_PER_L = '305';

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
    /** A multiple of `step` between min and max. */
    step: (min: number, max: number, step: number) =>
      min + step * Math.floor(next() * (Math.floor((max - min) / step) + 1)),
  };
}

type ProjectKey = 'road' | 'school' | 'house';

/** Who works where (worker codes). W-0010 (electrician) alternates between school and house. */
const TEAMS: Record<ProjectKey, string[]> = {
  road: ['W-0003', 'W-0009', 'W-0012', 'W-0013', 'W-0014', 'W-0015', 'W-0019', 'W-0022'],
  school: [
    'W-0001',
    'W-0002',
    'W-0004',
    'W-0006',
    'W-0007',
    'W-0016',
    'W-0017',
    'W-0020',
    'W-0023',
  ],
  house: ['W-0005', 'W-0008', 'W-0011', 'W-0018', 'W-0021', 'W-0024'],
};

const PERMANENT = new Set(['W-0019', 'W-0020', 'W-0021', 'W-0022', 'W-0023', 'W-0024', 'W-0025']);

/** Joined-date offsets of the sample workers that joined recently (see sample-data WORKERS). */
const JOINED: Record<string, number> = { 'W-0017': -90, 'W-0018': -45, 'W-0016': -150 };

interface AssetPlan {
  /** index in sample-data ASSETS */
  index: number;
  /** project for a given working day, or one entry per half day for a same-day move */
  plan: (day: string, offset: number) => { project: ProjectKey; start: string; end: string }[];
  operator?: string;
  /** hours per full day (HOURS meters) or km per day (KM meters) */
  perDay: [number, number];
  /** litres per hour (HOURS) or km per litre (KM); 0 = no fuel logged */
  fuel: number;
}

const FULL = (project: ProjectKey) => [{ project, start: '07:30', end: '17:00' }];

const ASSET_PLANS: AssetPlan[] = [
  // JCB 1 — road, every working day
  { index: 0, plan: () => FULL('road'), operator: 'W-0022', perDay: [6, 8.5], fuel: 6 },
  // JCB 2 — Mon/Wed/Fri: road in the morning, house in the afternoon (same-day move); else school
  {
    index: 1,
    plan: (day) =>
      [1, 3, 5].includes(weekdayOf(day))
        ? [
            { project: 'road', start: '07:30', end: '12:00' },
            { project: 'house', start: '13:00', end: '17:00' },
          ]
        : FULL('school'),
    perDay: [6, 8],
    fuel: 6,
  },
  // Excavator — road until three weeks ago, then the school foundations
  {
    index: 2,
    plan: (_day, offset) => FULL(offset < -21 ? 'road' : 'school'),
    perDay: [5.5, 8],
    fuel: 12,
  },
  // Tipper 1 — road; Tipper 2 — school (km)
  { index: 3, plan: () => FULL('road'), operator: 'W-0009', perDay: [40, 140], fuel: 4 },
  { index: 4, plan: () => FULL('school'), operator: 'W-0023', perDay: [30, 110], fuel: 4.2 },
  // Roller — road on Tue/Thu/Sat
  {
    index: 6,
    plan: (day) => ([2, 4, 6].includes(weekdayOf(day)) ? FULL('road') : []),
    perDay: [4, 7],
    fuel: 5,
  },
  // Concrete mixer 1 — school
  { index: 7, plan: () => FULL('school'), perDay: [4, 7], fuel: 0 },
  // Water bowser — road on Mon/Wed/Fri
  {
    index: 9,
    plan: (day) => ([1, 3, 5].includes(weekdayOf(day)) ? FULL('road') : []),
    perDay: [20, 60],
    fuel: 5,
  },
  // Generator — house
  { index: 10, plan: () => FULL('house'), perDay: [3, 6], fuel: 3 },
  // Plate compactor — house on Tue/Thu
  {
    index: 11,
    plan: (day) => ([2, 4].includes(weekdayOf(day)) ? FULL('house') : []),
    perDay: [3, 5],
    fuel: 0,
  },
];

/** Daily expense ideas per project: [category, description, min, max, paidBy?]. */
const EXPENSE_IDEAS: Record<
  ProjectKey,
  [ExpenseCategory, string, number, number, ExpensePaidBy?][]
> = {
  road: [
    ['MEALS', 'Tea and lunch for the site team', 2500, 4800],
    ['TRANSPORT', 'Lorry hire – carting gravel', 9000, 18000],
    ['SMALL_TOOLS', 'Shovels and mammoties', 3500, 9000],
    ['PERMITS_FEES', 'Police traffic control fee', 2500, 5000],
    ['UTILITIES', 'Water for compaction (bowser refill)', 1500, 3500],
    ['TRANSPORT', 'Labour transport – Hingurakgoda', 2000, 4000],
    ['REPAIRS', 'Puncture repair – tipper', 1200, 3500],
  ],
  school: [
    ['MEALS', 'Tea and lunch for the site team', 2500, 5200],
    ['TRANSPORT', 'Tractor hire – moving blocks', 4000, 8000],
    ['SMALL_TOOLS', 'Trowels, levels and spirit levels', 2500, 7000],
    ['UTILITIES', 'Electricity bill share (site connection)', 3000, 6500],
    ['TRANSPORT', 'Three-wheeler – urgent hardware', 800, 1800],
    ['OFFICE', 'Site register books and photocopies', 600, 1500],
  ],
  house: [
    ['MEALS', 'Tea for workers', 900, 2200],
    ['TRANSPORT', 'Tractor hire – sand to site', 3500, 6000],
    ['SMALL_TOOLS', 'Drill bits and cutting discs', 1500, 4500],
    ['UTILITIES', 'Water bill share', 800, 1800],
    ['OTHER', 'Security guard – night', 2500, 3000],
  ],
};

export async function seedOperations(
  prisma: PrismaClient,
  ids: SampleIds,
  today: string,
  storage?: StorageService,
): Promise<void> {
  const r = rng(Number(today.replaceAll('-', '')) % 2_147_483_647);
  const day = (offset: number) => addDays(today, offset);
  const isWorkday = (d: string) => weekdayOf(d) !== 0;
  const projectId = (k: ProjectKey) => ids.projectIds.get(k)!;
  const workerId = (code: string) => ids.workerIds.get(code)!;
  const supplier = (n: number) => ids.supplierIds[n - 1]!;
  const material = (name: string) => ids.materialIds.get(name)!;

  // ── Worker allocations & attendance ──
  const workerAllocs: Prisma.WorkerAllocationCreateManyInput[] = [];
  const attendance: Prisma.AttendanceCreateManyInput[] = [];
  for (let offset = -HISTORY_DAYS; offset <= PLAN_AHEAD_DAYS; offset++) {
    const d = day(offset);
    if (!isWorkday(d)) continue;
    const assignments: [string, ProjectKey][] = [];
    for (const [project, team] of Object.entries(TEAMS) as [ProjectKey, string[]][]) {
      for (const code of team) assignments.push([code, project]);
    }
    // the electrician: school on Mon/Wed/Fri, house on Tue/Thu/Sat
    assignments.push(['W-0010', [1, 3, 5].includes(weekdayOf(d)) ? 'school' : 'house']);
    for (const [code, project] of assignments) {
      if (JOINED[code] !== undefined && offset < JOINED[code]) continue;
      // W-0024 (driver) also helps the road in the afternoons on Saturdays: a same-day move.
      const split = code === 'W-0024' && weekdayOf(d) === 6;
      workerAllocs.push({
        workerId: workerId(code),
        projectId: projectId(project),
        startAt: colomboInstant(d, '08:00'),
        endAt: colomboInstant(d, split ? '12:00' : '17:00'),
      });
      if (split) {
        workerAllocs.push({
          workerId: workerId(code),
          projectId: projectId('road'),
          startAt: colomboInstant(d, '13:00'),
          endAt: colomboInstant(d, '17:00'),
          notes: 'Afternoon at the road site',
        });
      }
      if (offset >= 0) continue; // today and later: planned only
      const roll = r.next();
      const status =
        roll < 0.86
          ? 'PRESENT'
          : roll < 0.92
            ? 'HALF_DAY'
            : PERMANENT.has(code) && roll < 0.96
              ? 'LEAVE'
              : 'ABSENT';
      const ot = status === 'PRESENT' && r.chance(0.22) ? r.step(1, 3, 0.5) : 0;
      attendance.push({
        workerId: workerId(code),
        projectId: projectId(project),
        date: dayToDate(d),
        status,
        otHours: String(ot),
        notes:
          status === 'ABSENT' && r.chance(0.4)
            ? r.pick(['Sick', 'Did not come', 'Family matter'])
            : status === 'LEAVE'
              ? 'Annual leave'
              : null,
      });
    }
  }
  await prisma.workerAllocation.createMany({ data: workerAllocs });
  await prisma.attendance.createMany({ data: attendance });

  // ── Asset allocations, usage logs (meters run up to today's reading) ──
  const assetAllocs: Prisma.AssetAllocationCreateManyInput[] = [];
  const logs: (Prisma.AssetUsageLogCreateManyInput & { amount: number })[] = [];
  const assets = await prisma.asset.findMany({ where: { id: { in: ids.assetIds } } });
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const meterHistory = new Map<string, { day: string; end: number }[]>();
  for (const plan of ASSET_PLANS) {
    const assetId = ids.assetIds[plan.index]!;
    const asset = assetById.get(assetId)!;
    const assetLogs: (typeof logs)[number][] = [];
    for (let offset = -HISTORY_DAYS; offset <= PLAN_AHEAD_DAYS; offset++) {
      const d = day(offset);
      if (!isWorkday(d)) continue;
      const parts = plan.plan(d, offset);
      for (const part of parts) {
        assetAllocs.push({
          assetId,
          projectId: projectId(part.project),
          startAt: colomboInstant(d, part.start),
          endAt: colomboInstant(d, part.end),
          operatorWorkerId: plan.operator ? workerId(plan.operator) : null,
        });
        if (offset >= 0 || r.chance(0.07)) continue; // planned only / idle that day
        const share = parts.length > 1 ? 0.5 : 1;
        const amount =
          Math.round((plan.perDay[0] + r.next() * (plan.perDay[1] - plan.perDay[0])) * share * 10) /
          10;
        assetLogs.push({
          assetId,
          projectId: projectId(part.project),
          date: dayToDate(d),
          hoursUsed: '0',
          operatorWorkerId: plan.operator ? workerId(plan.operator) : null,
          amount,
        });
      }
    }
    // Meters: the last log ends at today's reading.
    const total = assetLogs.reduce((s, l) => s + l.amount, 0);
    let meter = Number(asset.currentMeter) - total;
    const history: { day: string; end: number }[] = [];
    for (const l of assetLogs) {
      const start = meter;
      meter = Math.round((meter + l.amount) * 10) / 10;
      const litres =
        plan.fuel === 0
          ? 0
          : asset.meterType === 'KM'
            ? Math.round((l.amount / plan.fuel) * 10) / 10
            : Math.round(l.amount * plan.fuel * 10) / 10;
      if (asset.meterType === 'HOURS') {
        l.startMeter = start.toFixed(1);
        l.endMeter = meter.toFixed(1);
        l.hoursUsed = l.amount.toFixed(1);
      } else if (asset.meterType === 'KM') {
        l.startMeter = start.toFixed(1);
        l.endMeter = meter.toFixed(1);
        l.hoursUsed = String(r.step(6, 9, 0.5));
      } else {
        l.hoursUsed = l.amount.toFixed(1);
      }
      if (litres > 0) {
        l.fuelLitres = litres.toFixed(1);
        l.fuelCost = roundMoney(dec(litres.toFixed(1)).times(DIESEL_PER_L)).toFixed(2);
      }
      history.push({ day: (l.date as Date).toISOString().slice(0, 10), end: meter });
      logs.push(l);
    }
    if (asset.meterType !== 'NONE') meterHistory.set(assetId, history);
  }
  await prisma.assetAllocation.createMany({ data: assetAllocs });
  await prisma.assetUsageLog.createMany({ data: logs.map(({ amount: _amount, ...l }) => l) });

  // ── Maintenance: last services chosen so that service states vary ──
  // fraction of the interval used since the last service → OK / DUE_SOON / OVERDUE
  const serviceFractions: Record<number, number> = {
    0: 0.93, // JCB 1 — due soon
    1: 0.4,
    2: 0.62,
    3: 0.95, // Tipper 1 — due soon
    4: 0.55,
    5: 0.3,
    6: 1.06, // Roller — overdue
    9: 0.72,
    10: 0.35,
  };
  const maintenance: Prisma.MaintenanceRecordCreateManyInput[] = [];
  for (const [index, fraction] of Object.entries(serviceFractions)) {
    const assetId = ids.assetIds[Number(index)]!;
    const a = assetById.get(assetId)!;
    if (!a.serviceIntervalMeter) continue;
    const last =
      Math.round((Number(a.currentMeter) - fraction * Number(a.serviceIntervalMeter)) * 10) / 10;
    const history = meterHistory.get(assetId) ?? [];
    const when = history.find((h) => h.end >= last)?.day ?? day(-HISTORY_DAYS - r.int(5, 40));
    await prisma.asset.update({
      where: { id: assetId },
      data: { lastServiceMeter: last.toFixed(1) },
    });
    const unit = a.meterType === 'KM' ? 'km' : 'hour';
    maintenance.push({
      assetId,
      date: dayToDate(when),
      type: 'SERVICE',
      description: `${Number(a.serviceIntervalMeter)} ${unit} service – oil, filters, greasing`,
      meterReading: last.toFixed(1),
      cost: String(a.meterType === 'KM' ? r.step(28000, 46000, 500) : r.step(38000, 72000, 500)),
      supplierId: null,
    });
  }
  maintenance.push(
    {
      assetId: ids.assetIds[0]!,
      date: dayToDate(day(-34)),
      type: 'REPAIR',
      description: 'Hydraulic hose replaced (backhoe arm)',
      cost: '18500',
    },
    {
      assetId: ids.assetIds[3]!,
      date: dayToDate(day(-22)),
      type: 'TYRE',
      description: 'Two rear tyres replaced',
      cost: '186000',
      supplierId: supplier(5),
    },
    {
      assetId: ids.assetIds[8]!,
      date: dayToDate(day(-3)),
      type: 'REPAIR',
      description: 'Drum gear box broken – sent for repair',
      cost: '42000',
    },
    {
      assetId: ids.assetIds[4]!,
      date: dayToDate(day(-48)),
      type: 'OTHER',
      description: 'Brake adjustment and new wiper blades',
      cost: '6500',
      supplierId: supplier(5),
    },
  );
  await prisma.maintenanceRecord.createMany({ data: maintenance });

  // ── Expenses (~150) ──
  const expenses: Prisma.ExpenseCreateManyInput[] = [];
  for (let offset = -HISTORY_DAYS; offset < 0; offset++) {
    const d = day(offset);
    if (!isWorkday(d)) continue;
    for (const project of ['road', 'school', 'house'] as ProjectKey[]) {
      if (!r.chance(project === 'house' ? 0.55 : 0.8)) continue;
      const [category, description, min, max, paidBy] = r.pick(EXPENSE_IDEAS[project]);
      expenses.push({
        date: dayToDate(d),
        projectId: projectId(project),
        category,
        description,
        amount: String(r.step(min, max, 50)),
        paidBy: paidBy ?? (r.chance(0.85) ? 'CASH' : 'BANK'),
        assetId: category === 'REPAIRS' ? ids.assetIds[3]! : null,
      });
    }
    // weekly items
    if (weekdayOf(d) === 6) {
      expenses.push({
        date: dayToDate(d),
        projectId: projectId('road'),
        category: 'EQUIPMENT_HIRE',
        description: 'Motor grader hire – 1 day',
        amount: String(r.step(42000, 48000, 1000)),
        paidBy: 'CREDIT',
        supplierId: supplier(7),
      });
      expenses.push({
        date: dayToDate(d),
        projectId: projectId('school'),
        category: 'SUBCONTRACT',
        description: 'Electrical wiring – weekly progress payment',
        amount: String(r.step(35000, 55000, 2500)),
        paidBy: 'CREDIT',
        supplierId: supplier(6),
      });
    }
    if (weekdayOf(d) === 1) {
      expenses.push({
        date: dayToDate(d),
        projectId: null,
        assetId: ids.assetIds[5]!,
        category: 'FUEL',
        description: 'Petrol for the double cab',
        amount: String(r.step(9000, 15000, 500)),
        paidBy: 'CREDIT',
        supplierId: supplier(4),
      });
    }
  }
  expenses.push(
    {
      date: dayToDate(day(-41)),
      projectId: null,
      category: 'OFFICE',
      description: 'Printer cartridge and paper (office)',
      amount: '7850',
      paidBy: 'CASH',
    },
    {
      date: dayToDate(day(-12)),
      projectId: projectId('house'),
      category: 'PERMITS_FEES',
      description: 'Pradeshiya Sabha building permit stamp',
      amount: '12500',
      paidBy: 'BANK',
    },
  );
  await prisma.expense.createMany({ data: expenses });

  // ── Purchases (~25) and store issues (~15) ──
  type Line = { m: string; qty: string; price: string; project?: ProjectKey };
  const purchasePlan: {
    offset: number;
    supplier: number;
    credit: boolean;
    invoice: string;
    lines: Line[];
  }[] = [
    {
      offset: -58,
      supplier: 1,
      credit: true,
      invoice: 'PCD/1452',
      lines: [{ m: 'Cement (50 kg bag)', qty: '400', price: '2180' }],
    },
    {
      offset: -57,
      supplier: 3,
      credit: true,
      invoice: 'MSM-0871',
      lines: [{ m: 'ABC (aggregate base course)', qty: '45', price: '9800', project: 'road' }],
    },
    {
      offset: -55,
      supplier: 2,
      credit: true,
      invoice: 'LHS-22081',
      lines: [
        { m: 'Steel bar 12 mm', qty: '1500', price: '298' },
        { m: 'Steel bar 10 mm', qty: '800', price: '305' },
        { m: 'Binding wire', qty: '60', price: '450' },
      ],
    },
    {
      offset: -53,
      supplier: 3,
      credit: false,
      invoice: 'MSM-0880',
      lines: [
        { m: 'River sand', qty: '6', price: '18500', project: 'school' },
        { m: 'Metal ¾"', qty: '5', price: '14500', project: 'school' },
      ],
    },
    {
      offset: -50,
      supplier: 8,
      credit: false,
      invoice: 'WTD-301',
      lines: [
        { m: 'Formwork timber', qty: '120', price: '1350', project: 'school' },
        { m: 'Plywood sheet 12 mm', qty: '20', price: '6800', project: 'school' },
      ],
    },
    {
      offset: -48,
      supplier: 1,
      credit: true,
      invoice: 'PCD/1490',
      lines: [{ m: 'Cement block 6"', qty: '2500', price: '95', project: 'house' }],
    },
    {
      offset: -46,
      supplier: 3,
      credit: true,
      invoice: 'MSM-0902',
      lines: [
        { m: 'ABC (aggregate base course)', qty: '60', price: '9800', project: 'road' },
        { m: 'Metal 1½"', qty: '12', price: '13500', project: 'road' },
      ],
    },
    {
      offset: -44,
      supplier: 2,
      credit: false,
      invoice: 'LHS-22140',
      lines: [
        { m: 'Nails (assorted)', qty: '40', price: '520' },
        { m: 'PVC pipe 4"', qty: '30', price: '3600' },
      ],
    },
    {
      offset: -41,
      supplier: 1,
      credit: true,
      invoice: 'PCD/1533',
      lines: [{ m: 'Cement (50 kg bag)', qty: '300', price: '2220' }],
    },
    {
      offset: -39,
      supplier: 4,
      credit: true,
      invoice: 'KFS-7788',
      lines: [{ m: 'Bitumen emulsion (CRS-1)', qty: '1200', price: '420', project: 'road' }],
    },
    {
      offset: -37,
      supplier: 3,
      credit: false,
      invoice: 'MSM-0931',
      lines: [
        { m: 'River sand', qty: '4', price: '18500', project: 'house' },
        { m: 'Quarry dust', qty: '3', price: '9500', project: 'house' },
      ],
    },
    {
      offset: -34,
      supplier: 2,
      credit: true,
      invoice: 'LHS-22219',
      lines: [
        { m: 'Steel bar 16 mm', qty: '1200', price: '295' },
        { m: 'Steel bar 12 mm', qty: '600', price: '300' },
      ],
    },
    {
      offset: -31,
      supplier: 3,
      credit: true,
      invoice: 'MSM-0955',
      lines: [
        { m: 'Metal ¾"', qty: '8', price: '14500', project: 'school' },
        { m: 'River sand', qty: '6', price: '18800', project: 'school' },
      ],
    },
    {
      offset: -29,
      supplier: 1,
      credit: false,
      invoice: 'PCD/1570',
      lines: [{ m: 'Clay brick', qty: '4000', price: '28', project: 'house' }],
    },
    {
      offset: -26,
      supplier: 8,
      credit: true,
      invoice: 'WTD-322',
      lines: [{ m: 'Formwork timber', qty: '80', price: '1380', project: 'school' }],
    },
    {
      offset: -24,
      supplier: 3,
      credit: true,
      invoice: 'MSM-0978',
      lines: [{ m: 'ABC (aggregate base course)', qty: '50', price: '9900', project: 'road' }],
    },
    {
      offset: -22,
      supplier: 1,
      credit: true,
      invoice: 'PCD/1602',
      lines: [{ m: 'Cement (50 kg bag)', qty: '350', price: '2250' }],
    },
    {
      offset: -19,
      supplier: 2,
      credit: false,
      invoice: 'LHS-22301',
      lines: [
        { m: 'Roofing sheet (amano)', qty: '24', price: '4200', project: 'house' },
        { m: 'Nails (assorted)', qty: '15', price: '520' },
      ],
    },
    {
      offset: -17,
      supplier: 3,
      credit: false,
      invoice: 'MSM-0999',
      lines: [{ m: 'Metal 1½"', qty: '10', price: '13500', project: 'road' }],
    },
    {
      offset: -15,
      supplier: 2,
      credit: true,
      invoice: 'LHS-22350',
      lines: [
        { m: 'Steel bar 10 mm', qty: '700', price: '310' },
        { m: 'Binding wire', qty: '40', price: '455' },
      ],
    },
    {
      offset: -12,
      supplier: 4,
      credit: true,
      invoice: 'KFS-7841',
      lines: [{ m: 'Bitumen emulsion (CRS-1)', qty: '800', price: '425', project: 'road' }],
    },
    {
      offset: -10,
      supplier: 3,
      credit: true,
      invoice: 'MSM-1017',
      lines: [
        { m: 'River sand', qty: '5', price: '18800', project: 'school' },
        { m: 'Quarry dust', qty: '4', price: '9500', project: 'house' },
      ],
    },
    {
      offset: -8,
      supplier: 2,
      credit: false,
      invoice: 'LHS-22398',
      lines: [{ m: 'Emulsion paint', qty: '40', price: '1950', project: 'house' }],
    },
    {
      offset: -5,
      supplier: 1,
      credit: true,
      invoice: 'PCD/1649',
      lines: [
        { m: 'Cement block 6"', qty: '1800', price: '96', project: 'school' },
        { m: 'Cement (50 kg bag)', qty: '200', price: '2260' },
      ],
    },
    {
      offset: -2,
      supplier: 8,
      credit: false,
      invoice: 'WTD-340',
      lines: [{ m: 'Plywood sheet 12 mm', qty: '10', price: '6900', project: 'house' }],
    },
  ];
  const storeLines = new Map<string, { date: string; quantity: string; amount: string }[]>();
  for (const p of purchasePlan) {
    const date = day(p.offset);
    const lines = p.lines.map((l) => ({
      materialId: material(l.m),
      quantity: l.qty,
      unitPrice: l.price,
      amount: lineAmount(l.qty, l.price).toFixed(2),
      projectId: l.project ? projectId(l.project) : null,
    }));
    const total = lines.reduce((s, l) => s.plus(l.amount), dec(0));
    await prisma.purchase.create({
      data: {
        supplierId: supplier(p.supplier),
        date: dayToDate(date),
        invoiceNo: p.invoice,
        paymentType: p.credit ? 'CREDIT' : 'CASH',
        total: total.toFixed(2),
        lines: { create: lines },
      },
    });
    for (const l of lines) {
      if (l.projectId) continue;
      const list = storeLines.get(l.materialId) ?? [];
      list.push({ date, quantity: l.quantity, amount: l.amount });
      storeLines.set(l.materialId, list);
    }
  }

  const issuePlan: [number, string, ProjectKey, string][] = [
    [-56, 'Cement (50 kg bag)', 'school', '120'],
    [-54, 'Cement (50 kg bag)', 'road', '60'],
    [-52, 'Steel bar 12 mm', 'school', '900'],
    [-51, 'Binding wire', 'school', '25'],
    [-49, 'Steel bar 10 mm', 'house', '350'],
    [-45, 'Cement (50 kg bag)', 'house', '90'],
    [-42, 'PVC pipe 4"', 'road', '18'],
    [-38, 'Cement (50 kg bag)', 'school', '150'],
    [-33, 'Steel bar 16 mm', 'school', '700'],
    [-30, 'Nails (assorted)', 'school', '20'],
    [-27, 'Cement (50 kg bag)', 'road', '110'],
    [-20, 'Cement (50 kg bag)', 'house', '120'],
    [-16, 'Steel bar 12 mm', 'house', '450'],
    [-13, 'Steel bar 10 mm', 'school', '500'],
    [-9, 'Cement (50 kg bag)', 'school', '160'],
    [-6, 'Binding wire', 'house', '20'],
    [-3, 'Cement (50 kg bag)', 'road', '80'],
  ];
  const issued = new Map<string, number>();
  const issues: Prisma.MaterialIssueCreateManyInput[] = [];
  for (const [offset, m, project, qty] of issuePlan) {
    const date = day(offset);
    const materialId = material(m);
    const bought = (storeLines.get(materialId) ?? []).filter((l) => l.date <= date);
    const inStore =
      bought.reduce((s, l) => s + Number(l.quantity), 0) - (issued.get(materialId) ?? 0);
    if (inStore < Number(qty)) continue; // never issue more than the store holds
    issued.set(materialId, (issued.get(materialId) ?? 0) + Number(qty));
    issues.push({
      materialId,
      projectId: projectId(project),
      date: dayToDate(date),
      quantity: qty,
      unitCost: weightedAverageCost(bought).toFixed(2),
      notes: r.chance(0.3) ? 'Taken by the site supervisor' : null,
    });
  }
  await prisma.materialIssue.createMany({ data: issues });

  // ── Supplier payments (leave realistic balances) ──
  const payments: [number, number, string, PaymentMethod, string | null][] = [
    [-40, 1, '872000', 'CHEQUE', 'BOC 004512'],
    [-20, 1, '600000', 'CHEQUE', 'BOC 004538'],
    [-8, 1, '900000', 'CHEQUE', 'BOC 004577'],
    [-35, 2, '450000', 'BANK_TRANSFER', 'TRF 88213'],
    [-11, 2, '300000', 'CHEQUE', 'BOC 004561'],
    [-45, 3, '441000', 'CHEQUE', 'BOC 004520'],
    [-21, 3, '700000', 'BANK_TRANSFER', 'TRF 88407'],
    [-30, 4, '504000', 'CHEQUE', 'BOC 004544'],
    [-14, 4, '60000', 'CASH', null],
    [-28, 6, '150000', 'CHEQUE', 'BOC 004549'],
    [-7, 7, '180000', 'BANK_TRANSFER', 'TRF 88690'],
    [-16, 8, '110400', 'CASH', null],
  ];
  await prisma.supplierPayment.createMany({
    data: payments.map(([offset, s, amount, method, reference]) => ({
      supplierId: supplier(s),
      date: dayToDate(day(offset)),
      amount,
      method,
      reference,
      notes: method === 'CASH' ? 'Paid at the shop' : null,
    })),
  });

  // ── Advances (~8) ──
  const advances: [string, number, string, string | null, string][] = [
    ['W-0001', -52, '25000', '5000', 'School fees for children'],
    ['W-0003', -47, '15000', '5000', 'Medical expenses'],
    ['W-0012', -38, '10000', '2500', 'House repair'],
    ['W-0006', -30, '20000', '5000', 'Wedding in the family'],
    ['W-0019', -26, '50000', '10000', 'Motorcycle repair'],
    ['W-0013', -15, '8000', null, 'Festival advance'],
    ['W-0022', -9, '30000', '7500', 'Medical expenses'],
    ['W-0016', -4, '6000', '3000', 'Personal'],
  ];
  await prisma.advance.createMany({
    data: advances.map(([code, offset, amount, perMonth, reason]) => ({
      workerId: workerId(code),
      date: dayToDate(day(offset)),
      amount,
      recoveryPerMonth: perMonth,
      reason,
    })),
  });

  if (storage) await seedReceipts(prisma, storage, today, r.int);
}

/** A few expenses get a scanned receipt (a tiny generated PDF) as a project RECEIPT document. */
async function seedReceipts(
  prisma: PrismaClient,
  storage: StorageService,
  today: string,
  int: (min: number, max: number) => number,
): Promise<void> {
  const candidates = await prisma.expense.findMany({
    where: { projectId: { not: null }, amount: { gte: 9000 } },
    orderBy: { date: 'desc' },
    take: 40,
    include: { project: { select: { name: true } } },
  });
  const chosen = candidates.filter((_, i) => i % 6 === 0).slice(0, 6);
  for (const e of chosen) {
    const documentId = randomUUID();
    const fileName = `receipt-${e.date.toISOString().slice(0, 10)}-${int(100, 999)}.pdf`;
    const data = makePdf([
      'RECEIPT',
      e.description,
      `Amount: Rs. ${Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `Date: ${e.date.toISOString().slice(0, 10)}`,
      e.project?.name ?? '',
      '',
      'SAMPLE DOCUMENT - for trying out the system',
    ]);
    const key = storageKeyFor(documentId, 1, fileName);
    await storage.putObject({ key, body: data, contentType: 'application/pdf' });
    await prisma.$transaction(async (tx) => {
      await tx.document.create({
        data: {
          id: documentId,
          ownerType: 'PROJECT',
          ownerId: e.projectId,
          category: 'RECEIPT',
          title: `Receipt – ${e.description}`,
          versions: {
            create: {
              versionNo: 1,
              storageKey: key,
              fileName,
              mimeType: 'application/pdf',
              sizeBytes: data.length,
              sha256: createHash('sha256').update(data).digest('hex'),
              issueDate: e.date,
              uploadedAt: new Date(`${today}T00:00:00Z`),
            },
          },
        },
      });
      const v = await tx.documentVersion.findFirstOrThrow({ where: { documentId } });
      await tx.document.update({ where: { id: documentId }, data: { currentVersionId: v.id } });
      await tx.expense.update({ where: { id: e.id }, data: { receiptDocumentId: documentId } });
    });
  }
}
