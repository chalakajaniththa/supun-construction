import { z } from 'zod';
import {
  ADVANCE_STATUSES,
  ATTENDANCE_STATUSES,
  EXPENSE_CATEGORIES,
  EXPENSE_PAID_BY,
  MAINTENANCE_TYPES,
  PAYMENT_METHODS,
  PURCHASE_PAYMENT_TYPES,
  type AdvanceStatus,
  type AssetCategory,
  type AttendanceStatus,
  type ExpenseCategory,
  type ExpensePaidBy,
  type MaintenanceType,
  type MeterType,
  type PaymentMethod,
  type PurchasePaymentType,
  type WorkerSkill,
  type WorkerType,
} from '../enums';
import { nonNegativeMoneySchema, nonNegativeQtySchema } from '../money';
import { TIME_REGEX } from '../time';
import {
  dateOnlySchema,
  enumField,
  isOnOrAfter,
  optionalDate,
  optionalMoney,
  optionalQty,
  optionalText,
  optionalUuid,
  requiredText,
} from './common';
import { paginationQuerySchema } from './pagination';

/**
 * Step 3 — daily operations: allocations, daily entry (attendance, machine usage, expenses),
 * maintenance, purchases / store / issues, supplier payments and worker advances.
 */

/** Longest date range one bulk allocation may cover (one row per day per worker/asset). */
export const MAX_ALLOCATION_DAYS = 62;

const requiredUuid = z.uuid({ error: 'REQUIRED' });

export const timeSchema = z
  .string({ error: 'REQUIRED' })
  .trim()
  .min(1, 'REQUIRED')
  .regex(TIME_REGEX, 'INVALID_TIME');

const positiveMoney = nonNegativeMoneySchema.refine((v) => Number(v) > 0, {
  message: 'MUST_BE_POSITIVE',
});
const positiveQty = nonNegativeQtySchema.refine((v) => Number(v) > 0, {
  message: 'MUST_BE_POSITIVE',
});

/** Number of calendar days from a to b inclusive. */
function dayCount(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
}

type RangeCheck = {
  fromDate?: string;
  toDate?: string | null;
  startTime?: string;
  endTime?: string;
};

/** Shared checks of a day range + time window. */
export function allocationRangeIssues(v: RangeCheck): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (v.startTime && v.endTime && v.endTime <= v.startTime) {
    issues.push({ path: 'endTime', message: 'END_TIME_BEFORE_START' });
  }
  if (v.fromDate && v.toDate) {
    if (!isOnOrAfter(v.fromDate, v.toDate)) {
      issues.push({ path: 'toDate', message: 'END_BEFORE_START' });
    } else if (dayCount(v.fromDate, v.toDate) > MAX_ALLOCATION_DAYS) {
      issues.push({ path: 'toDate', message: 'RANGE_TOO_LONG' });
    }
  }
  return issues;
}

const refineRange = (v: RangeCheck, ctx: z.RefinementCtx) => {
  for (const i of allocationRangeIssues(v)) {
    ctx.addIssue({ code: 'custom', path: [i.path], message: i.message });
  }
};

// ── Allocations ─────────────────────────────────────────────────────────
export const ALLOCATION_KINDS = ['worker', 'asset'] as const;
export type AllocationKind = (typeof ALLOCATION_KINDS)[number];

const allocationWindow = {
  projectId: requiredUuid,
  fromDate: dateOnlySchema,
  /** Last day (inclusive); defaults to fromDate. */
  toDate: optionalDate,
  startTime: timeSchema,
  endTime: timeSchema,
  /** Leave Sundays out of a multi-day range. */
  skipSundays: z.boolean().optional(),
  notes: optionalText(500),
};

/**
 * POST /allocations/workers — one or more workers to one project, every day of the range, between
 * startTime and endTime (Asia/Colombo). All-or-nothing.
 */
export const workerAllocationCreateSchema = z
  .object({
    workerIds: z.array(z.uuid('INVALID')).min(1, 'REQUIRED').max(100, 'TOO_MANY'),
    ...allocationWindow,
  })
  .superRefine(refineRange);
export type WorkerAllocationCreateInput = z.input<typeof workerAllocationCreateSchema>;
export type WorkerAllocationCreate = z.output<typeof workerAllocationCreateSchema>;

/** POST /allocations/assets — like workers, with an optional operator. */
export const assetAllocationCreateSchema = z
  .object({
    assetIds: z.array(z.uuid('INVALID')).min(1, 'REQUIRED').max(50, 'TOO_MANY'),
    operatorWorkerId: optionalUuid,
    ...allocationWindow,
  })
  .superRefine(refineRange);
export type AssetAllocationCreateInput = z.input<typeof assetAllocationCreateSchema>;
export type AssetAllocationCreate = z.output<typeof assetAllocationCreateSchema>;

/** PATCH /allocations/:id — move (project / day) or resize (times). */
export const allocationUpdateSchema = z
  .object({
    projectId: requiredUuid.optional(),
    date: dateOnlySchema.optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    operatorWorkerId: optionalUuid,
    notes: optionalText(500),
  })
  .superRefine(refineRange);
export type AllocationUpdate = z.output<typeof allocationUpdateSchema>;

export const allocationListQuerySchema = z
  .object({
    kind: z.enum(ALLOCATION_KINDS).default('worker'),
    from: dateOnlySchema,
    to: dateOnlySchema,
    projectId: z.uuid().optional(),
    workerId: z.uuid().optional(),
    assetId: z.uuid().optional(),
    includeCancelled: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  })
  .superRefine((v, ctx) => {
    if (!isOnOrAfter(v.from, v.to)) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'END_BEFORE_START' });
    } else if (dayCount(v.from, v.to) > 400) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'RANGE_TOO_LONG' });
    }
  });
export type AllocationListQuery = z.output<typeof allocationListQuerySchema>;

/** GET /allocations/availability — who is free for a day + time window. */
export const availabilityQuerySchema = z
  .object({
    kind: z.enum(ALLOCATION_KINDS).default('worker'),
    fromDate: dateOnlySchema,
    toDate: optionalDate,
    startTime: timeSchema.default('08:00'),
    endTime: timeSchema.default('17:00'),
    skipSundays: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  })
  .superRefine(refineRange);
export type AvailabilityQuery = z.output<typeof availabilityQuerySchema>;

export interface AllocationDto {
  id: string;
  kind: AllocationKind;
  workerId: string | null;
  assetId: string | null;
  projectId: string;
  startAt: string;
  endAt: string;
  status: 'PLANNED' | 'CANCELLED';
  notes: string | null;
  operatorWorkerId: string | null;
  project: { id: string; code: string; name: string };
  worker: { id: string; code: string; fullName: string; skill: WorkerSkill } | null;
  asset: { id: string; code: string; name: string; category: AssetCategory } | null;
  operator: { id: string; code: string; fullName: string } | null;
}

/** One clash reported with 409 ALLOCATION_OVERLAP (details.conflicts). */
export interface AllocationConflict {
  kind: AllocationKind;
  /** The worker / asset that is double-booked. */
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  /** The booking that is already there. */
  allocationId: string;
  projectId: string;
  projectName: string;
  startAt: string;
  endAt: string;
  /** The slot that was asked for. */
  requestedStartAt: string;
  requestedEndAt: string;
}

export interface AvailabilityDto {
  free: { id: string; code: string; name: string }[];
  busy: { id: string; code: string; name: string; projects: string[] }[];
}

// ── Daily entry ─────────────────────────────────────────────────────────
export const dailyEntryQuerySchema = z.object({ date: dateOnlySchema, projectId: requiredUuid });
export type DailyEntryQuery = z.output<typeof dailyEntryQuerySchema>;

export const attendanceRowSchema = z.object({
  workerId: requiredUuid,
  status: enumField(ATTENDANCE_STATUSES),
  otHours: optionalQty,
  notes: optionalText(500),
});

export const usageRowSchema = z.object({
  /** Existing usage log (to update it). */
  id: optionalUuid,
  assetId: requiredUuid,
  startMeter: optionalQty,
  endMeter: optionalQty,
  /** Needed when the hours cannot be worked out from an hour meter. */
  hoursUsed: optionalQty,
  fuelLitres: optionalQty,
  fuelCost: optionalMoney,
  operatorWorkerId: optionalUuid,
  notes: optionalText(500),
});

export const dailyExpenseRowSchema = z.object({
  id: optionalUuid,
  category: enumField(EXPENSE_CATEGORIES),
  description: requiredText(300),
  amount: positiveMoney,
  paidBy: enumField(EXPENSE_PAID_BY),
  supplierId: optionalUuid,
  assetId: optionalUuid,
  receiptDocumentId: optionalUuid,
});

/**
 * PUT /daily-entry — the full set for one project and day. Rows left out are removed; everything
 * is saved in one transaction.
 */
export const dailyEntrySaveSchema = z
  .object({
    date: dateOnlySchema,
    projectId: requiredUuid,
    attendance: z.array(attendanceRowSchema).max(300, 'TOO_MANY'),
    usage: z.array(usageRowSchema).max(100, 'TOO_MANY'),
    expenses: z.array(dailyExpenseRowSchema).max(200, 'TOO_MANY'),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.attendance.forEach((row, i) => {
      if (seen.has(row.workerId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['attendance', i, 'workerId'],
          message: 'DUPLICATE_WORKER',
        });
      }
      seen.add(row.workerId);
    });
    v.usage.forEach((row, i) => {
      if (row.startMeter && row.endMeter && Number(row.endMeter) < Number(row.startMeter)) {
        ctx.addIssue({
          code: 'custom',
          path: ['usage', i, 'endMeter'],
          message: 'END_METER_BEFORE_START',
        });
      }
    });
  });
export type DailyEntrySaveInput = z.input<typeof dailyEntrySaveSchema>;
export type DailyEntrySave = z.output<typeof dailyEntrySaveSchema>;

export interface DailyWorkerRow {
  workerId: string;
  code: string;
  fullName: string;
  nameSinhala: string | null;
  skill: WorkerSkill;
  type: WorkerType;
  /** Planned for this project on this day. */
  allocated: boolean;
  /** Times of the plan ("08:00–17:00"), when allocated. */
  plannedTimes: string[];
  attendance: {
    id: string;
    status: AttendanceStatus;
    otHours: string;
    notes: string | null;
  } | null;
  /** The worker's attendance on this day is already recorded at another project. */
  otherProject: { id: string; code: string; name: string } | null;
}

export interface DailyUsageRow {
  id: string | null;
  assetId: string;
  code: string;
  name: string;
  category: AssetCategory;
  meterType: MeterType;
  currentMeter: string;
  allocated: boolean;
  plannedTimes: string[];
  startMeter: string | null;
  endMeter: string | null;
  hoursUsed: string | null;
  fuelLitres: string | null;
  fuelCost: string | null;
  operatorWorkerId: string | null;
  operatorName: string | null;
  notes: string | null;
}

export interface ExpenseDto {
  id: string;
  date: string;
  projectId: string | null;
  assetId: string | null;
  category: ExpenseCategory;
  description: string;
  amount: string;
  paidBy: ExpensePaidBy;
  supplierId: string | null;
  receiptDocumentId: string | null;
  project: { id: string; code: string; name: string } | null;
  asset: { id: string; code: string; name: string } | null;
  supplier: { id: string; code: string; name: string } | null;
  receipt: { id: string; title: string; currentVersionId: string | null } | null;
  createdAt: string;
}

export interface DailyEntryDto {
  date: string;
  project: { id: string; code: string; name: string };
  /** Salaries for this month are finalized: nothing can be changed. */
  locked: boolean;
  workers: DailyWorkerRow[];
  usage: DailyUsageRow[];
  expenses: ExpenseDto[];
}

export interface CopyFromDto {
  /** The day that was copied, or null when nothing was found in the last 31 days. */
  date: string | null;
  attendance: {
    workerId: string;
    code: string;
    fullName: string;
    nameSinhala: string | null;
    skill: WorkerSkill;
    type: WorkerType;
    status: AttendanceStatus;
    otHours: string;
    otherProject: { id: string; code: string; name: string } | null;
  }[];
}

// ── Attendance (read-only lists) ────────────────────────────────────────
export const attendanceQuerySchema = z
  .object({
    workerId: z.uuid().optional(),
    projectId: z.uuid().optional(),
    from: dateOnlySchema,
    to: dateOnlySchema,
  })
  .superRefine((v, ctx) => {
    if (!isOnOrAfter(v.from, v.to)) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'END_BEFORE_START' });
    } else if (dayCount(v.from, v.to) > 400) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'RANGE_TOO_LONG' });
    }
  });
export type AttendanceQuery = z.output<typeof attendanceQuerySchema>;

export interface AttendanceDto {
  id: string;
  workerId: string;
  date: string;
  projectId: string | null;
  status: AttendanceStatus;
  otHours: string;
  notes: string | null;
  payrollRunId: string | null;
  project: { id: string; code: string; name: string } | null;
}

// ── Expenses ────────────────────────────────────────────────────────────
const expenseFields = z.object({
  date: dateOnlySchema,
  projectId: optionalUuid,
  assetId: optionalUuid,
  category: enumField(EXPENSE_CATEGORIES),
  description: requiredText(300),
  amount: positiveMoney,
  paidBy: enumField(EXPENSE_PAID_BY),
  supplierId: optionalUuid,
  receiptDocumentId: optionalUuid,
});
const refineCredit = (v: { paidBy?: string; supplierId?: string | null }, ctx: z.RefinementCtx) => {
  if (v.paidBy === 'CREDIT' && v.supplierId === null) {
    ctx.addIssue({ code: 'custom', path: ['supplierId'], message: 'SUPPLIER_REQUIRED_FOR_CREDIT' });
  }
};
export const expenseCreateSchema = expenseFields.superRefine((v, ctx) => {
  if (v.paidBy === 'CREDIT' && !v.supplierId) {
    ctx.addIssue({ code: 'custom', path: ['supplierId'], message: 'SUPPLIER_REQUIRED_FOR_CREDIT' });
  }
});
export type ExpenseCreateInput = z.input<typeof expenseCreateSchema>;
export type ExpenseCreate = z.output<typeof expenseCreateSchema>;
export const expenseUpdateSchema = expenseFields.partial().superRefine(refineCredit);
export type ExpenseUpdate = z.output<typeof expenseUpdateSchema>;

export const expenseListQuerySchema = paginationQuerySchema.extend({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  projectId: z.uuid().optional(),
  assetId: z.uuid().optional(),
  supplierId: z.uuid().optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
});
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

export interface ExpenseListDto {
  items: ExpenseDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Sum of all matching expenses (not only this page). */
  totalAmount: string;
}

// ── Machine usage & maintenance ─────────────────────────────────────────
export const usageListQuerySchema = paginationQuerySchema.extend({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
export type UsageListQuery = z.infer<typeof usageListQuerySchema>;

export interface UsageLogDto {
  id: string;
  assetId: string;
  projectId: string | null;
  date: string;
  startMeter: string | null;
  endMeter: string | null;
  hoursUsed: string;
  fuelLitres: string | null;
  fuelCost: string | null;
  operatorWorkerId: string | null;
  notes: string | null;
  project: { id: string; code: string; name: string } | null;
  operator: { id: string; code: string; fullName: string } | null;
}

const maintenanceFields = z.object({
  date: dateOnlySchema,
  type: enumField(MAINTENANCE_TYPES),
  description: requiredText(500),
  meterReading: optionalQty,
  cost: optionalMoney,
  supplierId: optionalUuid,
  nextServiceMeter: optionalQty,
});
export const maintenanceCreateSchema = maintenanceFields;
export type MaintenanceCreateInput = z.input<typeof maintenanceCreateSchema>;
export type MaintenanceCreate = z.output<typeof maintenanceCreateSchema>;
export const maintenanceUpdateSchema = maintenanceFields.partial();
export type MaintenanceUpdate = z.output<typeof maintenanceUpdateSchema>;

export interface MaintenanceDto {
  id: string;
  assetId: string;
  date: string;
  type: MaintenanceType;
  description: string;
  meterReading: string | null;
  cost: string;
  supplierId: string | null;
  nextServiceMeter: string | null;
  supplier: { id: string; code: string; name: string } | null;
}

export const SERVICE_STATES = ['OK', 'DUE_SOON', 'OVERDUE', 'NOT_TRACKED'] as const;
export type ServiceState = (typeof SERVICE_STATES)[number];

export interface ServiceStatusDto {
  meterType: MeterType;
  currentMeter: string;
  lastServiceMeter: string | null;
  interval: string | null;
  /** Meter reading when the next service is due. */
  dueAt: string | null;
  /** Hours / km left until the service (negative = overdue). */
  remaining: string | null;
  state: ServiceState;
}

// ── Purchases & store ───────────────────────────────────────────────────
export const purchaseLineSchema = z.object({
  materialId: requiredUuid,
  quantity: positiveQty,
  unitPrice: nonNegativeMoneySchema,
  /** Empty = delivered to the main store. */
  projectId: optionalUuid,
});

const purchaseFields = z.object({
  supplierId: requiredUuid,
  date: dateOnlySchema,
  invoiceNo: optionalText(100),
  paymentType: enumField(PURCHASE_PAYMENT_TYPES),
  notes: optionalText(1000),
  lines: z.array(purchaseLineSchema).min(1, 'NO_LINES').max(100, 'TOO_MANY'),
});
export const purchaseCreateSchema = purchaseFields;
export type PurchaseCreateInput = z.input<typeof purchaseCreateSchema>;
export type PurchaseCreate = z.output<typeof purchaseCreateSchema>;
/** PATCH replaces the lines when `lines` is given. */
export const purchaseUpdateSchema = purchaseFields.partial();
export type PurchaseUpdate = z.output<typeof purchaseUpdateSchema>;

export const purchaseListQuerySchema = paginationQuerySchema.extend({
  supplierId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  paymentType: z.enum(PURCHASE_PAYMENT_TYPES).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
export type PurchaseListQuery = z.infer<typeof purchaseListQuerySchema>;

export interface PurchaseLineDto {
  id: string;
  materialId: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  projectId: string | null;
  material: { id: string; name: string; nameSinhala: string | null; unit: string };
  project: { id: string; code: string; name: string } | null;
}

export interface PurchaseDto {
  id: string;
  supplierId: string;
  date: string;
  invoiceNo: string | null;
  paymentType: PurchasePaymentType;
  notes: string | null;
  total: string;
  supplier: { id: string; code: string; name: string };
  lines: PurchaseLineDto[];
  createdAt: string;
}

export interface StockRowDto {
  materialId: string;
  name: string;
  nameSinhala: string | null;
  unit: string;
  category: string;
  purchasedQty: string;
  issuedQty: string;
  stock: string;
  averageCost: string;
  value: string;
}

export interface StockDto {
  items: StockRowDto[];
  totalValue: string;
}

export const storeIssueCreateSchema = z.object({
  materialId: requiredUuid,
  projectId: requiredUuid,
  date: dateOnlySchema,
  quantity: positiveQty,
  notes: optionalText(500),
});
export type StoreIssueCreateInput = z.input<typeof storeIssueCreateSchema>;
export type StoreIssueCreate = z.output<typeof storeIssueCreateSchema>;

export const storeIssueListQuerySchema = paginationQuerySchema.extend({
  materialId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
export type StoreIssueListQuery = z.infer<typeof storeIssueListQuerySchema>;

export interface StoreIssueDto {
  id: string;
  materialId: string;
  projectId: string;
  date: string;
  quantity: string;
  unitCost: string;
  /** quantity × unitCost */
  amount: string;
  notes: string | null;
  material: { id: string; name: string; nameSinhala: string | null; unit: string };
  project: { id: string; code: string; name: string };
}

// ── Supplier payments & statement ───────────────────────────────────────
export const supplierPaymentCreateSchema = z.object({
  date: dateOnlySchema,
  amount: positiveMoney,
  method: enumField(PAYMENT_METHODS),
  reference: optionalText(100),
  notes: optionalText(500),
});
export type SupplierPaymentCreateInput = z.input<typeof supplierPaymentCreateSchema>;
export type SupplierPaymentCreate = z.output<typeof supplierPaymentCreateSchema>;

export const statementQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
export type StatementQuery = z.output<typeof statementQuerySchema>;

export const STATEMENT_ENTRY_KINDS = ['PURCHASE', 'EXPENSE', 'PAYMENT'] as const;
export type StatementEntryKind = (typeof STATEMENT_ENTRY_KINDS)[number];

export interface StatementEntryDto {
  kind: StatementEntryKind;
  id: string;
  date: string;
  description: string;
  reference: string | null;
  /** What we owe more (credit purchase / expense). */
  debit: string;
  /** What we paid. */
  credit: string;
  /** Amount owed after this entry. */
  balance: string;
  method?: PaymentMethod;
}

export interface StatementDto {
  supplier: { id: string; code: string; name: string };
  from: string | null;
  to: string | null;
  openingBalance: string;
  entries: StatementEntryDto[];
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
}

export interface SupplierBalanceDto {
  supplierId: string;
  code: string;
  name: string;
  credit: string;
  paid: string;
  balance: string;
}

// ── Advances ────────────────────────────────────────────────────────────
const advanceFields = z.object({
  date: dateOnlySchema,
  amount: positiveMoney,
  reason: optionalText(300),
  recoveryPerMonth: optionalMoney,
});
const refineRecovery = (
  v: { amount?: string; recoveryPerMonth?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (v.amount && v.recoveryPerMonth && Number(v.recoveryPerMonth) > Number(v.amount)) {
    ctx.addIssue({
      code: 'custom',
      path: ['recoveryPerMonth'],
      message: 'RECOVERY_MORE_THAN_AMOUNT',
    });
  }
};
export const advanceCreateSchema = advanceFields.superRefine(refineRecovery);
export type AdvanceCreateInput = z.input<typeof advanceCreateSchema>;
export type AdvanceCreate = z.output<typeof advanceCreateSchema>;
export const advanceUpdateSchema = advanceFields.partial().superRefine(refineRecovery);
export type AdvanceUpdate = z.output<typeof advanceUpdateSchema>;

export const advanceListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ADVANCE_STATUSES).optional(),
  workerId: z.uuid().optional(),
});
export type AdvanceListQuery = z.infer<typeof advanceListQuerySchema>;

export interface AdvanceDto {
  id: string;
  workerId: string;
  date: string;
  amount: string;
  reason: string | null;
  recoveryPerMonth: string | null;
  status: AdvanceStatus;
  recovered: string;
  balance: string;
  recoveryCount: number;
  worker: { id: string; code: string; fullName: string; type: WorkerType };
}

export interface AdvanceListDto {
  items: AdvanceDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Sum of the balances of all matching advances. */
  totalBalance: string;
}

/** Usage numbers worked out from meter readings (pure; used by the API and the Daily Entry form). */
export function usageFromMeters(input: {
  meterType: MeterType;
  startMeter?: string | null;
  endMeter?: string | null;
  hoursUsed?: string | null;
}): { hours: string | null; distance: string | null } {
  const hasBoth = Boolean(input.startMeter) && Boolean(input.endMeter);
  const diff = hasBoth ? subtractQty(input.endMeter!, input.startMeter!) : null;
  if (input.meterType === 'HOURS' && diff !== null) return { hours: diff, distance: null };
  return {
    hours: input.hoursUsed ? input.hoursUsed : null,
    distance: input.meterType === 'KM' ? diff : null,
  };
}

/** a − b for quantity strings (≤ 3 dp), exact (integer thousandths). */
export function subtractQty(a: string, b: string): string {
  const toMilli = (s: string) => {
    const neg = s.startsWith('-');
    const [int = '0', frac = ''] = (neg ? s.slice(1) : s).split('.');
    const v = BigInt(int || '0') * 1000n + BigInt((frac + '000').slice(0, 3));
    return neg ? -v : v;
  };
  const r = toMilli(a) - toMilli(b);
  const neg = r < 0n;
  const abs = neg ? -r : r;
  const int = abs / 1000n;
  const frac = (abs % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}
