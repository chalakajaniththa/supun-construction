import { z } from 'zod';
import type { PayrollStatus, WorkerSkill, WorkerType } from '../enums';
import { nonNegativeMoneySchema } from '../money';
import { optionalText } from './common';

/**
 * Step 4 — monthly payroll (overview §7): generate a DRAFT, edit deductions, finalize (locks the
 * month's attendance and recovers advances), reopen the latest finalized month.
 */

export const payrollRunCreateSchema = z.object({
  year: z.coerce.number({ error: 'REQUIRED' }).int('INVALID_NUMBER').min(2000).max(2100),
  month: z.coerce.number({ error: 'REQUIRED' }).int('INVALID_NUMBER').min(1).max(12),
});
export type PayrollRunCreate = z.output<typeof payrollRunCreateSchema>;

/** PATCH /payroll/runs/:id/lines/:lineId — only while the run is a DRAFT. */
export const payrollLineUpdateSchema = z.object({
  advanceDeduction: nonNegativeMoneySchema.optional(),
  otherDeductions: nonNegativeMoneySchema.optional(),
  otherDeductionsNote: optionalText(300),
});
export type PayrollLineUpdateInput = z.input<typeof payrollLineUpdateSchema>;
export type PayrollLineUpdate = z.output<typeof payrollLineUpdateSchema>;

/** One project's share of a worker's month (labour cost; for permanent staff incl. EPF/ETF). */
export interface PayrollBreakdownEntry {
  /** null = days without a project (overhead). */
  projectId: string | null;
  days: string;
  otHours: string;
  cost: string;
}

export interface PayrollLineDto {
  id: string;
  payrollRunId: string;
  workerId: string;
  workerType: WorkerType;
  daysWorked: string;
  halfDays: number;
  otHours: string;
  basicPay: string;
  otPay: string;
  grossPay: string;
  epfEmployee: string;
  epfEmployer: string;
  etfEmployer: string;
  advanceDeduction: string;
  otherDeductions: string;
  otherDeductionsNote: string | null;
  netPay: string;
  breakdown: PayrollBreakdownEntry[];
  worker: {
    id: string;
    code: string;
    fullName: string;
    nameSinhala: string | null;
    skill: WorkerSkill;
    epfNo: string | null;
  };
  /** Open advance balance before this month (what could be recovered). */
  advanceBalance: string;
}

export interface PayrollTotals {
  workers: number;
  basicPay: string;
  otPay: string;
  grossPay: string;
  epfEmployee: string;
  epfEmployer: string;
  etfEmployer: string;
  advanceDeduction: string;
  otherDeductions: string;
  netPay: string;
  /** gross + EPF 12% + ETF 3% — what the month costs the company. */
  employerCost: string;
}

export interface PayrollRunSummaryDto {
  id: string;
  year: number;
  month: number;
  status: PayrollStatus;
  finalizedAt: string | null;
  generatedAt: string | null;
  totals: PayrollTotals;
}

export interface PayrollRunDto extends PayrollRunSummaryDto {
  lines: PayrollLineDto[];
  /** Attendance or pay rates changed after the draft was made: generate again before finalizing. */
  stale: boolean;
  /** Only the latest finalized month can be reopened. */
  canReopen: boolean;
}

/** A worker's payslips (worker detail → Payslips). */
export interface PayslipDto extends Omit<PayrollLineDto, 'worker' | 'advanceBalance'> {
  run: { id: string; year: number; month: number; status: PayrollStatus };
}
