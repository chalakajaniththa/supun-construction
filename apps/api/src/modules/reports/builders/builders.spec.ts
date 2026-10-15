import type { PayrollLineDto, PayrollRunDto, StatementDto } from '@sc/shared';
import { describe, expect, it } from 'vitest';
import { sum } from '../../../common/money/money.js';
import type { KeyValueSection, ReportDoc, TableSection } from '../model.js';
import { testTranslator } from '../test-translator.js';
import { buildAssetUtilisation } from './assets.js';
import { buildAttendance, daysOfMonth } from './attendance.js';
import { buildBusinessSummary } from './business-summary.js';
import { buildExpenses } from './expenses.js';
import { buildExpiry } from './expiry.js';
import { buildIpc } from './ipc.js';
import { buildEpfEtf, buildPayrollSheet, buildPayslips } from './payroll.js';
import { buildProjectCost } from './project-cost.js';
import { buildSupplierBalances, buildSupplierStatement } from './suppliers.js';

const TODAY = '2026-10-15';
const table = (doc: ReportDoc, i: number) => doc.sections[i] as TableSection;
const kv = (doc: ReportDoc, i: number) => doc.sections[i] as KeyValueSection;
const colSum = (s: TableSection, key: string) =>
  sum(s.rows.map((r) => r[key] as string)).toFixed(2);

function ctx(locale: 'en' | 'si' = 'en') {
  return { t: testTranslator(locale), today: TODAY };
}

/** Every label used by a builder must exist in the message files. */
function expectNoMissingKeys(c: ReturnType<typeof ctx>) {
  expect([...c.t.missing]).toEqual([]);
}

const line = (over: Partial<PayrollLineDto>): PayrollLineDto => ({
  id: 'l',
  payrollRunId: 'r',
  workerId: 'w',
  workerType: 'DAILY',
  daysWorked: '20',
  halfDays: 1,
  otHours: '4',
  basicPay: '60000.00',
  otPay: '2100.00',
  grossPay: '62100.00',
  epfEmployee: '0.00',
  epfEmployer: '0.00',
  etfEmployer: '0.00',
  advanceDeduction: '5000.00',
  otherDeductions: '0.00',
  otherDeductionsNote: null,
  netPay: '57100.00',
  breakdown: [],
  worker: {
    id: 'w',
    code: 'W-0001',
    fullName: 'K. A. Sunil Perera',
    nameSinhala: null,
    skill: 'MASON',
    epfNo: null,
  },
  advanceBalance: '0.00',
  ...over,
});

const run: PayrollRunDto = {
  id: 'r',
  year: 2026,
  month: 9,
  status: 'FINALIZED',
  finalizedAt: null,
  generatedAt: null,
  stale: false,
  canReopen: true,
  totals: {
    workers: 2,
    basicPay: '160000.00',
    otPay: '2100.00',
    grossPay: '162100.00',
    epfEmployee: '8000.00',
    epfEmployer: '12000.00',
    etfEmployer: '3000.00',
    advanceDeduction: '5000.00',
    otherDeductions: '250.50',
    netPay: '148849.50',
    employerCost: '177100.00',
  },
  lines: [
    line({}),
    line({
      id: 'l2',
      workerId: 'w2',
      workerType: 'PERMANENT',
      daysWorked: '25',
      halfDays: 0,
      otHours: '0',
      basicPay: '100000.00',
      otPay: '0.00',
      grossPay: '100000.00',
      epfEmployee: '8000.00',
      epfEmployer: '12000.00',
      etfEmployer: '3000.00',
      advanceDeduction: '0.00',
      otherDeductions: '250.50',
      otherDeductionsNote: 'Uniform',
      netPay: '91749.50',
      worker: {
        id: 'w2',
        code: 'W-0020',
        fullName: 'S. A. Nalaka Senarath',
        nameSinhala: 'නාලක',
        skill: 'SUPERVISOR',
        epfNo: 'EPF-77',
      },
    }),
  ],
};
const payrollSettings = { epfEmployeePct: '8', epfEmployerPct: '12', etfEmployerPct: '3' };

describe('payroll reports', () => {
  it('R2 salary sheet: totals equal the payroll run totals', () => {
    const c = ctx();
    const doc = buildPayrollSheet({ run, settings: payrollSettings }, c);
    const s = table(doc, 0);
    expect(s.rows).toHaveLength(2);
    expect(s.totals).toMatchObject({
      basic: run.totals.basicPay,
      gross: run.totals.grossPay,
      epf: run.totals.epfEmployee,
      advance: run.totals.advanceDeduction,
      other: run.totals.otherDeductions,
      net: run.totals.netPay,
      days: '45',
    });
    expect(doc.filename).toBe('payroll-sheet_2026-09');
    expect(doc.landscape).toBe(true);
    expect(kv(doc, 1).items.at(-1)!.value).toBe(run.totals.employerCost);
    expectNoMissingKeys(c);
  });

  it('R3 payslips: one page per worker, net pay as in payroll; one worker on request', () => {
    const c = ctx('si');
    const doc = buildPayslips({ run, settings: payrollSettings }, c);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0]!.pageBreakBefore).toBe(false);
    expect(doc.sections[1]!.pageBreakBefore).toBe(true);
    const net = kv(doc, 1).items.find((i) => i.strong && i.value === '91749.50');
    expect(net).toBeDefined();
    // EPF 8% only on the permanent worker's slip
    expect(kv(doc, 0).items.some((i) => i.label.includes('EPF 8%'))).toBe(false);
    expect(kv(doc, 1).items.some((i) => i.value === '-8000.00')).toBe(true);
    const one = buildPayslips({ run, settings: payrollSettings }, c, 'w2');
    expect(one.sections).toHaveLength(1);
    expect(one.filename).toBe('payslip_2026-09_W-0020');
    expectNoMissingKeys(c);
  });

  it('R4 EPF/ETF: permanent staff only; EPF total = 8% + 12%', () => {
    const c = ctx();
    const doc = buildEpfEtf({ run, settings: payrollSettings }, c);
    const s = table(doc, 0);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({
      epfNo: 'EPF-77',
      earnings: '100000.00',
      epfTotal: '20000.00',
      etf: '3000.00',
    });
    expect(kv(doc, 1).items.map((i) => i.value)).toEqual(['20000.00', '3000.00']);
    expectNoMissingKeys(c);
  });
});

describe('R1 project cost', () => {
  it('summary rows and totals come straight from the costing result', () => {
    const c = ctx();
    const doc = buildProjectCost(
      {
        project: { code: 'PRJ-2026-001', name: 'Road', clientName: 'RDA' },
        from: '2026-10-01',
        to: '2026-10-15',
        costs: {
          byCategory: [
            {
              category: 'LABOUR',
              budget: '1000.00',
              actual: '300.50',
              variance: '699.50',
              pct: '30.05',
              estimated: true,
              entries: [
                {
                  kind: 'LABOUR',
                  date: null,
                  description: 'Sunil',
                  reference: 'W-0001',
                  quantity: '10',
                  unit: 'days',
                  amount: '200.25',
                  estimated: true,
                  refId: 'w',
                },
                {
                  kind: 'LABOUR',
                  date: null,
                  description: 'Nimal',
                  reference: 'W-0002',
                  quantity: '5',
                  unit: 'days',
                  amount: '100.25',
                  estimated: false,
                  refId: 'w2',
                },
              ],
            },
            {
              category: 'MATERIALS',
              budget: '0.00',
              actual: '0.00',
              variance: '0.00',
              pct: null,
              estimated: false,
              entries: [],
            },
          ],
          total: { budget: '1000.00', actual: '300.50', variance: '699.50', pct: '30.05' },
          estimated: true,
        },
      },
      c,
    );
    const s = table(doc, 0);
    expect(s.totals).toMatchObject({ budget: '1000.00', actual: '300.50', variance: '699.50' });
    expect(colSum(s, 'actual')).toBe('300.50');
    // one entries table per category that has entries
    expect(doc.sections).toHaveLength(2);
    expect(table(doc, 1).totals!.amount).toBe('300.50');
    expect(table(doc, 1).rows[0]!.unit).toBe('days');
    expect(doc.filename).toBe('project-cost_PRJ-2026-001_2026-10-01_2026-10-15');
    expectNoMissingKeys(c);
  });
});

describe('R5 attendance', () => {
  it('fills the month grid and counts half days as 0.5', () => {
    const c = ctx();
    expect(daysOfMonth('2026-02')).toHaveLength(28);
    const doc = buildAttendance(
      {
        month: '2026-09',
        project: null,
        workers: [
          {
            code: 'W-0001',
            name: 'Sunil',
            records: [
              { date: '2026-09-01', status: 'PRESENT', otHours: '2' },
              { date: '2026-09-02', status: 'HALF_DAY', otHours: '0' },
              { date: '2026-09-03', status: 'ABSENT', otHours: '0' },
              { date: '2026-09-04', status: 'LEAVE', otHours: '0' },
            ],
          },
          {
            code: 'W-0002',
            name: 'Nimal',
            records: [{ date: '2026-09-01', status: 'PRESENT', otHours: '1.5' }],
          },
        ],
      },
      c,
    );
    const s = table(doc, 0);
    expect(s.columns).toHaveLength(2 + 30 + 4);
    expect(s.rows[0]).toMatchObject({
      '2026-09-01': 'P',
      '2026-09-02': 'H',
      worked: '1.5',
      absent: 1,
      leave: 1,
      ot: '2',
    });
    expect(s.totals).toMatchObject({
      '2026-09-01': '2',
      '2026-09-02': '0.5',
      '2026-09-05': null,
      worked: '2.5',
      ot: '3.5',
    });
    expectNoMissingKeys(c);
  });
});

describe('R6 asset utilisation', () => {
  it('sums hours, fuel and machine cost per machine and per project', () => {
    const c = ctx();
    const log = (
      date: string,
      projectCode: string | null,
      hours: string,
      fuelCost: string | null,
      machine: string,
    ) => ({
      date,
      projectCode,
      projectName: projectCode ? `P ${projectCode}` : null,
      hoursUsed: hours,
      fuelLitres: fuelCost ? '10' : null,
      fuelCost,
      machineCost: machine,
    });
    const doc = buildAssetUtilisation(
      {
        from: '2026-10-01',
        to: '2026-10-15',
        single: false,
        assets: [
          {
            code: 'AST-001',
            name: 'JCB 1',
            category: 'JCB_BACKHOE',
            logs: [
              log('2026-10-01', 'A', '6', '3000', '30000'),
              log('2026-10-02', 'B', '2.5', null, '12500'),
              log('2026-10-02', 'A', '1', '500', '5000'),
            ],
          },
        ],
        maintenance: [
          {
            assetCode: 'AST-001',
            assetName: 'JCB 1',
            date: '2026-10-05',
            type: 'SERVICE',
            description: 'Oil',
            meterReading: '8200',
            cost: '15000',
            supplier: null,
          },
        ],
      },
      c,
    );
    expect(table(doc, 0).rows[0]).toMatchObject({
      days: 2,
      hours: '9.5',
      litres: '20',
      fuel: '3500.00',
      machine: '47500.00',
      repairs: '15000.00',
      total: '66000.00',
    });
    const byProject = table(doc, 1);
    expect(byProject.rows).toHaveLength(2);
    expect(byProject.totals!.total).toBe('51000.00');
    expect(table(doc, 2).totals!.cost).toBe('15000.00');
    expectNoMissingKeys(c);
  });
});

describe('R7 expenses', () => {
  it('groups by category and project with the same grand total', () => {
    const c = ctx('si');
    const x = (category: 'FUEL' | 'MEALS', amount: string, project: string | null) => ({
      date: '2026-10-02',
      category,
      description: 'x',
      amount,
      paidBy: 'CASH',
      project: project ? { code: project, name: project } : null,
      asset: null,
      supplier: null,
    });
    const doc = buildExpenses(
      {
        from: '2026-10-01',
        to: '2026-10-15',
        project: null,
        category: null,
        expenses: [x('FUEL', '100.10', 'A'), x('MEALS', '50.20', null), x('FUEL', '0.70', 'A')],
      },
      c,
    );
    expect(colSum(table(doc, 0), 'amount')).toBe('151.00');
    expect(colSum(table(doc, 1), 'amount')).toBe('151.00');
    expect(table(doc, 2).totals!.amount).toBe('151.00');
    expect(table(doc, 1).rows).toHaveLength(2);
    expectNoMissingKeys(c);
  });
});

describe('R8 supplier', () => {
  it('statement totals are the statement DTO totals', () => {
    const c = ctx();
    const s: StatementDto = {
      supplier: { id: 's', code: 'SUP-001', name: 'Hardware' },
      from: '2026-10-01',
      to: null,
      openingBalance: '1000.00',
      entries: [
        {
          kind: 'PURCHASE',
          id: '1',
          date: '2026-10-02',
          description: 'Cement',
          reference: 'INV-1',
          debit: '500.00',
          credit: '0.00',
          balance: '1500.00',
        },
        {
          kind: 'PAYMENT',
          id: '2',
          date: '2026-10-03',
          description: 'Paid',
          reference: null,
          debit: '0.00',
          credit: '700.00',
          balance: '800.00',
          method: 'CASH',
        },
      ],
      totalDebit: '500.00',
      totalCredit: '700.00',
      closingBalance: '800.00',
    };
    const doc = buildSupplierStatement(s, c);
    expect(table(doc, 1).totals).toMatchObject({
      debit: '500.00',
      credit: '700.00',
      balance: '800.00',
    });
    expect(doc.filename).toBe('supplier-statement_SUP-001_2026-10-01');
    const balances = buildSupplierBalances(
      [
        {
          supplierId: 'a',
          code: 'SUP-001',
          name: 'A',
          credit: '10.00',
          paid: '4.00',
          balance: '6.00',
        },
        {
          supplierId: 'b',
          code: 'SUP-002',
          name: 'B',
          credit: '5.50',
          paid: '0.00',
          balance: '5.50',
        },
      ],
      c,
    );
    expect(table(balances, 0).totals!.balance).toBe('11.50');
    expectNoMissingKeys(c);
  });
});

describe('R9 IPC', () => {
  it('prints the stored amounts (deductions negative) and the net payable', () => {
    const c = ctx();
    const doc = buildIpc(
      {
        project: {
          code: 'PRJ-2026-001',
          name: 'Road',
          clientName: 'RDA',
          contractNo: 'C-1',
          contractValue: '1000000.00',
          source: 'GOVERNMENT_TENDER',
        },
        certificate: {
          id: 'c',
          projectId: 'p',
          number: 2,
          code: 'IPC-PRJ-2026-001-02',
          periodFrom: '2026-08-07',
          periodTo: '2026-09-30',
          cumulativeWorkDone: '500000.00',
          previousCertified: '200000.00',
          grossThisBill: '300000.00',
          retentionDeducted: '30000.00',
          advanceRecovered: '0.00',
          otherDeductions: '0.00',
          otherDeductionsNote: null,
          netPayable: '270000.00',
          status: 'CERTIFIED',
          submittedDate: '2026-10-01',
          certifiedDate: null,
          notes: null,
          paid: '0.00',
          calculation: {
            cumulativeWorkDone: '500000.00',
            measuredWorkDone: '500000.00',
            previousCertified: '200000.00',
            grossThisBill: '300000.00',
            retentionPct: '10.0000',
            retentionCap: '50000.00',
            retentionSoFar: '20000.00',
            retentionDeducted: '30000.00',
            retentionCapReached: true,
            advanceAmount: '0.00',
            advanceRecoveryPct: '0.0000',
            advanceRecoveredSoFar: '0.00',
            advanceRecovered: '0.00',
            advanceFullyRecovered: true,
            otherDeductions: '0.00',
            netPayable: '270000.00',
          },
        },
        finance: {
          contractValue: '1000000.00',
          approvedVariations: '0.00',
          effectiveContractValue: '1000000.00',
          billedToDate: '500000.00',
          certifiedToDate: '500000.00',
          received: '180000.00',
          receivable: '270000.00',
          retentionDeducted: '50000.00',
          retentionReleased: '0.00',
          retentionHeld: '50000.00',
          advanceAmount: '0.00',
          advanceReceived: '0.00',
          advanceRecovered: '0.00',
          advanceBalance: '0.00',
        },
      },
      c,
    );
    const items = kv(doc, 0).items;
    expect(items.map((i) => i.value)).toEqual([
      '500000.00',
      '-200000.00',
      '300000.00',
      '-30000.00',
      '0.00',
      '0.00',
      '270000.00',
    ]);
    expect(items[3]!.label).toContain('10%');
    expect(doc.title).toBe('Interim Payment Certificate (IPC)');
    expect(doc.filename).toBe('ipc_IPC-PRJ-2026-001-02');
    expectNoMissingKeys(c);
  });
});

describe('R10 expiry', () => {
  it('lists documents and bonds with time left', () => {
    const c = ctx();
    const doc = buildExpiry(
      {
        days: 30,
        documents: [
          {
            title: 'Insurance',
            category: 'INSURANCE',
            ownerType: 'ASSET',
            ownerName: 'JCB 1',
            ownerCode: 'AST-001',
            expiryDate: '2026-10-10',
            fileName: null,
          },
          {
            title: 'CIDA',
            category: 'CIDA_REGISTRATION',
            ownerType: 'COMPANY',
            ownerName: null,
            ownerCode: null,
            expiryDate: '2026-10-20',
            fileName: null,
          },
        ],
        bonds: [
          {
            type: 'PERFORMANCE_BOND',
            referenceNo: 'PB-1',
            bank: 'BOC',
            amount: '100.00',
            expiryDate: '2026-10-15',
            project: { code: 'P', name: 'Road' },
          },
        ],
      },
      c,
    );
    expect(table(doc, 0).rows.map((r) => r.left)).toEqual(['expired 5 days ago', '5 days left']);
    expect(table(doc, 0).rows[1]!.owner).toBe('the company');
    expect(table(doc, 1).rows[0]!.left).toBe('today');
    expectNoMissingKeys(c);
  });
});

describe('R11 business summary', () => {
  it('spent = project costs + overhead; totals match the rows', () => {
    const c = ctx();
    const doc = buildBusinessSummary(
      {
        month: '2026-10',
        projects: [
          {
            code: 'A',
            name: 'A',
            status: 'ONGOING',
            spent: '100.10',
            received: '50.00',
            receivable: '10.00',
            retentionHeld: '5.00',
          },
          {
            code: 'B',
            name: 'B',
            status: 'PLANNING',
            spent: '0.00',
            received: '0.00',
            receivable: '0.00',
            retentionHeld: '0.00',
          },
          {
            code: 'C',
            name: 'C',
            status: 'COMPLETED',
            spent: '0.00',
            received: '0.00',
            receivable: '0.00',
            retentionHeld: '7.50',
          },
        ],
        overheadExpenses: '20.00',
        payments: [
          { kind: 'IPC_PAYMENT', amount: '50.00' },
          { kind: 'RETENTION_RELEASE', amount: '25.00' },
        ],
      },
      c,
    );
    const items = kv(doc, 0).items;
    const value = (label: string) => items.find((i) => i.label.trim() === label)!.value;
    expect(value('Money received')).toBe('75.00');
    expect(value('Money spent')).toBe('120.10');
    expect(value('Money to receive (today)')).toBe('10.00');
    expect(value('Retention held (today)')).toBe('12.50');
    const s = table(doc, 1);
    expect(s.rows.map((r) => r.code)).toEqual(['A', 'C']);
    expect(s.totals!.retention).toBe('12.50');
    expectNoMissingKeys(c);
  });
});
