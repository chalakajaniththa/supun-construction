import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type PayrollLineUpdate,
  type PayrollRunCreate,
  dayToDate,
  monthRange,
  toDay,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { type Decimal, dec, sum } from '../../common/money/money.js';
import { fieldError } from '../../common/projects/require-project.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  type CalcAdvance,
  allocateAdvanceDeduction,
  calculatePayrollLine,
  employedInMonth,
} from './calc/payroll.calculator.js';

type Db = PrismaClient | Prisma.TransactionClient;

const lineInclude = {
  worker: {
    select: { id: true, code: true, fullName: true, nameSinhala: true, skill: true, epfNo: true },
  },
} as const satisfies Prisma.PayrollLineInclude;

const MONEY_FIELDS = [
  'basicPay',
  'otPay',
  'grossPay',
  'epfEmployee',
  'epfEmployer',
  'etfEmployer',
  'advanceDeduction',
  'otherDeductions',
  'netPay',
] as const;

/** Column totals of a run + employer cost (gross + EPF 12% + ETF 3%). */
export function payrollTotals(lines: readonly Record<(typeof MONEY_FIELDS)[number], unknown>[]) {
  const out = Object.fromEntries(
    MONEY_FIELDS.map((f) => [f, sum(lines.map((l) => l[f] as Decimal))]),
  ) as Record<(typeof MONEY_FIELDS)[number], Decimal>;
  return {
    workers: lines.length,
    ...out,
    employerCost: out.grossPay.plus(out.epfEmployer).plus(out.etfEmployer),
  };
}

const monthKey = (year: number, month: number) => year * 12 + month;

/** Open advances (given on or before `to`) with what is still owed, per worker. */
async function openAdvances(db: Db, workerIds: string[], to: string) {
  const rows = await db.advance.findMany({
    where: { workerId: { in: workerIds }, status: 'OPEN', date: { lte: dayToDate(to) } },
    include: { recoveries: { select: { amount: true } } },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  const byWorker = new Map<string, CalcAdvance[]>();
  for (const a of rows) {
    const balance = dec(a.amount).minus(sum(a.recoveries.map((r) => r.amount)));
    if (balance.lte(0)) continue;
    const list = byWorker.get(a.workerId) ?? [];
    list.push({
      id: a.id,
      date: toDay(a.date),
      balance,
      recoveryPerMonth: a.recoveryPerMonth ? a.recoveryPerMonth.toString() : null,
    });
    byWorker.set(a.workerId, list);
  }
  return byWorker;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Fingerprint of everything a month's payroll is calculated from: the month's attendance, the
   * pay rates and the open advances of the workers involved. A draft whose fingerprint changed is
   * "stale" and must be generated again before it can be finalized.
   */
  async sourceHash(db: Db, year: number, month: number): Promise<string> {
    const { from, to } = monthRange(`${year}-${String(month).padStart(2, '0')}`);
    const attendance = await db.attendance.findMany({
      where: { date: { gte: dayToDate(from), lte: dayToDate(to) } },
      select: {
        id: true,
        workerId: true,
        date: true,
        status: true,
        otHours: true,
        projectId: true,
      },
      orderBy: { id: 'asc' },
    });
    const rates = await db.workerRate.findMany({
      select: {
        id: true,
        workerId: true,
        effectiveFrom: true,
        dailyRate: true,
        monthlySalary: true,
        otHourlyRate: true,
      },
      orderBy: { id: 'asc' },
    });
    const advances = await db.advance.findMany({
      where: { status: 'OPEN', date: { lte: dayToDate(to) } },
      select: { id: true, amount: true, recoveryPerMonth: true, date: true },
      orderBy: { id: 'asc' },
    });
    const text = JSON.stringify([attendance, rates, advances], (_k, v: unknown) =>
      v !== null && typeof v === 'object' && 'toFixed' in (v as object) ? String(v) : v,
    );
    return createHash('sha256').update(text).digest('hex');
  }

  async list(q: { year?: number; month?: number }) {
    const runs = await this.prisma.payrollRun.findMany({
      where: { ...(q.year ? { year: q.year } : {}), ...(q.month ? { month: q.month } : {}) },
      include: { lines: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return runs.map(({ lines, ...r }) => ({ ...r, totals: payrollTotals(lines) }));
  }

  private async latestFinalized(db: Db) {
    return db.payrollRun.findFirst({
      where: { status: 'FINALIZED' },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { id: true },
    });
  }

  async get(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: { lines: { include: lineInclude } },
    });
    if (!run) throw AppException.notFound('Payroll run not found.');
    const lines = [...run.lines].sort((a, b) => a.worker.code.localeCompare(b.worker.code));
    const { to } = monthRange(`${run.year}-${String(run.month).padStart(2, '0')}`);
    const advances = await openAdvances(
      this.prisma,
      lines.map((l) => l.workerId),
      to,
    );
    const stale =
      run.status === 'DRAFT' &&
      run.sourceHash !== (await this.sourceHash(this.prisma, run.year, run.month));
    const latest = await this.latestFinalized(this.prisma);
    return {
      ...run,
      lines: lines.map((l) => ({
        ...l,
        advanceBalance: sum((advances.get(l.workerId) ?? []).map((a) => a.balance)),
      })),
      totals: payrollTotals(lines),
      stale,
      canReopen: run.status === 'FINALIZED' && latest?.id === run.id,
    };
  }

  /**
   * Creates the month's DRAFT, or regenerates it (all lines are recalculated; manually entered
   * "other deductions" are kept). A finalized month cannot be regenerated.
   */
  async generate({ year, month }: PayrollRunCreate) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: { year_month: { year, month } },
      include: { lines: true },
    });
    if (existing?.status === 'FINALIZED') {
      throw AppException.conflict('PAYROLL_NOT_DRAFT', 'This month is already finalized.');
    }
    const settings = await this.settings.get('payroll');
    const { from, to } = monthRange(`${year}-${String(month).padStart(2, '0')}`);

    const attendance = await this.prisma.attendance.findMany({
      where: { date: { gte: dayToDate(from), lte: dayToDate(to) } },
      select: { workerId: true, date: true, status: true, otHours: true, projectId: true },
    });
    const withAttendance = new Set(attendance.map((a) => a.workerId));
    const workers = await this.prisma.worker.findMany({
      where: {
        OR: [
          { id: { in: [...withAttendance] } },
          { type: 'PERMANENT', deletedAt: null, active: true },
        ],
      },
      include: { rates: true },
      orderBy: { code: 'asc' },
    });
    const candidates = workers.filter(
      (w) =>
        withAttendance.has(w.id) ||
        employedInMonth(
          { joinedDate: toDay(w.joinedDate), leftDate: toDay(w.leftDate) || null },
          year,
          month,
        ),
    );
    const advances = await openAdvances(
      this.prisma,
      candidates.map((w) => w.id),
      to,
    );
    const kept = new Map(
      (existing?.lines ?? []).map((l) => [
        l.workerId,
        { otherDeductions: l.otherDeductions, note: l.otherDeductionsNote },
      ]),
    );
    const byWorker = new Map<string, typeof attendance>();
    for (const a of attendance) {
      const list = byWorker.get(a.workerId) ?? [];
      list.push(a);
      byWorker.set(a.workerId, list);
    }

    const lines: Prisma.PayrollLineCreateManyInput[] = [];
    for (const w of candidates) {
      const own = byWorker.get(w.id) ?? [];
      const keep = kept.get(w.id);
      const r = calculatePayrollLine({
        worker: {
          type: w.type,
          joinedDate: toDay(w.joinedDate),
          leftDate: toDay(w.leftDate) || null,
        },
        year,
        month,
        attendance: own.map((a) => ({
          date: toDay(a.date),
          status: a.status,
          otHours: a.otHours.toString(),
          projectId: a.projectId,
        })),
        rates: w.rates.map((rt) => ({
          effectiveFrom: toDay(rt.effectiveFrom),
          dailyRate: rt.dailyRate?.toString() ?? null,
          monthlySalary: rt.monthlySalary?.toString() ?? null,
          otHourlyRate: rt.otHourlyRate?.toString() ?? null,
        })),
        settings,
        advances: advances.get(w.id) ?? [],
        otherDeductions: keep?.otherDeductions.toString(),
      });
      // A daily-paid worker with nothing to pay this month gets no line.
      if (w.type === 'DAILY' && r.grossPay.isZero()) continue;
      lines.push({
        payrollRunId: '',
        workerId: w.id,
        workerType: w.type,
        daysWorked: r.daysWorked.toString(),
        halfDays: r.halfDays,
        otHours: r.otHours.toString(),
        basicPay: r.basicPay.toFixed(2),
        otPay: r.otPay.toFixed(2),
        grossPay: r.grossPay.toFixed(2),
        epfEmployee: r.epfEmployee.toFixed(2),
        epfEmployer: r.epfEmployer.toFixed(2),
        etfEmployer: r.etfEmployer.toFixed(2),
        advanceDeduction: r.advanceDeduction.toFixed(2),
        otherDeductions: r.otherDeductions.toFixed(2),
        otherDeductionsNote: keep?.note ?? null,
        netPay: r.netPay.toFixed(2),
        breakdown: r.breakdown.map((b) => ({
          projectId: b.projectId,
          days: b.days.toString(),
          otHours: b.otHours.toString(),
          cost: b.cost.toFixed(2),
        })),
      });
    }

    const hash = await this.sourceHash(this.prisma, year, month);
    const runId = await this.prisma.$transaction(
      async (tx) => {
        const run = existing
          ? await tx.payrollRun.update({
              where: { id: existing.id },
              data: { generatedAt: new Date(), sourceHash: hash },
            })
          : await tx.payrollRun.create({
              data: { year, month, status: 'DRAFT', generatedAt: new Date(), sourceHash: hash },
            });
        await tx.payrollLine.deleteMany({ where: { payrollRunId: run.id } });
        if (lines.length) {
          await tx.payrollLine.createMany({
            data: lines.map((l) => ({ ...l, payrollRunId: run.id })),
          });
        }
        return run.id;
      },
      { timeout: 30_000 },
    );
    return this.get(runId);
  }

  private async draftRun(db: Db, id: string) {
    const run = await db.payrollRun.findUnique({ where: { id } });
    if (!run) throw AppException.notFound('Payroll run not found.');
    if (run.status !== 'DRAFT') {
      throw AppException.conflict('PAYROLL_NOT_DRAFT', 'This month is already finalized.');
    }
    return run;
  }

  /** Edits a draft line's deductions and recomputes its net pay. */
  async updateLine(runId: string, lineId: string, data: PayrollLineUpdate) {
    const run = await this.draftRun(this.prisma, runId);
    const line = await this.prisma.payrollLine.findFirst({
      where: { id: lineId, payrollRunId: runId },
    });
    if (!line) throw AppException.notFound('Payroll line not found.');
    const { to } = monthRange(`${run.year}-${String(run.month).padStart(2, '0')}`);
    const balance = sum(
      ((await openAdvances(this.prisma, [line.workerId], to)).get(line.workerId) ?? []).map(
        (a) => a.balance,
      ),
    );
    const advance = dec(data.advanceDeduction ?? line.advanceDeduction);
    const other = dec(data.otherDeductions ?? line.otherDeductions);
    if (advance.gt(balance)) throw fieldError('advanceDeduction', 'DEDUCTION_MORE_THAN_BALANCE');
    const net = dec(line.grossPay).minus(dec(line.epfEmployee)).minus(advance).minus(other);
    if (net.lt(0)) {
      throw fieldError(
        data.otherDeductions !== undefined && data.advanceDeduction === undefined
          ? 'otherDeductions'
          : 'advanceDeduction',
        'NET_BELOW_ZERO',
      );
    }
    await this.prisma.payrollLine.update({
      where: { id: lineId },
      data: {
        advanceDeduction: advance.toFixed(2),
        otherDeductions: other.toFixed(2),
        ...(data.otherDeductionsNote !== undefined
          ? { otherDeductionsNote: data.otherDeductionsNote }
          : {}),
        netPay: net.toFixed(2),
      },
    });
    const updated = await this.prisma.payrollLine.findUniqueOrThrow({
      where: { id: lineId },
      include: lineInclude,
    });
    return { ...updated, advanceBalance: balance };
  }

  /**
   * Locks the month: attendance gets payrollRunId (Daily Entry then answers PAYROLL_LOCKED),
   * advance recoveries are written (instalments first, oldest advance first) and fully recovered
   * advances are closed.
   */
  async finalize(id: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const run = await this.draftRun(tx, id);
        if (run.sourceHash !== (await this.sourceHash(tx, run.year, run.month))) {
          throw AppException.conflict(
            'PAYROLL_STALE',
            'Attendance, pay rates or advances changed after this draft was made. Generate it again first.',
          );
        }
        const { from, to } = monthRange(`${run.year}-${String(run.month).padStart(2, '0')}`);
        await tx.attendance.updateMany({
          where: { date: { gte: dayToDate(from), lte: dayToDate(to) } },
          data: { payrollRunId: run.id },
        });
        const lines = await tx.payrollLine.findMany({
          where: { payrollRunId: run.id, advanceDeduction: { gt: 0 } },
        });
        const advances = await openAdvances(
          tx,
          lines.map((l) => l.workerId),
          to,
        );
        for (const line of lines) {
          const own = advances.get(line.workerId) ?? [];
          for (const alloc of allocateAdvanceDeduction(own, line.advanceDeduction.toString())) {
            await tx.advanceRecovery.create({
              data: {
                advanceId: alloc.advanceId,
                payrollLineId: line.id,
                amount: alloc.amount.toFixed(2),
              },
            });
            const adv = own.find((a) => a.id === alloc.advanceId)!;
            if (dec(adv.balance).minus(alloc.amount).lte(0)) {
              await tx.advance.update({
                where: { id: alloc.advanceId },
                data: { status: 'RECOVERED' },
              });
            }
          }
        }
        await tx.payrollRun.update({
          where: { id: run.id },
          data: { status: 'FINALIZED', finalizedAt: new Date() },
        });
      },
      { timeout: 30_000 },
    );
    return this.get(id);
  }

  /** Back to DRAFT (only the latest finalized month): recoveries are reversed, attendance unlocked. */
  async reopen(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id } });
      if (!run) throw AppException.notFound('Payroll run not found.');
      if (run.status !== 'FINALIZED') {
        throw new AppException(
          HttpStatus.CONFLICT,
          'PAYROLL_NOT_DRAFT',
          'This month is not finalized.',
        );
      }
      const later = await tx.payrollRun.findFirst({
        where: {
          status: 'FINALIZED',
          OR: [{ year: { gt: run.year } }, { year: run.year, month: { gt: run.month } }],
        },
        select: { id: true },
      });
      if (later) {
        throw AppException.conflict(
          'PAYROLL_REOPEN_NOT_LATEST',
          'Only the latest finalized month can be reopened.',
        );
      }
      const recoveries = await tx.advanceRecovery.findMany({
        where: { payrollLine: { payrollRunId: run.id } },
        select: { id: true, advanceId: true },
      });
      await tx.advanceRecovery.deleteMany({ where: { id: { in: recoveries.map((r) => r.id) } } });
      await tx.advance.updateMany({
        where: { id: { in: [...new Set(recoveries.map((r) => r.advanceId))] } },
        data: { status: 'OPEN' },
      });
      await tx.attendance.updateMany({
        where: { payrollRunId: run.id },
        data: { payrollRunId: null },
      });
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: 'DRAFT',
          finalizedAt: null,
          sourceHash: await this.sourceHash(tx, run.year, run.month),
        },
      });
    });
    return this.get(id);
  }

  /** Every payroll line of a worker, newest month first. */
  async payslips(workerId: string) {
    const w = await this.prisma.worker.findFirst({
      where: { id: workerId, deletedAt: null },
      select: { id: true },
    });
    if (!w) throw AppException.notFound('Worker not found.');
    const lines = await this.prisma.payrollLine.findMany({
      where: { workerId },
      include: { payrollRun: { select: { id: true, year: true, month: true, status: true } } },
    });
    return lines
      .map(({ payrollRun, ...l }) => ({ ...l, run: payrollRun }))
      .sort((a, b) => monthKey(b.run.year, b.run.month) - monthKey(a.run.year, a.run.month));
  }

  /** For costing: finalized payroll shares of a project, per worker and month. */
  async finalizedShares(projectId: string, from?: string, to?: string) {
    const fromKey = from ? monthKey(Number(from.slice(0, 4)), Number(from.slice(5, 7))) : 0;
    const toKey = to ? monthKey(Number(to.slice(0, 4)), Number(to.slice(5, 7))) : Infinity;
    const lines = await this.prisma.payrollLine.findMany({
      where: { payrollRun: { status: 'FINALIZED' } },
      select: {
        workerId: true,
        breakdown: true,
        payrollRun: { select: { year: true, month: true } },
      },
    });
    const out = new Map<string, { month: string; days: string; cost: string }[]>();
    for (const l of lines) {
      const key = monthKey(l.payrollRun.year, l.payrollRun.month);
      if (key < fromKey || key > toKey) continue;
      const entries = (l.breakdown ?? []) as {
        projectId: string | null;
        days: string;
        cost: string;
      }[];
      const share = entries.find((e) => e.projectId === projectId);
      if (!share) continue;
      const list = out.get(l.workerId) ?? [];
      list.push({
        month: `${l.payrollRun.year}-${String(l.payrollRun.month).padStart(2, '0')}`,
        days: share.days,
        cost: share.cost,
      });
      out.set(l.workerId, list);
    }
    return out;
  }
}
