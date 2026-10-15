import type { PayrollLineDto, PayrollRunDto, PayrollSettings } from '@sc/shared';
import { dec } from '../../../common/money/money.js';
import { rs, total, totalQty, type BuildContext, type ReportDoc, type Section } from '../model.js';
import { enumLabel, monthFilter, monthOf, named } from './common.js';

export interface PayrollReportInput {
  run: PayrollRunDto;
  settings: Pick<PayrollSettings, 'epfEmployeePct' | 'epfEmployerPct' | 'etfEmployerPct'>;
}

const statusNote = (t: BuildContext['t'], run: PayrollRunDto) =>
  run.status === 'DRAFT' ? t('reports.payroll.draftNote') : undefined;

const workerName = (l: PayrollLineDto) => l.worker.fullName;

/** A deduction shown as a negative amount (0 stays 0.00). */
const neg = (v: string) => (dec(v).isZero() ? '0.00' : dec(v).neg().toFixed(2));

/** R2 — the month's salary sheet (all workers, totals, a signature column). */
export function buildPayrollSheet({ run }: PayrollReportInput, { t }: BuildContext): ReportDoc {
  const month = monthOf(run.year, run.month);
  const lines = run.lines;
  const sum = (k: keyof PayrollLineDto) => total(lines.map((l) => l[k] as string));
  return {
    title: t('reports.list.payroll-sheet.name'),
    subtitle: `${t('reports.common.month')}: ${monthFilter(t, month).value}`,
    filters: [
      { label: t('reports.common.status'), value: enumLabel(t, 'payrollStatus', run.status) },
      { label: t('reports.payroll.workers'), value: String(lines.length) },
    ],
    landscape: true,
    filename: `payroll-sheet_${month}`,
    sections: [
      {
        kind: 'table',
        sheet: t('reports.payroll.sheet'),
        note: statusNote(t, run),
        columns: [
          { key: 'code', label: t('reports.common.code'), type: 'text' },
          { key: 'name', label: t('reports.common.name'), type: 'text' },
          { key: 'type', label: t('reports.common.type'), type: 'text' },
          { key: 'days', label: t('reports.payroll.days'), type: 'qty' },
          { key: 'ot', label: t('reports.payroll.otHours'), type: 'qty' },
          { key: 'basic', label: rs(t, t('reports.payroll.basic')), type: 'money' },
          { key: 'otPay', label: rs(t, t('reports.payroll.otPay')), type: 'money' },
          { key: 'gross', label: rs(t, t('reports.payroll.gross')), type: 'money' },
          { key: 'epf', label: rs(t, t('reports.payroll.epfEmployee')), type: 'money' },
          { key: 'advance', label: rs(t, t('reports.payroll.advance')), type: 'money' },
          { key: 'other', label: rs(t, t('reports.payroll.other')), type: 'money' },
          { key: 'net', label: rs(t, t('reports.payroll.net')), type: 'money' },
          { key: 'sign', label: t('reports.payroll.signature'), type: 'text', width: 14 },
        ],
        rows: lines.map((l) => ({
          code: l.worker.code,
          name: workerName(l),
          type: enumLabel(t, 'workerType', l.workerType),
          days: l.daysWorked,
          ot: l.otHours,
          basic: l.basicPay,
          otPay: l.otPay,
          gross: l.grossPay,
          epf: l.epfEmployee,
          advance: l.advanceDeduction,
          other: l.otherDeductions,
          net: l.netPay,
          sign: '',
        })),
        totals: {
          name: t('reports.common.total'),
          days: totalQty(lines.map((l) => l.daysWorked)),
          ot: totalQty(lines.map((l) => l.otHours)),
          basic: sum('basicPay'),
          otPay: sum('otPay'),
          gross: sum('grossPay'),
          epf: sum('epfEmployee'),
          advance: sum('advanceDeduction'),
          other: sum('otherDeductions'),
          net: sum('netPay'),
        },
      },
      {
        kind: 'keyValue',
        title: t('reports.payroll.employerCost'),
        items: [
          { label: t('reports.payroll.gross'), value: run.totals.grossPay, type: 'money' },
          { label: t('reports.payroll.epfEmployer'), value: run.totals.epfEmployer, type: 'money' },
          { label: t('reports.payroll.etfEmployer'), value: run.totals.etfEmployer, type: 'money' },
          {
            label: t('reports.payroll.employerTotal'),
            value: run.totals.employerCost,
            type: 'money',
            strong: true,
          },
        ],
      },
    ],
  };
}

/** R3 — one payslip per worker per page (optionally only one worker). */
export function buildPayslips(
  { run }: PayrollReportInput,
  { t }: BuildContext,
  workerId?: string,
): ReportDoc {
  const month = monthOf(run.year, run.month);
  const lines = workerId ? run.lines.filter((l) => l.workerId === workerId) : run.lines;
  const sections: Section[] = lines.map((l, i) => {
    const permanent = l.workerType === 'PERMANENT';
    return {
      kind: 'keyValue',
      pageBreakBefore: i > 0,
      title: `${t('reports.payslip.title')} — ${named(workerName(l), l.worker.code)}`,
      note: [
        l.worker.nameSinhala,
        enumLabel(t, 'workerSkill', l.worker.skill),
        enumLabel(t, 'workerType', l.workerType),
        l.worker.epfNo ? `${t('reports.payslip.epfNo')}: ${l.worker.epfNo}` : null,
        statusNote(t, run),
      ]
        .filter(Boolean)
        .join(' · '),
      items: [
        { label: t('reports.common.month'), value: monthFilter(t, month).value, type: 'text' },
        { label: t('reports.payroll.days'), value: l.daysWorked, type: 'qty' },
        { label: t('reports.payslip.halfDays'), value: String(l.halfDays), type: 'int' },
        { label: t('reports.payroll.otHours'), value: l.otHours, type: 'qty' },
        { label: t('reports.payroll.basic'), value: l.basicPay, type: 'money' },
        { label: t('reports.payroll.otPay'), value: l.otPay, type: 'money' },
        { label: t('reports.payroll.gross'), value: l.grossPay, type: 'money', strong: true },
        ...(permanent
          ? [
              {
                label: t('reports.payroll.epfEmployee'),
                value: neg(l.epfEmployee),
                type: 'money' as const,
              },
            ]
          : []),
        { label: t('reports.payroll.advance'), value: neg(l.advanceDeduction), type: 'money' },
        {
          label: l.otherDeductionsNote
            ? `${t('reports.payroll.other')} (${l.otherDeductionsNote})`
            : t('reports.payroll.other'),
          value: neg(l.otherDeductions),
          type: 'money',
        },
        { label: t('reports.payroll.net'), value: l.netPay, type: 'money', strong: true },
        ...(permanent
          ? [
              {
                label: t('reports.payroll.epfEmployer'),
                value: l.epfEmployer,
                type: 'money' as const,
              },
              {
                label: t('reports.payroll.etfEmployer'),
                value: l.etfEmployer,
                type: 'money' as const,
              },
            ]
          : []),
      ],
    };
  });
  const one = workerId ? lines[0] : undefined;
  return {
    title: t('reports.list.payslips.name'),
    subtitle: monthFilter(t, month).value,
    filters: [],
    landscape: false,
    filename: one ? `payslip_${month}_${one.worker.code}` : `payslips_${month}`,
    sections: sections.length
      ? sections
      : [
          {
            kind: 'keyValue',
            items: [{ label: t('reports.common.empty'), value: null, type: 'text' }],
          },
        ],
  };
}

/** R4 — EPF / ETF contributions of permanent staff for the month. */
export function buildEpfEtf({ run, settings }: PayrollReportInput, { t }: BuildContext): ReportDoc {
  const month = monthOf(run.year, run.month);
  const lines = run.lines.filter((l) => l.workerType === 'PERMANENT');
  const epfTotal = (l: PayrollLineDto) => dec(l.epfEmployee).plus(l.epfEmployer).toFixed(2);
  const pct = (label: string, p: string) => `${label} ${p}%`;
  const epfAll = total(lines.map(epfTotal));
  const etfAll = total(lines.map((l) => l.etfEmployer));
  return {
    title: t('reports.list.epf-etf.name'),
    subtitle: monthFilter(t, month).value,
    filters: [
      { label: t('reports.common.status'), value: enumLabel(t, 'payrollStatus', run.status) },
    ],
    landscape: false,
    filename: `epf-etf_${month}`,
    sections: [
      {
        kind: 'table',
        sheet: 'EPF ETF',
        note: statusNote(t, run),
        columns: [
          { key: 'code', label: t('reports.common.code'), type: 'text' },
          { key: 'name', label: t('reports.common.name'), type: 'text' },
          { key: 'epfNo', label: t('reports.payslip.epfNo'), type: 'text' },
          { key: 'earnings', label: rs(t, t('reports.epf.earnings')), type: 'money' },
          { key: 'employee', label: pct('EPF', settings.epfEmployeePct), type: 'money' },
          { key: 'employer', label: pct('EPF', settings.epfEmployerPct), type: 'money' },
          { key: 'epfTotal', label: t('reports.epf.epfTotal'), type: 'money' },
          { key: 'etf', label: pct('ETF', settings.etfEmployerPct), type: 'money' },
        ],
        rows: lines.map((l) => ({
          code: l.worker.code,
          name: workerName(l),
          epfNo: l.worker.epfNo,
          earnings: l.basicPay,
          employee: l.epfEmployee,
          employer: l.epfEmployer,
          epfTotal: epfTotal(l),
          etf: l.etfEmployer,
        })),
        totals: {
          name: t('reports.common.total'),
          earnings: total(lines.map((l) => l.basicPay)),
          employee: total(lines.map((l) => l.epfEmployee)),
          employer: total(lines.map((l) => l.epfEmployer)),
          epfTotal: epfAll,
          etf: etfAll,
        },
      },
      {
        kind: 'keyValue',
        title: t('reports.epf.toPay'),
        items: [
          { label: t('reports.epf.epfToPay'), value: epfAll, type: 'money', strong: true },
          { label: t('reports.epf.etfToPay'), value: etfAll, type: 'money', strong: true },
        ],
      },
    ],
  };
}
