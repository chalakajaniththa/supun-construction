import {
  DEADLINE_REMINDER_DAYS,
  type MeterType,
  type NotificationEntityType,
  type NotificationSeverity,
  type NotificationTitleKey,
  type NotificationType,
  type ProjectStatus,
} from '@sc/shared';
import type { DecimalInput } from '../../../common/money/money.js';
import { serviceStatus } from '../../assets/calc/service-status.js';

/**
 * Reminder rules (overview §7). Each rule turns the current state into "candidates"; the runner
 * upserts them by `dedupeKey` and resolves the open notifications that are no longer candidates.
 * Severity: expired / overdue = DANGER, ≤ 7 days = WARNING, otherwise INFO.
 */

export interface ReminderCandidate {
  type: NotificationType;
  severity: NotificationSeverity;
  titleKey: NotificationTitleKey;
  params: Record<string, string | null>;
  entityType: NotificationEntityType;
  entityId: string;
  dueDate: string | null;
  dedupeKey: string;
}

/** Whole days from `today` to `day` (negative when `day` is in the past). */
export function daysUntil(today: string, day: string): number {
  const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Which reminder step an expiry is in: 'expired', or the smallest configured "days before" that
 * still covers it (e.g. [30, 14, 7] and 10 days left → 14). null = not due for a reminder yet.
 */
export function expiryThreshold(daysLeft: number, daysBefore: readonly number[]): string | null {
  if (daysLeft < 0) return 'expired';
  const covering = daysBefore.filter((d) => daysLeft <= d);
  if (!covering.length) return null;
  return String(Math.min(...covering));
}

export function severityForDays(daysLeft: number): NotificationSeverity {
  if (daysLeft < 0) return 'DANGER';
  if (daysLeft <= 7) return 'WARNING';
  return 'INFO';
}

export interface DocumentExpiryInput {
  documentId: string;
  versionId: string;
  title: string;
  category: string;
  ownerType: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerCode: string | null;
  expiryDate: string;
}

/** The current version of a document expiring within the configured days, or already expired. */
export function documentReminders(
  docs: readonly DocumentExpiryInput[],
  today: string,
  daysBefore: readonly number[],
): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];
  for (const d of docs) {
    const left = daysUntil(today, d.expiryDate);
    const step = expiryThreshold(left, daysBefore);
    if (!step) continue;
    out.push({
      type: 'DOCUMENT_EXPIRY',
      severity: severityForDays(left),
      titleKey: left < 0 ? 'documentExpired' : 'documentExpires',
      params: {
        title: d.title,
        category: d.category,
        ownerType: d.ownerType,
        ownerId: d.ownerId,
        ownerName: d.ownerName,
        ownerCode: d.ownerCode,
      },
      entityType: 'DOCUMENT',
      entityId: d.documentId,
      dueDate: d.expiryDate,
      dedupeKey: `doc:${d.documentId}:${d.versionId}:${step}`,
    });
  }
  return out;
}

export interface BondExpiryInput {
  bondId: string;
  type: string;
  referenceNo: string;
  bank: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  expiryDate: string;
}

/** ACTIVE bonds expiring within the configured days, or already past their expiry. */
export function bondReminders(
  bonds: readonly BondExpiryInput[],
  today: string,
  daysBefore: readonly number[],
): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];
  for (const b of bonds) {
    const left = daysUntil(today, b.expiryDate);
    const step = expiryThreshold(left, daysBefore);
    if (!step) continue;
    out.push({
      type: 'BOND_EXPIRY',
      severity: severityForDays(left),
      titleKey: left < 0 ? 'bondExpired' : 'bondExpires',
      params: {
        bondType: b.type,
        referenceNo: b.referenceNo,
        bank: b.bank,
        projectId: b.projectId,
        projectCode: b.projectCode,
        projectName: b.projectName,
      },
      entityType: 'BOND',
      entityId: b.bondId,
      dueDate: b.expiryDate,
      dedupeKey: `bond:${b.bondId}:${b.expiryDate}:${step}`,
    });
  }
  return out;
}

export interface AssetServiceInput {
  assetId: string;
  code: string;
  name: string;
  meterType: MeterType;
  currentMeter: DecimalInput;
  lastServiceMeter: DecimalInput | null;
  serviceIntervalMeter: DecimalInput | null;
}

/** Service due soon (≥ 90 % of the interval used) = WARNING, overdue (≥ 100 %) = DANGER. */
export function serviceReminders(assets: readonly AssetServiceInput[]): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];
  for (const a of assets) {
    const s = serviceStatus(a);
    if (s.state !== 'DUE_SOON' && s.state !== 'OVERDUE') continue;
    const overdue = s.state === 'OVERDUE';
    out.push({
      type: 'SERVICE_DUE',
      severity: overdue ? 'DANGER' : 'WARNING',
      titleKey: overdue ? 'serviceOverdue' : 'serviceDue',
      params: {
        assetCode: a.code,
        assetName: a.name,
        meterType: a.meterType,
        dueAt: s.dueAt,
        remaining: s.remaining,
      },
      entityType: 'ASSET',
      entityId: a.assetId,
      dueDate: null,
      dedupeKey: `asset:${a.assetId}:service:${String(a.lastServiceMeter)}:${s.state}`,
    });
  }
  return out;
}

export interface ProjectDeadlineInput {
  projectId: string;
  code: string;
  name: string;
  status: ProjectStatus;
  /** revised end date, else planned end date */
  currentEndDate: string;
}

/** ONGOING projects whose current end date is within 14 days (or already passed). */
export function deadlineReminders(
  projects: readonly ProjectDeadlineInput[],
  today: string,
): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];
  for (const p of projects) {
    if (p.status !== 'ONGOING') continue;
    const left = daysUntil(today, p.currentEndDate);
    if (left > DEADLINE_REMINDER_DAYS) continue;
    const step = left < 0 ? 'passed' : left <= 7 ? '7' : String(DEADLINE_REMINDER_DAYS);
    out.push({
      type: 'PROJECT_DEADLINE',
      severity: severityForDays(left),
      titleKey: left < 0 ? 'deadlinePassed' : 'deadlineSoon',
      params: { projectCode: p.code, projectName: p.name },
      entityType: 'PROJECT',
      entityId: p.projectId,
      dueDate: p.currentEndDate,
      dedupeKey: `project:${p.projectId}:deadline:${p.currentEndDate}:${step}`,
    });
  }
  return out;
}

export interface ExistingNotification {
  id: string;
  dedupeKey: string;
  resolvedAt: Date | null;
}

export interface ReconcilePlan {
  create: ReminderCandidate[];
  /** Existing rows to refresh; `reopen` = it was resolved and the condition is back. */
  update: { id: string; candidate: ReminderCandidate; reopen: boolean }[];
  /** Open rows whose condition has cleared. */
  resolve: string[];
}

/** Upsert by dedupe key + auto-resolve whatever is no longer a candidate. */
export function reconcile(
  existing: readonly ExistingNotification[],
  candidates: readonly ReminderCandidate[],
): ReconcilePlan {
  const byKey = new Map(existing.map((e) => [e.dedupeKey, e]));
  const wanted = new Map<string, ReminderCandidate>();
  for (const c of candidates) wanted.set(c.dedupeKey, c);
  const plan: ReconcilePlan = { create: [], update: [], resolve: [] };
  for (const c of wanted.values()) {
    const e = byKey.get(c.dedupeKey);
    if (!e) plan.create.push(c);
    else plan.update.push({ id: e.id, candidate: c, reopen: e.resolvedAt !== null });
  }
  for (const e of existing) {
    if (e.resolvedAt === null && !wanted.has(e.dedupeKey)) plan.resolve.push(e.id);
  }
  return plan;
}
