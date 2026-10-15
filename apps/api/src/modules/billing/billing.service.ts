import { Injectable } from '@nestjs/common';
import {
  CERTIFICATE_TRANSITIONS,
  type CertificateCreate,
  type CertificateStatusUpdate,
  type CertificateUpdate,
  type ClientPaymentCreate,
  dayToDate,
  toDay,
} from '@sc/shared';
import { addDays, todayInColombo } from '../../common/dates/dates.js';
import { AppException } from '../../common/errors/app-exception.js';
import { dec, sum } from '../../common/money/money.js';
import { fieldError, requireProject } from '../../common/projects/require-project.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type {
  PaymentCertificate,
  Prisma,
  PrismaClient,
  Project,
} from '../../generated/prisma/client.js';
import { BoqService } from '../boq/boq.service.js';
import { calculateProgress } from '../boq/calc/progress.js';
import { type IpcResult, calculateIpc, financeSummary } from './calc/ipc.calculator.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** IPC-<project code>-01 */
export const certificateCode = (projectCode: string, n: number) =>
  `IPC-${projectCode}-${String(n).padStart(2, '0')}`;

const notDraft = () =>
  AppException.conflict('CERTIFICATE_NOT_DRAFT', 'Only a draft bill can be changed.');

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boq: BoqService,
  ) {}

  /** contract value + Σ approved variations */
  private async approvedVariations(db: Db, projectId: string) {
    const rows = await db.variation.findMany({
      where: { projectId, status: 'APPROVED' },
      select: { amountChange: true },
    });
    return sum(rows.map((r) => r.amountChange));
  }

  /**
   * The IPC calculation for a bill numbered `number` up to `periodTo`, against the earlier bills.
   * Retention cap = effective contract value (incl. approved variations) × retentionCapPct.
   */
  private async calculate(
    db: Db,
    project: Project,
    number: number,
    periodTo: string,
    opts: { cumulativeOverride?: string | null; otherDeductions?: string | null },
  ): Promise<IpcResult> {
    const earlier = await db.paymentCertificate.findMany({
      where: { projectId: project.id, number: { lt: number } },
      select: { grossThisBill: true, retentionDeducted: true, advanceRecovered: true },
    });
    const items = (await this.boq.boqForCalc(db, project.id)) ?? [];
    const measured = calculateProgress(items, periodTo).totalDone;
    return calculateIpc({
      measuredWorkDone: measured,
      cumulativeOverride: opts.cumulativeOverride,
      previousCertified: sum(earlier.map((c) => c.grossThisBill)),
      retentionSoFar: sum(earlier.map((c) => c.retentionDeducted)),
      advanceRecoveredSoFar: sum(earlier.map((c) => c.advanceRecovered)),
      contractValue: dec(project.contractValue).plus(await this.approvedVariations(db, project.id)),
      retentionPct: project.retentionPct.toString(),
      retentionCapPct: project.retentionCapPct.toString(),
      advanceAmount: project.advanceAmount.toString(),
      advanceRecoveryPct: project.advanceRecoveryPct.toString(),
      otherDeductions: opts.otherDeductions,
    });
  }

  private async withCalculation(
    db: Db,
    project: Project,
    c: PaymentCertificate & { payments: { amount: unknown; kind: string }[] },
  ) {
    const calc = await this.calculate(db, project, c.number, toDay(c.periodTo), {
      cumulativeOverride: c.cumulativeWorkDone.toString(),
      otherDeductions: c.otherDeductions.toString(),
    });
    const { payments, ...rest } = c;
    return {
      ...rest,
      code: certificateCode(project.code, c.number),
      paid: sum(payments.filter((p) => p.kind === 'IPC_PAYMENT').map((p) => p.amount as string)),
      // stored values are authoritative; the calculation shows the steps behind them
      calculation: {
        ...calc,
        retentionDeducted: c.retentionDeducted,
        advanceRecovered: c.advanceRecovered,
        netPayable: c.netPayable,
      },
    };
  }

  async list(projectId: string) {
    const project = await requireProject(this.prisma, projectId);
    const rows = await this.prisma.paymentCertificate.findMany({
      where: { projectId },
      include: { payments: { select: { amount: true, kind: true } } },
      orderBy: { number: 'asc' },
    });
    const out = [];
    for (const c of rows) out.push(await this.withCalculation(this.prisma, project, c));
    return out;
  }

  private async lastCertificate(db: Db, projectId: string) {
    return db.paymentCertificate.findFirst({ where: { projectId }, orderBy: { number: 'desc' } });
  }

  /** The "New bill" wizard: what a new bill would be, without saving it. */
  async preview(projectId: string, data: CertificateCreate) {
    const project = await requireProject(this.prisma, projectId);
    const last = await this.lastCertificate(this.prisma, projectId);
    const number = (last?.number ?? 0) + 1;
    const calc = await this.calculate(this.prisma, project, number, data.periodTo, {
      cumulativeOverride: data.cumulativeWorkDone,
      otherDeductions: data.otherDeductions,
    });
    return {
      number,
      code: certificateCode(project.code, number),
      periodFrom: data.periodFrom ?? this.defaultPeriodFrom(project, last),
      periodTo: data.periodTo,
      calculation: calc,
    };
  }

  private defaultPeriodFrom(project: Project, last: PaymentCertificate | null) {
    return last ? addDays(toDay(last.periodTo), 1) : toDay(project.startDate);
  }

  /** A new DRAFT bill computed from the progress up to periodTo (one draft at a time). */
  async create(projectId: string, data: CertificateCreate) {
    const project = await requireProject(this.prisma, projectId);
    const id = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.paymentCertificate.findFirst({
        where: { projectId, status: 'DRAFT' },
        select: { id: true },
      });
      if (draft) {
        throw AppException.conflict(
          'DRAFT_BILL_EXISTS',
          'Finish (submit or delete) the draft bill before making a new one.',
        );
      }
      const last = await this.lastCertificate(tx, projectId);
      if (last && data.periodTo <= toDay(last.periodTo)) {
        throw fieldError('periodTo', 'BEFORE_PREVIOUS_BILL');
      }
      const number = (last?.number ?? 0) + 1;
      const calc = await this.calculate(tx, project, number, data.periodTo, {
        cumulativeOverride: data.cumulativeWorkDone,
        otherDeductions: data.otherDeductions,
      });
      const row = await tx.paymentCertificate.create({
        data: {
          projectId,
          number,
          periodFrom: dayToDate(data.periodFrom ?? this.defaultPeriodFrom(project, last)),
          periodTo: dayToDate(data.periodTo),
          ...this.amounts(calc),
          otherDeductionsNote: data.otherDeductionsNote ?? null,
          notes: data.notes ?? null,
          status: 'DRAFT',
        },
      });
      return row.id;
    });
    return this.get(projectId, id);
  }

  private amounts(calc: IpcResult) {
    return {
      cumulativeWorkDone: calc.cumulativeWorkDone.toFixed(2),
      previousCertified: calc.previousCertified.toFixed(2),
      grossThisBill: calc.grossThisBill.toFixed(2),
      retentionDeducted: calc.retentionDeducted.toFixed(2),
      advanceRecovered: calc.advanceRecovered.toFixed(2),
      otherDeductions: calc.otherDeductions.toFixed(2),
      netPayable: calc.netPayable.toFixed(2),
    };
  }

  private async certificate(db: Db, projectId: string, certId: string) {
    const c = await db.paymentCertificate.findFirst({
      where: { id: certId, projectId },
      include: { payments: { select: { amount: true, kind: true } } },
    });
    if (!c) throw AppException.notFound('Bill not found.');
    return c;
  }

  async get(projectId: string, certId: string) {
    const project = await requireProject(this.prisma, projectId);
    const c = await this.certificate(this.prisma, projectId, certId);
    return this.withCalculation(this.prisma, project, c);
  }

  /**
   * Edits a DRAFT and recomputes it. `cumulativeWorkDone`: a value overrides, '' / null goes back
   * to the measured value, left out keeps the current value.
   */
  async update(projectId: string, certId: string, data: CertificateUpdate) {
    const project = await requireProject(this.prisma, projectId);
    await this.prisma.$transaction(async (tx) => {
      const c = await this.certificate(tx, projectId, certId);
      if (c.status !== 'DRAFT') throw notDraft();
      const periodTo = data.periodTo ?? toDay(c.periodTo);
      const periodFrom = data.periodFrom ?? toDay(c.periodFrom);
      if (periodTo < periodFrom) throw fieldError('periodTo', 'END_BEFORE_START');
      const prev = await tx.paymentCertificate.findFirst({
        where: { projectId, number: c.number - 1 },
      });
      if (prev && periodTo <= toDay(prev.periodTo))
        throw fieldError('periodTo', 'BEFORE_PREVIOUS_BILL');
      const calc = await this.calculate(tx, project, c.number, periodTo, {
        cumulativeOverride:
          data.cumulativeWorkDone === undefined
            ? c.cumulativeWorkDone.toString()
            : data.cumulativeWorkDone,
        otherDeductions:
          data.otherDeductions === undefined ? c.otherDeductions.toString() : data.otherDeductions,
      });
      await tx.paymentCertificate.update({
        where: { id: certId },
        data: {
          periodFrom: dayToDate(periodFrom),
          periodTo: dayToDate(periodTo),
          ...this.amounts(calc),
          ...(data.otherDeductionsNote !== undefined
            ? { otherDeductionsNote: data.otherDeductionsNote }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });
    });
    return this.get(projectId, certId);
  }

  /** Only the latest bill, while it is a draft. */
  async remove(projectId: string, certId: string) {
    await requireProject(this.prisma, projectId);
    const c = await this.certificate(this.prisma, projectId, certId);
    if (c.status !== 'DRAFT') throw notDraft();
    await this.prisma.paymentCertificate.delete({ where: { id: certId } });
    return { id: certId };
  }

  /** DRAFT → SUBMITTED → CERTIFIED → PAID (PAID needs IPC payments ≥ net); SUBMITTED → DRAFT. */
  async setStatus(projectId: string, certId: string, data: CertificateStatusUpdate) {
    await requireProject(this.prisma, projectId);
    const c = await this.certificate(this.prisma, projectId, certId);
    const invalid = () =>
      AppException.conflict(
        'CERTIFICATE_STATUS_INVALID',
        'This bill cannot be moved to that status.',
        {
          from: c.status,
          to: data.status,
        },
      );
    if (!CERTIFICATE_TRANSITIONS[c.status].includes(data.status)) throw invalid();
    const day = data.date ?? todayInColombo();
    const paid = sum(c.payments.filter((p) => p.kind === 'IPC_PAYMENT').map((p) => p.amount));
    const patch: Prisma.PaymentCertificateUpdateInput = { status: data.status };
    if (data.status === 'SUBMITTED') patch.submittedDate = dayToDate(day);
    if (data.status === 'CERTIFIED') patch.certifiedDate = dayToDate(day);
    if (data.status === 'PAID' && paid.lt(dec(c.netPayable))) {
      throw AppException.conflict(
        'CERTIFICATE_NOT_PAID_IN_FULL',
        'The payments recorded for this bill are less than its net amount.',
        { paid: paid.toFixed(2), net: c.netPayable.toFixed(2) },
      );
    }
    if (data.status === 'DRAFT') {
      const later = await this.prisma.paymentCertificate.count({
        where: { projectId, number: { gt: c.number } },
      });
      if (later) throw invalid();
      if (c.payments.length) {
        throw AppException.conflict(
          'CERTIFICATE_HAS_PAYMENTS',
          'Payments are recorded for this bill.',
        );
      }
      patch.submittedDate = null;
    }
    await this.prisma.paymentCertificate.update({ where: { id: certId }, data: patch });
    return this.get(projectId, certId);
  }

  // ── Client payments ───────────────────────────────────────────────────
  async payments(projectId: string) {
    await requireProject(this.prisma, projectId);
    return this.prisma.clientPayment.findMany({
      where: { projectId },
      include: { certificate: { select: { id: true, number: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addPayment(projectId: string, data: ClientPaymentCreate) {
    await requireProject(this.prisma, projectId);
    if (data.certificateId) {
      const c = await this.prisma.paymentCertificate.findFirst({
        where: { id: data.certificateId, projectId },
        select: { status: true },
      });
      if (!c) throw fieldError('certificateId', 'NOT_FOUND');
      if (c.status === 'DRAFT') throw fieldError('certificateId', 'BILL_NOT_SUBMITTED');
    }
    return this.prisma.clientPayment.create({
      data: {
        projectId,
        certificateId: data.certificateId ?? null,
        date: dayToDate(data.date),
        amount: data.amount,
        method: data.method,
        kind: data.kind,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
      },
      include: { certificate: { select: { id: true, number: true } } },
    });
  }

  /** Removing a payment of a PAID bill that leaves it short moves the bill back to CERTIFIED. */
  async removePayment(projectId: string, paymentId: string) {
    await requireProject(this.prisma, projectId);
    const p = await this.prisma.clientPayment.findFirst({ where: { id: paymentId, projectId } });
    if (!p) throw AppException.notFound('Payment not found.');
    await this.prisma.$transaction(async (tx) => {
      await tx.clientPayment.delete({ where: { id: paymentId } });
      if (p.certificateId) {
        const c = await this.certificate(tx, projectId, p.certificateId);
        const paid = sum(c.payments.filter((x) => x.kind === 'IPC_PAYMENT').map((x) => x.amount));
        if (c.status === 'PAID' && paid.lt(dec(c.netPayable))) {
          await tx.paymentCertificate.update({
            where: { id: c.id },
            data: { status: 'CERTIFIED' },
          });
        }
      }
    });
    return { id: paymentId };
  }

  async summary(projectId: string) {
    const project = await requireProject(this.prisma, projectId);
    return this.summaryOf(this.prisma, project);
  }

  async summaryOf(db: Db, project: Project) {
    const [certificates, payments, approvedVariations] = await Promise.all([
      db.paymentCertificate.findMany({ where: { projectId: project.id } }),
      db.clientPayment.findMany({ where: { projectId: project.id } }),
      this.approvedVariations(db, project.id),
    ]);
    return financeSummary({
      contractValue: project.contractValue.toString(),
      approvedVariations,
      advanceAmount: project.advanceAmount.toString(),
      certificates: certificates.map((c) => ({
        status: c.status,
        grossThisBill: c.grossThisBill.toString(),
        netPayable: c.netPayable.toString(),
        retentionDeducted: c.retentionDeducted.toString(),
        advanceRecovered: c.advanceRecovered.toString(),
      })),
      payments: payments.map((p) => ({ kind: p.kind, amount: p.amount.toString() })),
    });
  }
}
