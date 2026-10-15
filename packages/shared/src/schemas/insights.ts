import { z } from 'zod';
import { EXPENSE_CATEGORIES, type NotificationSeverity } from '../enums';
import { dateOnlySchema, isOnOrAfter } from './common';
import { paginationQuerySchema } from './pagination';
import type { ProjectHealthDto } from './finance';

/**
 * Step 5 — reminders / notifications, the dashboard and the reports.
 */

// ── Notifications ───────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = [
  'DOCUMENT_EXPIRY',
  'BOND_EXPIRY',
  'SERVICE_DUE',
  'PROJECT_DEADLINE',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * i18n keys (under `notifications.titles`) of the sentences shown for a notification.
 * The web fills them with `params` (+ `days`, counted from `dueDate`).
 */
export const NOTIFICATION_TITLE_KEYS = [
  'documentExpires',
  'documentExpired',
  'bondExpires',
  'bondExpired',
  'serviceDue',
  'serviceOverdue',
  'deadlineSoon',
  'deadlinePassed',
  // dashboard-only items (not stored)
  'overBudget',
  'costAheadOfProgress',
  'behindSchedule',
] as const;
export type NotificationTitleKey = (typeof NOTIFICATION_TITLE_KEYS)[number];

/** Days before the deadline when a project deadline reminder starts (overview §7). */
export const DEADLINE_REMINDER_DAYS = 14;

export const notificationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['open', 'all']).default('open'),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  severity: z.enum(['INFO', 'WARNING', 'DANGER']).optional(),
});
export type NotificationListQuery = z.output<typeof notificationListQuerySchema>;

/** What a notification points at; the web builds the link from it. */
export type NotificationEntityType = 'DOCUMENT' | 'BOND' | 'ASSET' | 'PROJECT';

export interface NotificationDto {
  id: string;
  type: NotificationType | 'HEALTH';
  severity: NotificationSeverity;
  titleKey: NotificationTitleKey;
  /** Sentence parts (names, codes, enum values) — see the reminder rules. */
  params: Record<string, string | null>;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  dueDate: string | null;
  readAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface NotificationCountDto {
  /** Open and not read yet (the bell badge). */
  unread: number;
  /** All open (unresolved). */
  open: number;
}

// ── Dashboard ───────────────────────────────────────────────────────────
export interface DashboardSeriesPoint {
  /** "YYYY-MM" */
  month: string;
  spent: string;
  received: string;
}

export interface DashboardDto {
  today: string;
  /** "YYYY-MM" of today */
  month: string;
  kpis: {
    activeProjects: number;
    workersOnSiteToday: number;
    /** ATTENDANCE = recorded today; PLAN = from today's allocations (nothing recorded yet). */
    workersSource: 'ATTENDANCE' | 'PLAN';
    spentThisMonth: string;
    moneyToReceive: string;
  };
  /** At most 8, most urgent first. */
  attention: NotificationDto[];
  attentionTotal: number;
  projects: ProjectHealthDto[];
  series: DashboardSeriesPoint[];
  /** Filled by Step 6 (backup status). */
  backup: null;
}

// ── Reports ─────────────────────────────────────────────────────────────
export const REPORT_FORMATS = ['pdf', 'xlsx'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const REPORT_IDS = [
  'project-cost',
  'payroll-sheet',
  'payslips',
  'epf-etf',
  'attendance',
  'asset-utilisation',
  'expenses',
  'supplier-statement',
  'ipc',
  'expiry',
  'business-summary',
] as const;
export type ReportId = (typeof REPORT_IDS)[number];

/** The filters a report asks for in the web side panel. */
export type ReportFilter =
  | 'project'
  | 'month'
  | 'dateRange'
  | 'worker'
  | 'asset'
  | 'supplier'
  | 'certificate'
  | 'daysAhead'
  | 'expenseCategory';

export interface ReportDefinition {
  id: ReportId;
  /** R1 … R11 (overview §9) */
  code: string;
  formats: readonly ReportFormat[];
  /** Filters shown in the panel; `required` ones must be chosen before downloading. */
  filters: readonly ReportFilter[];
  required: readonly ReportFilter[];
  landscape: boolean;
}

export const REPORTS: readonly ReportDefinition[] = [
  {
    id: 'project-cost',
    code: 'R1',
    formats: ['pdf', 'xlsx'],
    filters: ['project', 'dateRange'],
    required: ['project'],
    landscape: false,
  },
  {
    id: 'payroll-sheet',
    code: 'R2',
    formats: ['pdf', 'xlsx'],
    filters: ['month'],
    required: ['month'],
    landscape: true,
  },
  {
    id: 'payslips',
    code: 'R3',
    formats: ['pdf'],
    filters: ['month', 'worker'],
    required: ['month'],
    landscape: false,
  },
  {
    id: 'epf-etf',
    code: 'R4',
    formats: ['pdf', 'xlsx'],
    filters: ['month'],
    required: ['month'],
    landscape: false,
  },
  {
    id: 'attendance',
    code: 'R5',
    formats: ['pdf', 'xlsx'],
    filters: ['month', 'project'],
    required: ['month'],
    landscape: true,
  },
  {
    id: 'asset-utilisation',
    code: 'R6',
    formats: ['pdf', 'xlsx'],
    filters: ['dateRange', 'asset'],
    required: [],
    landscape: false,
  },
  {
    id: 'expenses',
    code: 'R7',
    formats: ['pdf', 'xlsx'],
    filters: ['dateRange', 'project', 'expenseCategory'],
    required: [],
    landscape: false,
  },
  {
    id: 'supplier-statement',
    code: 'R8',
    formats: ['pdf', 'xlsx'],
    filters: ['supplier', 'dateRange'],
    required: [],
    landscape: false,
  },
  {
    id: 'ipc',
    code: 'R9',
    formats: ['pdf'],
    filters: ['project', 'certificate'],
    required: ['project', 'certificate'],
    landscape: false,
  },
  {
    id: 'expiry',
    code: 'R10',
    formats: ['pdf', 'xlsx'],
    filters: ['daysAhead'],
    required: [],
    landscape: false,
  },
  {
    id: 'business-summary',
    code: 'R11',
    formats: ['pdf', 'xlsx'],
    filters: ['month'],
    required: ['month'],
    landscape: false,
  },
];

export const reportDefinition = (id: string): ReportDefinition | undefined =>
  REPORTS.find((r) => r.id === id);

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
export const monthSchema = z.string().regex(MONTH_REGEX, 'INVALID_MONTH');

const rangeRefine = (v: { from?: string; to?: string }, ctx: z.RefinementCtx) => {
  if (!isOnOrAfter(v.from, v.to)) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'END_BEFORE_START' });
  }
};

/** Query of every report endpoint: `GET /reports/:id?format=pdf&locale=si&…` */
export const reportBaseQuerySchema = z.object({
  format: z.enum(REPORT_FORMATS).default('pdf'),
  locale: z.enum(['en', 'si']).optional(),
});

const optUuid = z.uuid('INVALID').optional();

export const REPORT_PARAM_SCHEMAS = {
  'project-cost': z
    .object({
      projectId: z.uuid('INVALID'),
      from: dateOnlySchema.optional(),
      to: dateOnlySchema.optional(),
    })
    .superRefine(rangeRefine),
  'payroll-sheet': z.object({ month: monthSchema }),
  payslips: z.object({ month: monthSchema, workerId: optUuid }),
  'epf-etf': z.object({ month: monthSchema }),
  attendance: z.object({ month: monthSchema, projectId: optUuid }),
  'asset-utilisation': z
    .object({ from: dateOnlySchema.optional(), to: dateOnlySchema.optional(), assetId: optUuid })
    .superRefine(rangeRefine),
  expenses: z
    .object({
      from: dateOnlySchema.optional(),
      to: dateOnlySchema.optional(),
      projectId: optUuid,
      category: z.enum(EXPENSE_CATEGORIES).optional(),
    })
    .superRefine(rangeRefine),
  'supplier-statement': z
    .object({ supplierId: optUuid, from: dateOnlySchema.optional(), to: dateOnlySchema.optional() })
    .superRefine(rangeRefine),
  ipc: z.object({ projectId: z.uuid('INVALID'), certificateId: z.uuid('INVALID') }),
  expiry: z.object({ days: z.coerce.number().int().min(0).max(3650).default(30) }),
  'business-summary': z.object({ month: monthSchema }),
} as const satisfies Record<ReportId, z.ZodType>;

export type ReportParams<T extends ReportId> = z.output<(typeof REPORT_PARAM_SCHEMAS)[T]>;

// ── Notification sentences (shared by the web and the API e-mail / reports) ──
function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface NotificationLabels {
  /** e.g. ('documentCategory', 'INSURANCE') → "Insurance" */
  enumLabel: (enumName: string, value: string) => string;
  /** "the company" — owner of company documents */
  company: string;
  /** meter unit: HOURS → "hours", KM → "km" */
  unit: (meterType: string) => string;
}

const nameWithCode = (name: string | null | undefined, code: string | null | undefined) =>
  name && code ? `${name} (${code})` : (name ?? code ?? '');

/**
 * The values for a notification's ICU sentence (`notifications.titles.<titleKey>`):
 * category, owner, bondType, referenceNo, project, asset, dueAt, unit and `days`
 * (whole days to the due date, or since it passed — always ≥ 0).
 */
export function notificationValues(
  n: { params: Record<string, string | null | undefined>; dueDate: string | null },
  today: string,
  labels: NotificationLabels,
): Record<string, string | number> {
  const p = n.params;
  const diff = n.dueDate ? dayDiff(today, n.dueDate) : 0;
  return {
    category: p.category ? labels.enumLabel('documentCategory', p.category) : '',
    owner: p.ownerType === 'COMPANY' ? labels.company : nameWithCode(p.ownerName, p.ownerCode),
    bondType: p.bondType ? labels.enumLabel('bondType', p.bondType) : '',
    referenceNo: p.referenceNo ?? '',
    project: nameWithCode(p.projectName, p.projectCode),
    asset: nameWithCode(p.assetName, p.assetCode),
    dueAt: p.dueAt ? String(Number(p.dueAt)) : '',
    unit: p.meterType ? labels.unit(p.meterType) : '',
    days: Math.abs(diff),
  };
}
