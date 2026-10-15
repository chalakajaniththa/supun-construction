import {
  type BondStatus,
  type BondType,
  type ExpenseCategory,
  certificateCreateSchema,
  clientPaymentCreateSchema,
  dayToDate,
} from '@sc/shared';
import { addDays } from '../common/dates/dates.js';
import { dec, roundMoney, roundQty, sum } from '../common/money/money.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { BillingService } from '../modules/billing/billing.service.js';
import { BoqService } from '../modules/boq/boq.service.js';
import { PayrollService } from '../modules/payroll/payroll.service.js';
import { SettingsService } from '../modules/settings/settings.service.js';
import type { SampleIds } from './sample-operations.js';

/**
 * Step 4 sample data — contractor finance (overview §10, step 4.5):
 * - BOQs for the four government projects with measurements at realistic dates
 * - an approved variation (extra pipe culvert on the road) and a pending one (drain)
 * - an extension of time (the drain, on hold)
 * - IPCs: road IPC-01 PAID + IPC-02 CERTIFIED (unpaid), school IPC-01 SUBMITTED, the completed
 *   culvert fully billed and paid with half of the retention still held
 * - mobilization advances (road partly recovered), bonds (one expiring in ~20 days, a released bid bond)
 * - costs from before the 60-day operations history, so the projects tell a story:
 *   road healthy, school behind schedule, drain over budget, house healthy
 * - last month's payroll FINALIZED (recovers part of the advances); this month left to generate
 *
 * Bills, measurements and payroll go through the real services, so every number is exactly what
 * the app itself would calculate.
 */

type ProjectKey = 'road' | 'school' | 'culvert' | 'house' | 'shop' | 'drain';

/** [itemNo, description, unit, quantity, rate, cumulative fraction done at each progress date] */
type BoqLine = [string, string, string, string, string, number[]];

interface SampleBoq {
  project: ProjectKey;
  /** Days from today of each measurement. */
  dates: number[];
  items: BoqLine[];
}

// Road: measurements 110, 70, 40 and 12 days ago. IPC-01 to −70, IPC-02 to −40.
const ROAD: SampleBoq = {
  project: 'road',
  dates: [-110, -70, -40, -12],
  items: [
    ['1.1', 'Mobilisation and site establishment', 'LS', '1', '409160', [1, 1, 1, 1]],
    ['1.2', 'Setting out and survey', 'LS', '1', '116455', [1, 1, 1, 1]],
    [
      '1.3',
      'Traffic management during construction',
      'month',
      '9',
      '28325',
      [0.12, 0.29, 0.36, 0.44],
    ],
    ['2.1', 'Site clearance and grubbing', 'm2', '16800', '30', [0.6, 0.85, 0.85, 0.85]],
    ['2.2', 'Removal of trees (girth under 1 m)', 'nos', '18', '4090', [1, 1, 1, 1]],
    ['2.3', 'Excavation in unsuitable material', 'm3', '2450', '615', [0.4, 0.72, 0.8, 0.8]],
    ['2.4', 'Embankment fill with approved gravel', 'm3', '3600', '1795', [0.2, 0.51, 0.68, 0.75]],
    ['2.5', 'Subgrade preparation and compaction', 'm2', '14400', '75', [0.1, 0.38, 0.56, 0.67]],
    ['3.1', 'Sub-base, gravel 150 mm compacted', 'm3', '2160', '2925', [0, 0.26, 0.48, 0.62]],
    ['3.2', 'Aggregate base course (ABC) 150 mm', 'm3', '2016', '6200', [0, 0.13, 0.32, 0.49]],
    ['3.3', 'Prime coat (MC-30)', 'm2', '13440', '105', [0, 0, 0.16, 0.33]],
    ['3.4', 'Double bituminous surface treatment (DBST)', 'm2', '13440', '435', [0, 0, 0.12, 0.28]],
    ['3.5', 'Shoulder gravel 100 mm', 'm3', '480', '2485', [0, 0, 0, 0.08]],
    ['4.1', 'Excavation for side drains', 'm3', '1850', '535', [0.2, 0.42, 0.56, 0.67]],
    ['4.2', 'Rubble masonry side drain', 'm', '1600', '2170', [0.05, 0.26, 0.4, 0.51]],
    ['4.3', 'Concrete lined drain at junctions', 'm', '220', '4910', [0, 0.17, 0.32, 0.4]],
    ['4.4', 'Pipe culvert 600 mm dia. (complete)', 'nos', '3', '242350', [0.34, 0.57, 0.8, 0.8]],
    ['4.5', 'Headwalls and wing walls', 'm3', '36', '17940', [0.2, 0.42, 0.64, 0.71]],
    ['4.6', 'Scour checks', 'nos', '24', '5980', [0, 0, 0.2, 0.4]],
    ['5.1', 'Road marking (thermoplastic)', 'm2', '980', '1540', [0, 0, 0, 0]],
    ['5.2', 'Guard posts', 'nos', '120', '2390', [0, 0, 0, 0]],
    ['5.3', 'Road signs', 'nos', '14', '14165', [0, 0, 0, 0]],
    ['5.4', 'Kilometre posts', 'nos', '3', '7870', [0, 0, 0, 0]],
    [
      '6.1',
      'Daywork – labour and plant (provisional)',
      'LS',
      '1',
      '472110',
      [0.1, 0.21, 0.32, 0.4],
    ],
    ['6.2', 'Provisional sum – shifting of utilities', 'LS', '1', '1277100.00', [0, 0, 0.4, 0.4]],
  ],
};

/** Items of the approved road variation V1 (extra pipe culvert at Ch 1+850). */
const ROAD_VARIATION: BoqLine[] = [
  ['V1.1', 'Additional pipe culvert 900 mm dia. at Ch 1+850', 'nos', '1', '615000', [0, 0, 0, 1]],
  ['V1.2', 'Headwalls for the additional culvert', 'm3', '9.3', '17940', [0, 0, 0, 0.6]],
];

// School: measurements 60, 30 and 8 days ago. IPC-01 to −30.
const SCHOOL: SampleBoq = {
  project: 'school',
  dates: [-60, -30, -8],
  items: [
    ['1.1', 'Site establishment and temporary works', 'LS', '1', '270930', [1, 1, 1]],
    ['1.2', 'Temporary hoarding', 'm', '120', '1685', [1, 1, 1]],
    ['2.1', 'Excavation for foundations', 'm3', '420', '690', [0.7, 1, 1]],
    ['2.2', 'Rubble foundation in cement mortar 1:5', 'm3', '185', '8730', [0.4, 0.9, 0.9]],
    ['2.3', 'Plain concrete grade 15 blinding', 'm3', '28', '14450', [0.6, 1, 1]],
    ['2.4', 'RCC grade 25 column footings', 'm3', '46', '25590', [0.3, 0.8, 0.8]],
    ['2.5', 'Reinforcement for footings', 'kg', '3900', '220', [0.3, 0.8, 0.8]],
    ['2.6', 'Damp proof course 1:3 with waterproofer', 'm2', '96', '1115', [0, 0.5, 0.78]],
    ['2.7', 'Backfilling and compaction', 'm3', '260', '570', [0, 0.3, 0.47]],
    ['2.8', 'Anti-termite treatment', 'm2', '330', '255', [0.5, 1, 1]],
    ['3.1', 'RCC grade 25 columns', 'm3', '38', '29200', [0, 0.1, 0.23]],
    ['3.2', 'RCC grade 25 beams', 'm3', '62', '28600', [0, 0, 0.04]],
    ['3.3', 'RCC suspended slab 125 mm', 'm3', '72', '27095', [0, 0, 0]],
    ['3.4', 'RCC staircase', 'm3', '9', '31310', [0, 0, 0]],
    ['3.5', 'Reinforcement for the frame', 'kg', '21500', '220', [0, 0.05, 0.12]],
    ['3.6', 'Formwork to RCC', 'm2', '1650', '875', [0, 0.05, 0.09]],
    ['4.1', 'Brickwork 225 mm', 'm2', '920', '2800', [0, 0, 0]],
    ['4.2', 'Brickwork 112.5 mm', 'm2', '310', '1715', [0, 0, 0]],
    ['4.3', 'Lintels and sills', 'm', '280', '1415', [0, 0, 0]],
    ['5.1', 'Roof structure (steel)', 'm2', '330', '3735', [0, 0, 0]],
    ['5.2', 'Roof sheeting (zinc-aluminium)', 'm2', '330', '2075', [0, 0, 0]],
    ['5.3', 'Ceiling (calcium silicate boards)', 'm2', '560', '1295', [0, 0, 0]],
    ['5.4', 'Gutters and downpipes', 'm', '96', '1595', [0, 0, 0]],
    ['6.1', 'Internal plaster 1:5', 'm2', '2250', '570', [0, 0, 0]],
    ['6.2', 'External plaster 1:4', 'm2', '980', '630', [0, 0, 0]],
    ['6.3', 'Floor tiles (homogeneous)', 'm2', '560', '2920', [0, 0, 0]],
    ['6.4', 'Painting – emulsion, 3 coats', 'm2', '3200', '255', [0, 0, 0]],
    ['7.1', 'Timber doors with frames', 'nos', '18', '25590', [0, 0, 0]],
    ['7.2', 'Aluminium windows', 'm2', '112', '11140', [0, 0, 0]],
    ['7.3', 'Steel window grills', 'm2', '112', '4095', [0, 0, 0]],
    ['8.1', 'Electrical installation (complete)', 'LS', '1', '1113830', [0, 0, 0]],
    ['8.2', 'Plumbing and sanitary fittings', 'LS', '1', '873005', [0, 0, 0]],
    ['8.3', 'Rainwater drainage', 'm', '85', '1925', [0, 0, 0]],
    ['9.1', 'Apron and external paving', 'm2', '180', '2015', [0, 0, 0]],
    ['9.2', 'Provisional sum – utility connections', 'LS', '1', '973040.00', [0, 0, 0]],
  ],
};

// Culvert (completed 210 days ago): measured 330, 270 and 215 days ago — three bills, all paid.
const CULVERT: SampleBoq = {
  project: 'culvert',
  dates: [-330, -270, -215],
  items: [
    ['1.1', 'Mobilisation and diversion road', 'LS', '1', '263820', [1, 1, 1]],
    ['1.2', 'Dewatering', 'LS', '1', '175880', [0.6, 1, 1]],
    ['2.1', 'Excavation for the culvert', 'm3', '380', '785', [1, 1, 1]],
    ['2.2', 'Blinding concrete', 'm3', '12', '15390', [1, 1, 1]],
    ['2.3', 'RCC grade 30 box (base, walls, top slab)', 'm3', '96', '29210', [0.25, 0.8, 1]],
    ['2.4', 'Reinforcement', 'kg', '11800', '230', [0.3, 0.85, 1]],
    ['2.5', 'Formwork', 'm2', '520', '1035', [0.25, 0.8, 1]],
    ['2.6', 'RCC wing walls', 'm3', '34', '28265', [0, 0.6, 1]],
    ['2.7', 'Backfill with approved material', 'm3', '300', '1035', [0, 0.3, 1]],
    ['2.8', 'Rip-rap apron', 'm3', '45', '6155', [0, 0, 1]],
    ['2.9', 'Road reinstatement (DBST)', 'm2', '210', '785', [0, 0, 1]],
    ['3.1', 'Provisional sum – contingencies', 'LS', '1', '207625.00', [0, 0.5, 1]],
  ],
};

// Drain (on hold): measured 45 and 20 days ago. No bills yet.
const DRAIN: SampleBoq = {
  project: 'drain',
  dates: [-45, -20],
  items: [
    ['1.1', 'Mobilisation', 'LS', '1', '119880', [1, 1]],
    ['1.2', 'Demolition of the existing drain', 'm', '650', '695', [0.45, 0.75]],
    ['1.3', 'Excavation', 'm3', '980', '505', [0.35, 0.65]],
    ['1.4', 'Concrete grade 20 drain base', 'm3', '115', '16065', [0.15, 0.42]],
    ['1.5', 'RCC drain walls', 'm3', '168', '21100', [0.05, 0.28]],
    ['1.6', 'Reinforcement', 'kg', '9800', '175', [0.05, 0.28]],
    ['1.7', 'Precast RCC cover slabs', 'nos', '650', '2975', [0, 0]],
    ['1.8', 'Backfill and reinstatement', 'm2', '1300', '470', [0, 0]],
    ['1.9', 'Provisional sum – service connections', 'LS', '1', '681445.00', [0, 0]],
  ],
};

interface SampleBond {
  project: ProjectKey;
  type: BondType;
  bank: string;
  referenceNo: string;
  amount: string;
  issue: number;
  expiry: number;
  status: BondStatus;
  notes?: string;
}

const BONDS: SampleBond[] = [
  {
    project: 'road',
    type: 'PERFORMANCE_BOND',
    bank: 'Bank of Ceylon – Polonnaruwa',
    referenceNo: 'BOC/PB/2026/0418',
    amount: '2425000.00',
    issue: -150,
    expiry: 20,
    status: 'ACTIVE',
    notes: 'Must be extended to the end of the defects liability period.',
  },
  {
    project: 'road',
    type: 'ADVANCE_PAYMENT_GUARANTEE',
    bank: "People's Bank – Hingurakgoda",
    referenceNo: 'PB/APG/2026/112',
    amount: '9700000.00',
    issue: -145,
    expiry: 125,
    status: 'ACTIVE',
  },
  {
    project: 'school',
    type: 'BID_BOND',
    bank: 'Sampath Bank – Polonnaruwa',
    referenceNo: 'SB/BID/2025/7781',
    amount: '300000.00',
    issue: -130,
    expiry: -40,
    status: 'RELEASED',
    notes: 'Returned by the school development society after the contract was signed.',
  },
  {
    project: 'school',
    type: 'PERFORMANCE_BOND',
    bank: 'Sampath Bank – Polonnaruwa',
    referenceNo: 'SB/PB/2026/0093',
    amount: '1637500.00',
    issue: -88,
    expiry: 300,
    status: 'ACTIVE',
  },
  {
    project: 'drain',
    type: 'PERFORMANCE_BOND',
    bank: 'Bank of Ceylon – Polonnaruwa',
    referenceNo: 'BOC/PB/2026/0533',
    amount: '570000.00',
    issue: -58,
    expiry: 45,
    status: 'ACTIVE',
  },
];

/** Bond copies uploaded as project documents by seedDocuments (when storage is available). */
export const SAMPLE_BOND_COPIES = BONDS.filter(
  (b) => b.status === 'ACTIVE' && b.project === 'road',
).map((b) => ({
  project: b.project,
  title: `${b.type === 'PERFORMANCE_BOND' ? 'Performance bond' : 'Advance payment guarantee'} – ${b.referenceNo}`,
  file: `${b.referenceNo.replaceAll('/', '-').toLowerCase()}.pdf`,
  bank: b.bank,
  issue: b.issue,
  expiry: b.expiry,
}));

/** Costs from before the 60-day operations history (cash, so supplier balances are unchanged). */
interface PastPurchase {
  project: ProjectKey;
  offset: number;
  supplier: number;
  invoice: string;
  lines: [material: string, qty: string, unitPrice: string][];
}
interface PastExpense {
  project: ProjectKey;
  offset: number;
  category: ExpenseCategory;
  description: string;
  amount: string;
  supplier?: number;
}

const PAST_PURCHASES: PastPurchase[] = [
  // Road (before the 60-day history)
  {
    project: 'road',
    offset: -138,
    supplier: 3,
    invoice: 'MSM-2026-0412',
    lines: [
      ['ABC (aggregate base course)', '60', '12800'],
      ['Metal 1½"', '30', '13800'],
    ],
  },
  {
    project: 'road',
    offset: -118,
    supplier: 3,
    invoice: 'MSM-2026-0477',
    lines: [
      ['ABC (aggregate base course)', '70', '12800'],
      ['Metal 1½"', '35', '13800'],
    ],
  },
  {
    project: 'road',
    offset: -96,
    supplier: 1,
    invoice: 'PCD-55120',
    lines: [['Cement (50 kg bag)', '400', '2150']],
  },
  {
    project: 'road',
    offset: -84,
    supplier: 3,
    invoice: 'MSM-2026-0561',
    lines: [
      ['ABC (aggregate base course)', '50', '12950'],
      ['Metal 1½"', '25', '13800'],
    ],
  },
  {
    project: 'road',
    offset: -72,
    supplier: 2,
    invoice: 'LHS-88231',
    lines: [['Bitumen emulsion (CRS-1)', '1800', '420']],
  },
  // Drain (it ran over budget before it was put on hold)
  {
    project: 'drain',
    offset: -57,
    supplier: 1,
    invoice: 'PCD-56011',
    lines: [['Cement (50 kg bag)', '500', '2150']],
  },
  {
    project: 'drain',
    offset: -50,
    supplier: 3,
    invoice: 'MSM-2026-0702',
    lines: [
      ['Metal ¾"', '50', '14500'],
      ['River sand', '40', '18500'],
    ],
  },
  {
    project: 'drain',
    offset: -41,
    supplier: 2,
    invoice: 'LHS-88907',
    lines: [['Steel bar 10 mm', '4500', '285']],
  },
  {
    project: 'drain',
    offset: -33,
    supplier: 1,
    invoice: 'PCD-56388',
    lines: [['Cement (50 kg bag)', '400', '2150']],
  },
  {
    project: 'drain',
    offset: -26,
    supplier: 3,
    invoice: 'MSM-2026-0790',
    lines: [
      ['Metal ¾"', '35', '14500'],
      ['River sand', '30', '18500'],
    ],
  },
  // Culvert (built last year)
  {
    project: 'culvert',
    offset: -390,
    supplier: 1,
    invoice: 'PCD-41022',
    lines: [['Cement (50 kg bag)', '500', '2100']],
  },
  {
    project: 'culvert',
    offset: -365,
    supplier: 2,
    invoice: 'LHS-71840',
    lines: [
      ['Steel bar 12 mm', '6200', '270'],
      ['Binding wire', '120', '520'],
    ],
  },
  {
    project: 'culvert',
    offset: -340,
    supplier: 3,
    invoice: 'MSM-2025-1180',
    lines: [
      ['Metal ¾"', '40', '14000'],
      ['River sand', '30', '17500'],
    ],
  },
  {
    project: 'culvert',
    offset: -300,
    supplier: 1,
    invoice: 'PCD-42571',
    lines: [['Cement (50 kg bag)', '400', '2100']],
  },
];

const PAST_EXPENSES: PastExpense[] = [
  {
    project: 'road',
    offset: -132,
    category: 'EQUIPMENT_HIRE',
    description: 'Motor grader hire – 6 days',
    amount: '185000',
    supplier: 7,
  },
  {
    project: 'road',
    offset: -112,
    category: 'EQUIPMENT_HIRE',
    description: 'Vibratory roller hire – 6 days',
    amount: '165000',
    supplier: 7,
  },
  {
    project: 'road',
    offset: -98,
    category: 'EQUIPMENT_HIRE',
    description: 'Motor grader hire – 6 days',
    amount: '185000',
    supplier: 7,
  },
  {
    project: 'road',
    offset: -80,
    category: 'EQUIPMENT_HIRE',
    description: 'Motor grader hire – 6 days',
    amount: '185000',
    supplier: 7,
  },
  {
    project: 'road',
    offset: -66,
    category: 'EQUIPMENT_HIRE',
    description: 'Bitumen sprayer hire – 4 days',
    amount: '240000',
    supplier: 7,
  },
  {
    project: 'road',
    offset: -105,
    category: 'SUBCONTRACT',
    description: 'Laying of 600 mm pipe culverts (labour gang)',
    amount: '450000',
  },
  {
    project: 'drain',
    offset: -55,
    category: 'EQUIPMENT_HIRE',
    description: 'Excavator hire – demolition of the old drain',
    amount: '330000',
    supplier: 7,
  },
  {
    project: 'drain',
    offset: -44,
    category: 'EQUIPMENT_HIRE',
    description: 'Excavator hire – 5 days',
    amount: '330000',
    supplier: 7,
  },
  {
    project: 'drain',
    offset: -36,
    category: 'EQUIPMENT_HIRE',
    description: 'Excavator and tipper hire – 6 days',
    amount: '495000',
    supplier: 7,
  },
  {
    project: 'drain',
    offset: -28,
    category: 'EQUIPMENT_HIRE',
    description: 'Excavator hire – 4 days',
    amount: '264000',
    supplier: 7,
  },
  {
    project: 'drain',
    offset: -38,
    category: 'SUBCONTRACT',
    description: 'Precast cover slabs – casting (320 nos, advance)',
    amount: '1984000',
  },
  {
    project: 'drain',
    offset: -30,
    category: 'SUBCONTRACT',
    description: 'Labour gang – drain walls',
    amount: '620000',
  },
  {
    project: 'culvert',
    offset: -385,
    category: 'EQUIPMENT_HIRE',
    description: 'Excavator hire – culvert excavation',
    amount: '320000',
    supplier: 7,
  },
  {
    project: 'culvert',
    offset: -372,
    category: 'EQUIPMENT_HIRE',
    description: 'Dewatering pumps – 3 weeks',
    amount: '210000',
    supplier: 7,
  },
  {
    project: 'culvert',
    offset: -330,
    category: 'EQUIPMENT_HIRE',
    description: 'Concrete pump hire',
    amount: '185000',
    supplier: 7,
  },
  {
    project: 'culvert',
    offset: -360,
    category: 'SUBCONTRACT',
    description: 'Labour contract – box culvert (stage 1)',
    amount: '780000',
  },
  {
    project: 'culvert',
    offset: -280,
    category: 'SUBCONTRACT',
    description: 'Labour contract – box culvert (stage 2)',
    amount: '690000',
  },
  {
    project: 'culvert',
    offset: -395,
    category: 'PERMITS_FEES',
    description: 'Road closure permit',
    amount: '35000',
  },
];

/** Cumulative quantity for a fraction: whole numbers for "nos", 3 dp otherwise. */
function cumulative(qty: string, unit: string, fraction: number): string {
  const raw = dec(qty).times(fraction);
  return unit === 'nos' ? raw.toDecimalPlaces(0, 1).toString() : roundQty(raw).toString();
}

export async function seedFinance(
  prisma: PrismaClient,
  ids: SampleIds,
  today: string,
): Promise<void> {
  const db = prisma as unknown as PrismaService;
  const settings = new SettingsService(db);
  const boq = new BoqService(db);
  const billing = new BillingService(db, boq);
  const payroll = new PayrollService(db, settings);
  const day = (offset: number) => addDays(today, offset);
  const projectId = (k: ProjectKey) => ids.projectIds.get(k)!;
  const supplier = (n: number) => ids.supplierIds[n - 1]!;
  const material = (name: string) => {
    const id = ids.materialIds.get(name);
    if (!id) throw new Error(`Unknown sample material ${name}`);
    return id;
  };

  // ── Variations & BOQs ──
  const roadVariation = await prisma.variation.create({
    data: {
      projectId: projectId('road'),
      number: 1,
      title: 'Additional pipe culvert at Ch 1+850',
      date: dayToDate(day(-45)),
      status: 'APPROVED',
      amountChange: sum(ROAD_VARIATION.map(([, , , q, r]) => roundMoney(dec(q).times(r)))).toFixed(
        2,
      ),
      notes: 'Requested by the Provincial Road Development office after the first rains.',
    },
  });
  await prisma.variation.create({
    data: {
      projectId: projectId('drain'),
      number: 1,
      title: 'Deeper drain section at the bus stand (120 m)',
      date: dayToDate(day(-12)),
      status: 'PENDING',
      amountChange: '1450000.00',
      notes: 'Waiting for the Pradeshiya Sabha to approve the extra cost.',
    },
  });

  const seedBoq = async (b: SampleBoq, extra: BoqLine[] = [], variationId?: string) => {
    const lines = [...b.items, ...extra];
    for (const [i, [itemNo, description, unit, quantity, rate, fractions]] of lines.entries()) {
      const isExtra = i >= b.items.length;
      await prisma.boqItem.create({
        data: {
          projectId: projectId(b.project),
          itemNo,
          description,
          unit,
          quantity,
          rate,
          sortOrder: (i + 1) * 10,
          variationId: isExtra ? (variationId ?? null) : null,
          measurements: {
            create: b.dates.flatMap((offset, k) => {
              const f = fractions[k] ?? 0;
              const prev = k > 0 ? (fractions[k - 1] ?? 0) : 0;
              // only record a measurement when the item moved on
              return f > 0 && f !== prev
                ? [{ date: dayToDate(day(offset)), cumulativeQty: cumulative(quantity, unit, f) }]
                : [];
            }),
          },
        },
      });
    }
  };
  await seedBoq(ROAD, ROAD_VARIATION, roadVariation.id);
  await seedBoq(SCHOOL);
  await seedBoq(CULVERT);
  await seedBoq(DRAIN);

  // ── Extension of time: the drain is on hold ──
  await boq.createExtension(projectId('drain'), {
    newEndDate: day(150),
    approvedDate: day(-5),
    reference: 'HPS/W/03/EOT-1',
    reason:
      'Work stopped while the Pradeshiya Sabha decides on the deeper drain at the bus stand (variation 1).',
  });

  // ── Earlier costs ──
  for (const [i, p] of PAST_PURCHASES.entries()) {
    const lines = p.lines.map(([name, qty, price]) => ({
      materialId: material(name),
      quantity: qty,
      unitPrice: price,
      amount: roundMoney(dec(qty).times(price)).toFixed(2),
      projectId: projectId(p.project),
    }));
    await prisma.purchase.create({
      data: {
        supplierId: supplier(p.supplier),
        date: dayToDate(day(p.offset)),
        invoiceNo: p.invoice,
        paymentType: 'CASH',
        notes: i === 0 ? 'Delivered straight to site' : null,
        total: sum(lines.map((l) => l.amount)).toFixed(2),
        lines: { create: lines },
      },
    });
  }
  await prisma.expense.createMany({
    data: PAST_EXPENSES.map((e) => ({
      date: dayToDate(day(e.offset)),
      projectId: projectId(e.project),
      category: e.category,
      description: e.description,
      amount: e.amount,
      paidBy: 'CASH' as const,
      supplierId: e.supplier ? supplier(e.supplier) : null,
    })),
  });

  // ── Bonds ──
  await prisma.bond.createMany({
    data: BONDS.map((b) => ({
      projectId: projectId(b.project),
      type: b.type,
      bank: b.bank,
      referenceNo: b.referenceNo,
      amount: b.amount,
      issueDate: dayToDate(day(b.issue)),
      expiryDate: dayToDate(day(b.expiry)),
      status: b.status,
      notes: b.notes ?? null,
    })),
  });

  // ── Bills & client payments ──
  const pay = (
    key: ProjectKey,
    offset: number,
    amount: string,
    kind: 'IPC_PAYMENT' | 'ADVANCE' | 'RETENTION_RELEASE',
    method: 'CHEQUE' | 'BANK_TRANSFER',
    reference: string,
    certificateId?: string,
  ) =>
    billing.addPayment(
      projectId(key),
      clientPaymentCreateSchema.parse({
        date: day(offset),
        amount,
        kind,
        method,
        reference,
        certificateId,
      }),
    );
  const bill = async (
    key: ProjectKey,
    periodTo: number,
    steps: { submitted?: number; certified?: number; paid?: [offset: number, reference: string] },
  ) => {
    const pid = projectId(key);
    const c = await billing.create(pid, certificateCreateSchema.parse({ periodTo: day(periodTo) }));
    if (steps.submitted !== undefined) {
      await billing.setStatus(pid, c.id, { status: 'SUBMITTED', date: day(steps.submitted) });
    }
    if (steps.certified !== undefined) {
      await billing.setStatus(pid, c.id, { status: 'CERTIFIED', date: day(steps.certified) });
    }
    if (steps.paid) {
      await pay(
        key,
        steps.paid[0],
        c.netPayable.toFixed(2),
        'IPC_PAYMENT',
        'BANK_TRANSFER',
        steps.paid[1],
        c.id,
      );
      await billing.setStatus(pid, c.id, { status: 'PAID', date: day(steps.paid[0]) });
    }
    return c;
  };

  // Road: mobilization advance, IPC-01 paid, IPC-02 certified and waiting for payment.
  await pay(
    'road',
    -140,
    '9700000.00',
    'ADVANCE',
    'BANK_TRANSFER',
    'PRDA advance – voucher 2026/0331',
  );
  await bill('road', -70, {
    submitted: -66,
    certified: -55,
    paid: [-41, 'PRDA voucher 2026/0712'],
  });
  await bill('road', -40, { submitted: -36, certified: -21 });
  // School: advance, IPC-01 submitted.
  await pay('school', -85, '3275000.00', 'ADVANCE', 'CHEQUE', 'SDS cheque 448120');
  await bill('school', -30, { submitted: -26 });
  // Culvert: three bills, all paid; half of the retention released at completion.
  await bill('culvert', -330, {
    submitted: -326,
    certified: -310,
    paid: [-292, 'PRDA voucher 2025/1102'],
  });
  await bill('culvert', -270, {
    submitted: -266,
    certified: -250,
    paid: [-236, 'PRDA voucher 2025/1290'],
  });
  await bill('culvert', -215, {
    submitted: -212,
    certified: -205,
    paid: [-190, 'PRDA voucher 2026/0044'],
  });
  const culvert = await billing.summary(projectId('culvert'));
  await pay(
    'culvert',
    -185,
    roundMoney(culvert.retentionHeld.dividedBy(2)).toFixed(2),
    'RETENTION_RELEASE',
    'CHEQUE',
    'Half of the retention released on completion',
  );

  // ── Payroll: last month finalized (recovers part of the advances), this month left open ──
  const [y, m] = today.split('-').map(Number) as [number, number];
  const prev = m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
  const run = await payroll.generate(prev);
  await payroll.finalize(run.id);
}
