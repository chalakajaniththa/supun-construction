import { z } from 'zod';

/**
 * Every enum of the data model (overview §6), defined once.
 * Each has: an `as const` array, a zod enum and a TS type.
 * Prisma enums in apps/api/prisma/schema.prisma mirror these exactly
 * (a unit test in the API checks that they stay in sync).
 */

// ── System ──────────────────────────────────────────────────────────────
export const NOTIFICATION_SEVERITIES = ['INFO', 'WARNING', 'DANGER'] as const;
export const NotificationSeverity = z.enum(NOTIFICATION_SEVERITIES);
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const BACKUP_STATUSES = ['RUNNING', 'SUCCESS', 'FAILED'] as const;
export const BackupStatus = z.enum(BACKUP_STATUSES);
export type BackupStatus = (typeof BACKUP_STATUSES)[number];

export const BACKUP_TRIGGERS = ['SCHEDULED', 'MANUAL'] as const;
export const BackupTrigger = z.enum(BACKUP_TRIGGERS);
export type BackupTrigger = (typeof BACKUP_TRIGGERS)[number];

export const BACKUP_DESTINATIONS = ['LOCAL', 'GDRIVE', 'BOTH'] as const;
export const BackupDestination = z.enum(BACKUP_DESTINATIONS);
export type BackupDestination = (typeof BACKUP_DESTINATIONS)[number];

export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
export const AuditAction = z.enum(AUDIT_ACTIONS);
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ── Parties ─────────────────────────────────────────────────────────────
export const CLIENT_TYPES = ['GOVERNMENT', 'PRIVATE'] as const;
export const ClientType = z.enum(CLIENT_TYPES);
export type ClientType = (typeof CLIENT_TYPES)[number];

export const SUPPLIER_TYPES = [
  'MATERIAL',
  'HARDWARE',
  'FUEL',
  'SUBCONTRACTOR',
  'EQUIPMENT_HIRE',
  'OTHER',
] as const;
export const SupplierType = z.enum(SUPPLIER_TYPES);
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

// ── Projects ────────────────────────────────────────────────────────────
export const PROJECT_TYPES = [
  'ROAD',
  'BUILDING',
  'SCHOOL_BUILDING',
  'BRIDGE_CULVERT',
  'IRRIGATION',
  'OTHER',
] as const;
export const ProjectType = z.enum(PROJECT_TYPES);
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_SOURCES = ['GOVERNMENT_TENDER', 'PRIVATE'] as const;
export const ProjectSource = z.enum(PROJECT_SOURCES);
export type ProjectSource = (typeof PROJECT_SOURCES)[number];

export const PROJECT_STATUSES = [
  'PLANNING',
  'ONGOING',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const;
export const ProjectStatus = z.enum(PROJECT_STATUSES);
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const BUDGET_CATEGORIES = [
  'LABOUR',
  'MATERIALS',
  'EQUIPMENT',
  'SUBCONTRACT',
  'OVERHEAD',
  'OTHER',
] as const;
export const BudgetCategory = z.enum(BUDGET_CATEGORIES);
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const VARIATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const VariationStatus = z.enum(VARIATION_STATUSES);
export type VariationStatus = (typeof VARIATION_STATUSES)[number];

export const CERTIFICATE_STATUSES = ['DRAFT', 'SUBMITTED', 'CERTIFIED', 'PAID'] as const;
export const CertificateStatus = z.enum(CERTIFICATE_STATUSES);
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'CHEQUE', 'BANK_TRANSFER'] as const;
export const PaymentMethod = z.enum(PAYMENT_METHODS);
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CLIENT_PAYMENT_KINDS = [
  'IPC_PAYMENT',
  'ADVANCE',
  'RETENTION_RELEASE',
  'OTHER',
] as const;
export const ClientPaymentKind = z.enum(CLIENT_PAYMENT_KINDS);
export type ClientPaymentKind = (typeof CLIENT_PAYMENT_KINDS)[number];

export const BOND_TYPES = [
  'BID_BOND',
  'PERFORMANCE_BOND',
  'ADVANCE_PAYMENT_GUARANTEE',
  'RETENTION_GUARANTEE',
] as const;
export const BondType = z.enum(BOND_TYPES);
export type BondType = (typeof BOND_TYPES)[number];

export const BOND_STATUSES = ['ACTIVE', 'RELEASED', 'EXPIRED'] as const;
export const BondStatus = z.enum(BOND_STATUSES);
export type BondStatus = (typeof BOND_STATUSES)[number];

// ── Documents ───────────────────────────────────────────────────────────
export const DOCUMENT_OWNER_TYPES = [
  'COMPANY',
  'PROJECT',
  'ASSET',
  'WORKER',
  'SUPPLIER',
  'CLIENT',
] as const;
export const DocumentOwnerType = z.enum(DOCUMENT_OWNER_TYPES);
export type DocumentOwnerType = (typeof DOCUMENT_OWNER_TYPES)[number];

export const DOCUMENT_CATEGORIES = [
  'PLAN_DRAWING',
  'CONTRACT',
  'BOQ',
  'PHOTO',
  'INVOICE',
  'RECEIPT',
  'LETTER',
  'ESTIMATE',
  'REVENUE_LICENCE',
  'INSURANCE',
  'EMISSION_TEST',
  'FITNESS_CERTIFICATE',
  'REGISTRATION_BOOK',
  'NIC_COPY',
  'CERTIFICATE',
  'CIDA_REGISTRATION',
  'BOND_COPY',
  'OTHER',
] as const;
export const DocumentCategory = z.enum(DOCUMENT_CATEGORIES);
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

// ── Workers ─────────────────────────────────────────────────────────────
export const WORKER_SKILLS = [
  'MASON',
  'CARPENTER',
  'HELPER',
  'MACHINE_OPERATOR',
  'DRIVER',
  'STEEL_FIXER',
  'ELECTRICIAN',
  'PLUMBER',
  'SUPERVISOR',
  'OTHER',
] as const;
export const WorkerSkill = z.enum(WORKER_SKILLS);
export type WorkerSkill = (typeof WORKER_SKILLS)[number];

export const WORKER_TYPES = ['DAILY', 'PERMANENT'] as const;
export const WorkerType = z.enum(WORKER_TYPES);
export type WorkerType = (typeof WORKER_TYPES)[number];

export const ALLOCATION_STATUSES = ['PLANNED', 'CANCELLED'] as const;
export const AllocationStatus = z.enum(ALLOCATION_STATUSES);
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE'] as const;
export const AttendanceStatus = z.enum(ATTENDANCE_STATUSES);
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ADVANCE_STATUSES = ['OPEN', 'RECOVERED'] as const;
export const AdvanceStatus = z.enum(ADVANCE_STATUSES);
export type AdvanceStatus = (typeof ADVANCE_STATUSES)[number];

// ── Assets ──────────────────────────────────────────────────────────────
export const ASSET_CATEGORIES = [
  'JCB_BACKHOE',
  'EXCAVATOR',
  'TIPPER',
  'CAB',
  'TRACTOR',
  'ROLLER',
  'CONCRETE_MIXER',
  'WATER_BOWSER',
  'COMPACTOR',
  'GENERATOR',
  'TOOL',
  'OTHER',
] as const;
export const AssetCategory = z.enum(ASSET_CATEGORIES);
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_OWNERSHIPS = ['OWNED', 'HIRED_IN'] as const;
export const AssetOwnership = z.enum(ASSET_OWNERSHIPS);
export type AssetOwnership = (typeof ASSET_OWNERSHIPS)[number];

export const ASSET_STATUSES = ['AVAILABLE', 'IN_USE', 'UNDER_REPAIR', 'DISPOSED'] as const;
export const AssetStatus = z.enum(ASSET_STATUSES);
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const METER_TYPES = ['HOURS', 'KM', 'NONE'] as const;
export const MeterType = z.enum(METER_TYPES);
export type MeterType = (typeof METER_TYPES)[number];

export const MAINTENANCE_TYPES = ['SERVICE', 'REPAIR', 'TYRE', 'OTHER'] as const;
export const MaintenanceType = z.enum(MAINTENANCE_TYPES);
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

// ── Materials, purchasing, expenses ─────────────────────────────────────
export const MATERIAL_CATEGORIES = [
  'CEMENT',
  'SAND',
  'AGGREGATE',
  'STEEL',
  'BRICKS_BLOCKS',
  'TIMBER',
  'HARDWARE',
  'FUEL',
  'OTHER',
] as const;
export const MaterialCategory = z.enum(MATERIAL_CATEGORIES);
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const PURCHASE_PAYMENT_TYPES = ['CASH', 'CREDIT'] as const;
export const PurchasePaymentType = z.enum(PURCHASE_PAYMENT_TYPES);
export type PurchasePaymentType = (typeof PURCHASE_PAYMENT_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  'FUEL',
  'TRANSPORT',
  'MEALS',
  'EQUIPMENT_HIRE',
  'SUBCONTRACT',
  'SMALL_TOOLS',
  'UTILITIES',
  'PERMITS_FEES',
  'REPAIRS',
  'OFFICE',
  'OTHER',
] as const;
export const ExpenseCategory = z.enum(EXPENSE_CATEGORIES);
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_PAID_BY = ['CASH', 'BANK', 'CREDIT'] as const;
export const ExpensePaidBy = z.enum(EXPENSE_PAID_BY);
export type ExpensePaidBy = (typeof EXPENSE_PAID_BY)[number];

// ── Payroll ─────────────────────────────────────────────────────────────
export const PAYROLL_STATUSES = ['DRAFT', 'FINALIZED'] as const;
export const PayrollStatus = z.enum(PAYROLL_STATUSES);
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

/** All enums by their Prisma enum name — used for the schema-sync test and i18n checks. */
export const ALL_ENUMS = {
  NotificationSeverity: NOTIFICATION_SEVERITIES,
  BackupStatus: BACKUP_STATUSES,
  BackupTrigger: BACKUP_TRIGGERS,
  BackupDestination: BACKUP_DESTINATIONS,
  AuditAction: AUDIT_ACTIONS,
  ClientType: CLIENT_TYPES,
  SupplierType: SUPPLIER_TYPES,
  ProjectType: PROJECT_TYPES,
  ProjectSource: PROJECT_SOURCES,
  ProjectStatus: PROJECT_STATUSES,
  BudgetCategory: BUDGET_CATEGORIES,
  VariationStatus: VARIATION_STATUSES,
  CertificateStatus: CERTIFICATE_STATUSES,
  PaymentMethod: PAYMENT_METHODS,
  ClientPaymentKind: CLIENT_PAYMENT_KINDS,
  BondType: BOND_TYPES,
  BondStatus: BOND_STATUSES,
  DocumentOwnerType: DOCUMENT_OWNER_TYPES,
  DocumentCategory: DOCUMENT_CATEGORIES,
  WorkerSkill: WORKER_SKILLS,
  WorkerType: WORKER_TYPES,
  AllocationStatus: ALLOCATION_STATUSES,
  AttendanceStatus: ATTENDANCE_STATUSES,
  AdvanceStatus: ADVANCE_STATUSES,
  AssetCategory: ASSET_CATEGORIES,
  AssetOwnership: ASSET_OWNERSHIPS,
  AssetStatus: ASSET_STATUSES,
  MeterType: METER_TYPES,
  MaintenanceType: MAINTENANCE_TYPES,
  MaterialCategory: MATERIAL_CATEGORIES,
  PurchasePaymentType: PURCHASE_PAYMENT_TYPES,
  ExpenseCategory: EXPENSE_CATEGORIES,
  ExpensePaidBy: EXPENSE_PAID_BY,
  PayrollStatus: PAYROLL_STATUSES,
} as const;
export type EnumName = keyof typeof ALL_ENUMS;
