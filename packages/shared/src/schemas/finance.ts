import { z } from 'zod';
import {
  BOND_STATUSES,
  BOND_TYPES,
  BUDGET_CATEGORIES,
  CERTIFICATE_STATUSES,
  CLIENT_PAYMENT_KINDS,
  PAYMENT_METHODS,
  VARIATION_STATUSES,
  type BondStatus,
  type BondType,
  type BudgetCategory,
  type CertificateStatus,
  type ClientPaymentKind,
  type PaymentMethod,
  type ProjectStatus,
  type VariationStatus,
} from '../enums';
import { moneySchema, nonNegativeMoneySchema, nonNegativeQtySchema } from '../money';
import {
  dateOnlySchema,
  enumField,
  isOnOrAfter,
  optionalDate,
  optionalMoney,
  optionalText,
  optionalUuid,
  requiredText,
} from './common';
import { paginationQuerySchema } from './pagination';

/**
 * Step 4 — contractor finance: project costing & health, BOQ & progress, variations, extensions
 * of time, payment certificates (IPC), client payments and bonds.
 */

const positiveMoney = nonNegativeMoneySchema.refine((v) => Number(v) > 0, {
  message: 'MUST_BE_POSITIVE',
});

const refineRange =
  (fromKey: string, toKey: string) => (v: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const from = v[fromKey] as string | null | undefined;
    const to = v[toKey] as string | null | undefined;
    if (!isOnOrAfter(from, to)) {
      ctx.addIssue({ code: 'custom', path: [toKey], message: 'END_BEFORE_START' });
    }
  };

// ── Costing & health ────────────────────────────────────────────────────
export const HEALTH_FLAGS = ['OVER_BUDGET', 'COST_AHEAD_OF_PROGRESS', 'BEHIND_SCHEDULE'] as const;
export type HealthFlag = (typeof HEALTH_FLAGS)[number];

/** Difference (percentage points) above which a project is flagged (overview §7). */
export const HEALTH_FLAG_THRESHOLD = 15;

export const costQuerySchema = paginationQuerySchema
  .extend({
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    /** Which category's entries to list (default LABOUR). */
    category: z.enum(BUDGET_CATEGORIES).optional(),
  })
  .superRefine(refineRange('from', 'to'));
export type CostQuery = z.output<typeof costQuerySchema>;

export type CostEntryKind = 'LABOUR' | 'PURCHASE' | 'ISSUE' | 'MACHINE' | 'FUEL' | 'EXPENSE';

/** One line behind a category total. Labour is one entry per worker. */
export interface CostEntryDto {
  kind: CostEntryKind;
  /** Day of the entry (null for labour, which is summed per worker). */
  date: string | null;
  description: string;
  /** Code / reference shown next to the description (worker code, invoice no …). */
  reference: string | null;
  /** "12.5 days", "40 h", "100 bag" — a quantity string with its unit key. */
  quantity: string | null;
  unit: string | null;
  amount: string;
  estimated: boolean;
  /** Link target (worker / asset / supplier / expense id). */
  refId: string | null;
}

export interface CostCategoryDto {
  category: BudgetCategory;
  budget: string;
  actual: string;
  /** budget − actual (negative = over budget). */
  variance: string;
  /** actual / budget × 100, null without a budget. */
  pct: string | null;
  estimated: boolean;
  count: number;
}

export interface ProjectCostsDto {
  from: string | null;
  to: string | null;
  byCategory: CostCategoryDto[];
  total: { budget: string; actual: string; variance: string; pct: string | null };
  /** Labour of permanent staff not finalized in payroll yet is estimated from the rates. */
  estimated: boolean;
  entries: {
    category: BudgetCategory;
    items: CostEntryDto[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface ProjectHealthDto {
  projectId: string;
  code: string;
  name: string;
  status: ProjectStatus;
  clientName: string;
  /** today vs start → current end date, 0–100. */
  timePct: string;
  /** actual cost / budget × 100 (can exceed 100), null without a budget. */
  budgetPct: string | null;
  /** BOQ physical progress, or the manual progress % when there is no BOQ. */
  physicalPct: string;
  physicalSource: 'BOQ' | 'MANUAL' | 'NONE';
  budget: string;
  actual: string;
  estimated: boolean;
  currentEndDate: string;
  flags: HealthFlag[];
}

export const progressPctSchema = z.object({
  progressPct: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100, {
      message: 'PERCENT_TOO_HIGH',
    }),
});
export type ProgressPctUpdate = z.output<typeof progressPctSchema>;

// ── BOQ & progress ──────────────────────────────────────────────────────
const boqItemFields = z.object({
  itemNo: requiredText(30),
  description: requiredText(500),
  unit: requiredText(20),
  quantity: nonNegativeQtySchema,
  rate: nonNegativeMoneySchema,
  sortOrder: z.coerce.number().int().min(0).max(100_000).optional(),
  /** Item added by a variation. */
  variationId: optionalUuid,
});
export const boqItemCreateSchema = boqItemFields;
export type BoqItemCreateInput = z.input<typeof boqItemCreateSchema>;
export type BoqItemCreate = z.output<typeof boqItemCreateSchema>;
export const boqItemUpdateSchema = boqItemFields.partial();
export type BoqItemUpdate = z.output<typeof boqItemUpdateSchema>;

/** The columns of a BOQ import file (CSV / Excel), in this order. */
export const BOQ_IMPORT_COLUMNS = ['itemNo', 'description', 'unit', 'quantity', 'rate'] as const;
export const BOQ_IMPORT_MAX_ROWS = 1000;

/** POST /projects/:id/boq/import — the rows confirmed after the preview. */
export const boqImportSchema = z.object({
  rows: z
    .array(boqItemFields.omit({ sortOrder: true, variationId: true }))
    .min(1, 'NO_LINES')
    .max(BOQ_IMPORT_MAX_ROWS, 'TOO_MANY'),
  /** Replace the whole BOQ (only allowed while no progress is recorded). */
  replace: z.boolean().optional(),
});
export type BoqImportInput = z.input<typeof boqImportSchema>;
export type BoqImport = z.output<typeof boqImportSchema>;

export interface BoqImportPreviewRow {
  line: number;
  itemNo: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string | null;
  /** Validation codes per field (errors.validation.<code>). */
  errors: { field: string; message: string }[];
}

export interface BoqImportPreviewDto {
  fileName: string;
  rows: BoqImportPreviewRow[];
  validCount: number;
  errorCount: number;
  total: string;
}

export const measurementCreateSchema = z.object({
  date: dateOnlySchema,
  cumulativeQty: nonNegativeQtySchema,
  notes: optionalText(300),
});
export type MeasurementCreate = z.output<typeof measurementCreateSchema>;

/** POST /projects/:id/progress — record progress for several items on one date. */
export const progressRecordSchema = z
  .object({
    date: dateOnlySchema,
    items: z
      .array(z.object({ boqItemId: z.uuid('INVALID'), cumulativeQty: nonNegativeQtySchema }))
      .min(1, 'NO_LINES')
      .max(BOQ_IMPORT_MAX_ROWS, 'TOO_MANY'),
    notes: optionalText(300),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.items.forEach((it, i) => {
      if (seen.has(it.boqItemId)) {
        ctx.addIssue({ code: 'custom', path: ['items', i, 'boqItemId'], message: 'DUPLICATE' });
      }
      seen.add(it.boqItemId);
    });
  });
export type ProgressRecordInput = z.input<typeof progressRecordSchema>;
export type ProgressRecord = z.output<typeof progressRecordSchema>;

export const progressQuerySchema = z.object({ asOf: dateOnlySchema.optional() });
export type ProgressQuery = z.output<typeof progressQuerySchema>;

export interface BoqItemDto {
  id: string;
  projectId: string;
  itemNo: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string;
  sortOrder: number;
  variationId: string | null;
  variation: { id: string; number: number; title: string; status: VariationStatus } | null;
  measurementCount: number;
}

export interface MeasurementDto {
  id: string;
  boqItemId: string;
  date: string;
  cumulativeQty: string;
  notes: string | null;
}

export interface ProgressItemDto {
  boqItemId: string;
  itemNo: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string;
  done: string;
  /** done / quantity × 100 (can exceed 100). */
  pct: string;
  amountDone: string;
  lastMeasuredOn: string | null;
  /** Item of a variation that is not approved: not counted in the totals. */
  excluded: boolean;
}

export interface ProgressDto {
  asOf: string;
  items: ProgressItemDto[];
  totalAmount: string;
  totalDone: string;
  /** Physical progress % = Σ(done × rate) / Σ(qty × rate). */
  physicalPct: string;
}

export interface MeasurementResultDto {
  measurement: MeasurementDto;
  /** OVER_QUANTITY when the cumulative quantity is above the BOQ quantity. */
  warnings: 'OVER_QUANTITY'[];
}

// ── Variations & extensions of time ─────────────────────────────────────
const variationFields = z.object({
  title: requiredText(200),
  date: dateOnlySchema,
  status: enumField(VARIATION_STATUSES).optional(),
  /** Change to the contract value (negative for an omission). */
  amountChange: moneySchema,
  notes: optionalText(1000),
});
export const variationCreateSchema = variationFields;
export type VariationCreateInput = z.input<typeof variationCreateSchema>;
export type VariationCreate = z.output<typeof variationCreateSchema>;
export const variationUpdateSchema = variationFields.partial();
export type VariationUpdate = z.output<typeof variationUpdateSchema>;

export interface VariationDto {
  id: string;
  projectId: string;
  number: number;
  title: string;
  date: string;
  status: VariationStatus;
  amountChange: string;
  notes: string | null;
  boqItemCount: number;
}

const eotFields = z.object({
  newEndDate: dateOnlySchema,
  approvedDate: dateOnlySchema,
  reference: optionalText(100),
  reason: optionalText(1000),
});
export const eotCreateSchema = eotFields;
export type EotCreateInput = z.input<typeof eotCreateSchema>;
export type EotCreate = z.output<typeof eotCreateSchema>;
export const eotUpdateSchema = eotFields.partial();
export type EotUpdate = z.output<typeof eotUpdateSchema>;

export interface EotDto {
  id: string;
  projectId: string;
  previousEndDate: string;
  newEndDate: string;
  approvedDate: string;
  reference: string | null;
  reason: string | null;
}

// ── Payment certificates (IPC) & client payments ────────────────────────
const certificateFields = z.object({
  periodFrom: optionalDate,
  periodTo: dateOnlySchema,
  /** Leave empty to use Σ(latest measurement ≤ periodTo × rate). */
  cumulativeWorkDone: optionalMoney,
  otherDeductions: optionalMoney,
  otherDeductionsNote: optionalText(300),
  notes: optionalText(1000),
});
export const certificateCreateSchema = certificateFields.superRefine(
  refineRange('periodFrom', 'periodTo'),
);
export type CertificateCreateInput = z.input<typeof certificateCreateSchema>;
export type CertificateCreate = z.output<typeof certificateCreateSchema>;
export const certificateUpdateSchema = certificateFields
  .partial()
  .superRefine(refineRange('periodFrom', 'periodTo'));
export type CertificateUpdate = z.output<typeof certificateUpdateSchema>;

/** POST .../certificates/:certId/status — one step forward (or SUBMITTED → DRAFT). */
export const certificateStatusSchema = z.object({
  status: enumField(CERTIFICATE_STATUSES),
  /** Submitted / certified date (defaults to today). */
  date: optionalDate,
});
export type CertificateStatusUpdate = z.output<typeof certificateStatusSchema>;

/** The allowed next statuses of a certificate. */
export const CERTIFICATE_TRANSITIONS: Record<CertificateStatus, CertificateStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['CERTIFIED', 'DRAFT'],
  CERTIFIED: ['PAID'],
  PAID: [],
};

/** Each step of the IPC calculation (shown in the "New bill" wizard). */
export interface IpcCalculationDto {
  cumulativeWorkDone: string;
  /** Σ(latest measurement ≤ periodTo × rate) — the default for cumulativeWorkDone. */
  measuredWorkDone: string;
  previousCertified: string;
  grossThisBill: string;
  retentionPct: string;
  retentionCap: string;
  retentionSoFar: string;
  retentionDeducted: string;
  retentionCapReached: boolean;
  advanceAmount: string;
  advanceRecoveryPct: string;
  advanceRecoveredSoFar: string;
  advanceRecovered: string;
  advanceFullyRecovered: boolean;
  otherDeductions: string;
  netPayable: string;
}

export interface CertificateDto {
  id: string;
  projectId: string;
  number: number;
  /** IPC-<project code>-01 */
  code: string;
  periodFrom: string;
  periodTo: string;
  cumulativeWorkDone: string;
  previousCertified: string;
  grossThisBill: string;
  retentionDeducted: string;
  advanceRecovered: string;
  otherDeductions: string;
  otherDeductionsNote: string | null;
  netPayable: string;
  status: CertificateStatus;
  submittedDate: string | null;
  certifiedDate: string | null;
  notes: string | null;
  /** Σ IPC payments linked to this certificate. */
  paid: string;
  calculation: IpcCalculationDto;
}

/** POST /projects/:id/certificates/preview — the calculation without saving. */
export const certificatePreviewSchema = certificateCreateSchema;

export const clientPaymentCreateSchema = z.object({
  date: dateOnlySchema,
  amount: positiveMoney,
  method: enumField(PAYMENT_METHODS),
  kind: enumField(CLIENT_PAYMENT_KINDS),
  certificateId: optionalUuid,
  reference: optionalText(100),
  notes: optionalText(500),
});
export type ClientPaymentCreateInput = z.input<typeof clientPaymentCreateSchema>;
export type ClientPaymentCreate = z.output<typeof clientPaymentCreateSchema>;

export interface ClientPaymentDto {
  id: string;
  projectId: string;
  certificateId: string | null;
  date: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  kind: ClientPaymentKind;
  notes: string | null;
  certificate: { id: string; number: number } | null;
}

export interface FinanceSummaryDto {
  contractValue: string;
  approvedVariations: string;
  /** contract value + approved variations */
  effectiveContractValue: string;
  /** Σ gross of submitted / certified / paid bills = work billed so far. */
  billedToDate: string;
  /** Σ gross of certified / paid bills. */
  certifiedToDate: string;
  /** Σ every client payment. */
  received: string;
  /** Σ net of submitted / certified / paid bills − Σ IPC payments. */
  receivable: string;
  retentionDeducted: string;
  retentionReleased: string;
  retentionHeld: string;
  advanceAmount: string;
  advanceReceived: string;
  advanceRecovered: string;
  advanceBalance: string;
}

// ── Bonds ───────────────────────────────────────────────────────────────
const bondFields = z.object({
  type: enumField(BOND_TYPES),
  bank: requiredText(150),
  referenceNo: requiredText(100),
  amount: positiveMoney,
  issueDate: dateOnlySchema,
  expiryDate: dateOnlySchema,
  status: enumField(BOND_STATUSES).optional(),
  notes: optionalText(1000),
});
export const bondCreateSchema = bondFields.superRefine(refineRange('issueDate', 'expiryDate'));
export type BondCreateInput = z.input<typeof bondCreateSchema>;
export type BondCreate = z.output<typeof bondCreateSchema>;
export const bondUpdateSchema = bondFields
  .partial()
  .superRefine(refineRange('issueDate', 'expiryDate'));
export type BondUpdate = z.output<typeof bondUpdateSchema>;

export const bondListQuerySchema = z.object({
  /** ACTIVE bonds expiring on or before today + N days (already expired ones included). */
  expiringWithin: z.coerce.number().int().min(0).max(3650).optional(),
  status: z.enum(BOND_STATUSES).optional(),
});
export type BondListQuery = z.output<typeof bondListQuerySchema>;

export interface BondDto {
  id: string;
  projectId: string;
  type: BondType;
  bank: string;
  referenceNo: string;
  amount: string;
  issueDate: string;
  expiryDate: string;
  status: BondStatus;
  notes: string | null;
  project: { id: string; code: string; name: string };
}
