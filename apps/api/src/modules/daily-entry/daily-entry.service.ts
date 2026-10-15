import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AttendanceQuery,
  type CopyFromDto,
  type DailyEntryQuery,
  type DailyEntrySave,
  colomboDayRange,
  colomboTime,
  dayToDate,
  shiftDay,
  toDay,
  usageFromMeters,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { dec, maxDecimal } from '../../common/money/money.js';
import { assertNotLocked, lockedMonths } from '../../common/payroll/payroll-lock.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { assertExpenseLinks, expenseInclude } from '../expenses/expenses.service.js';

const projectSelect = { id: true, code: true, name: true } as const;
const workerSelect = {
  id: true,
  code: true,
  fullName: true,
  nameSinhala: true,
  skill: true,
  type: true,
} as const;

/** How far back "Copy from yesterday" looks for the last day with attendance. */
const COPY_LOOKBACK_DAYS = 31;

const times = (a: { startAt: Date; endAt: Date }) =>
  `${colomboTime(a.startAt)}–${colomboTime(a.endAt)}`;

function invalid(path: string, message = 'NOT_FOUND'): AppException {
  return AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
    { path, message, code: 'custom' },
  ]);
}

@Injectable()
export class DailyEntryService {
  constructor(private readonly prisma: PrismaService) {}

  private async project(id: string) {
    const p = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: projectSelect,
    });
    if (!p) throw AppException.notFound('Project not found.');
    return p;
  }

  /** Everything recorded or planned for one project on one day. */
  async get(q: DailyEntryQuery) {
    const project = await this.project(q.projectId);
    const date = dayToDate(q.date);
    const range = colomboDayRange(q.date);
    const planned = {
      status: 'PLANNED' as const,
      startAt: { lt: range.end },
      endAt: { gt: range.start },
    };

    const [workerAllocs, attendance, assetAllocs, usageLogs, expenses, locked] = await Promise.all([
      this.prisma.workerAllocation.findMany({
        where: { ...planned, projectId: project.id, worker: { deletedAt: null } },
        include: { worker: { select: workerSelect } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.attendance.findMany({
        where: { date, projectId: project.id },
        include: { worker: { select: workerSelect } },
      }),
      this.prisma.assetAllocation.findMany({
        where: { ...planned, projectId: project.id, asset: { deletedAt: null } },
        include: { asset: true, operator: { select: { fullName: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.assetUsageLog.findMany({
        where: { date, projectId: project.id },
        include: { asset: true, operator: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.expense.findMany({
        where: { date, projectId: project.id },
        include: expenseInclude,
        orderBy: { createdAt: 'asc' },
      }),
      lockedMonths(this.prisma, [q.date]),
    ]);

    // Workers: planned here + already marked here.
    type W = (typeof attendance)[number]['worker'];
    const workers = new Map<string, { worker: W; plannedTimes: string[] }>();
    for (const a of workerAllocs) {
      const entry = workers.get(a.workerId) ?? { worker: a.worker, plannedTimes: [] };
      entry.plannedTimes.push(times(a));
      workers.set(a.workerId, entry);
    }
    for (const a of attendance) {
      if (!workers.has(a.workerId)) workers.set(a.workerId, { worker: a.worker, plannedTimes: [] });
    }
    const byWorker = new Map(attendance.map((a) => [a.workerId, a]));
    // Planned workers whose attendance is already recorded at another project today.
    const elsewhere = await this.prisma.attendance.findMany({
      where: {
        date,
        workerId: { in: [...workers.keys()] },
        projectId: { not: project.id },
      },
      include: { project: { select: projectSelect } },
    });
    const otherProject = new Map(
      elsewhere.filter((e) => e.project).map((e) => [e.workerId, e.project!]),
    );

    const workerRows = [...workers.values()]
      .map(({ worker, plannedTimes }) => {
        const a = byWorker.get(worker.id);
        return {
          workerId: worker.id,
          code: worker.code,
          fullName: worker.fullName,
          nameSinhala: worker.nameSinhala,
          skill: worker.skill,
          type: worker.type,
          allocated: plannedTimes.length > 0,
          plannedTimes,
          attendance: a ? { id: a.id, status: a.status, otHours: a.otHours, notes: a.notes } : null,
          otherProject: otherProject.get(worker.id) ?? null,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    // Machines: one row per usage log, plus planned machines without a log yet.
    const plannedAssets = new Map<
      string,
      {
        asset: (typeof assetAllocs)[number]['asset'];
        times: string[];
        operatorWorkerId: string | null;
        operatorName: string | null;
      }
    >();
    for (const a of assetAllocs) {
      const entry = plannedAssets.get(a.assetId) ?? {
        asset: a.asset,
        times: [],
        operatorWorkerId: a.operatorWorkerId,
        operatorName: a.operator?.fullName ?? null,
      };
      entry.times.push(times(a));
      plannedAssets.set(a.assetId, entry);
    }
    type Num = (typeof usageLogs)[number]['startMeter'];
    interface UsageRow {
      id: string | null;
      assetId: string;
      code: string;
      name: string;
      category: (typeof usageLogs)[number]['asset']['category'];
      meterType: (typeof usageLogs)[number]['asset']['meterType'];
      currentMeter: NonNullable<Num>;
      allocated: boolean;
      plannedTimes: string[];
      startMeter: Num;
      endMeter: Num;
      hoursUsed: Num;
      fuelLitres: Num;
      fuelCost: Num;
      operatorWorkerId: string | null;
      operatorName: string | null;
      notes: string | null;
    }
    const usageRows: UsageRow[] = usageLogs.map((u) => ({
      id: u.id,
      assetId: u.assetId,
      code: u.asset.code,
      name: u.asset.name,
      category: u.asset.category,
      meterType: u.asset.meterType,
      currentMeter: u.asset.currentMeter,
      allocated: plannedAssets.has(u.assetId),
      plannedTimes: plannedAssets.get(u.assetId)?.times ?? [],
      startMeter: u.startMeter,
      endMeter: u.endMeter,
      hoursUsed: u.hoursUsed,
      fuelLitres: u.fuelLitres,
      fuelCost: u.fuelCost,
      operatorWorkerId: u.operatorWorkerId,
      operatorName: u.operator?.fullName ?? null,
      notes: u.notes,
    }));
    const logged = new Set(usageLogs.map((u) => u.assetId));
    for (const [assetId, p] of plannedAssets) {
      if (logged.has(assetId)) continue;
      usageRows.push({
        id: null,
        assetId,
        code: p.asset.code,
        name: p.asset.name,
        category: p.asset.category,
        meterType: p.asset.meterType,
        currentMeter: p.asset.currentMeter,
        allocated: true,
        plannedTimes: p.times,
        startMeter: null,
        endMeter: null,
        hoursUsed: null,
        fuelLitres: null,
        fuelCost: null,
        operatorWorkerId: p.operatorWorkerId,
        operatorName: p.operatorName,
        notes: null,
      });
    }
    usageRows.sort((a, b) => a.code.localeCompare(b.code));

    return {
      date: q.date,
      project,
      locked: locked.size > 0,
      workers: workerRows,
      usage: usageRows,
      expenses,
    };
  }

  /**
   * Saves the whole day for a project in one transaction: attendance (upsert by worker + day;
   * rows left out are removed), machine usage (hours from the hour meter, the machine's meter
   * moves forward) and expenses. Any bad row → nothing is saved.
   */
  async save(body: DailyEntrySave) {
    const project = await this.project(body.projectId);
    const date = dayToDate(body.date);

    await this.prisma.$transaction(
      async (tx) => {
        await assertNotLocked(tx, [body.date]);

        // ── Attendance ──
        const workerIds = body.attendance.map((a) => a.workerId);
        const workers = await tx.worker.findMany({
          where: { id: { in: workerIds }, deletedAt: null },
          select: { id: true, fullName: true, code: true },
        });
        const known = new Set(workers.map((w) => w.id));
        body.attendance.forEach((a, i) => {
          if (!known.has(a.workerId)) throw invalid(`attendance.${i}.workerId`);
        });
        const elsewhere = await tx.attendance.findMany({
          where: {
            date,
            workerId: { in: workerIds },
            AND: [{ projectId: { not: null } }, { projectId: { not: project.id } }],
          },
          include: {
            project: { select: projectSelect },
            worker: { select: { code: true, fullName: true } },
          },
        });
        if (elsewhere.length) {
          throw new AppException(
            HttpStatus.CONFLICT,
            'ATTENDANCE_EXISTS_OTHER_PROJECT',
            'Attendance for this worker is already recorded at another project on this day.',
            {
              conflicts: elsewhere.map((e) => ({
                workerId: e.workerId,
                workerCode: e.worker.code,
                workerName: e.worker.fullName,
                projectId: e.projectId,
                projectCode: e.project?.code,
                projectName: e.project?.name,
              })),
            },
          );
        }
        await tx.attendance.deleteMany({
          where: { date, projectId: project.id, workerId: { notIn: workerIds } },
        });
        for (const a of body.attendance) {
          const data = {
            projectId: project.id,
            status: a.status,
            otHours: a.otHours ?? '0',
            notes: a.notes ?? null,
          };
          await tx.attendance.upsert({
            where: { workerId_date: { workerId: a.workerId, date } },
            create: { workerId: a.workerId, date, ...data },
            update: data,
          });
        }

        // ── Machine usage ──
        const existingLogs = await tx.assetUsageLog.findMany({
          where: { date, projectId: project.id },
          select: { id: true },
        });
        const existingIds = new Set(existingLogs.map((l) => l.id));
        const keepIds = new Set<string>();
        for (const [i, u] of body.usage.entries()) {
          if (u.id) {
            if (!existingIds.has(u.id)) throw invalid(`usage.${i}.id`);
            keepIds.add(u.id);
          }
        }
        await tx.assetUsageLog.deleteMany({
          where: { date, projectId: project.id, id: { notIn: [...keepIds] } },
        });
        for (const [i, u] of body.usage.entries()) {
          const asset = await tx.asset.findFirst({ where: { id: u.assetId, deletedAt: null } });
          if (!asset) throw invalid(`usage.${i}.assetId`);
          if (u.operatorWorkerId) {
            const ok = await tx.worker.count({
              where: { id: u.operatorWorkerId, deletedAt: null },
            });
            if (!ok) throw invalid(`usage.${i}.operatorWorkerId`);
          }
          const { hours } = usageFromMeters({
            meterType: asset.meterType,
            startMeter: u.startMeter,
            endMeter: u.endMeter,
            hoursUsed: u.hoursUsed,
          });
          const data = {
            assetId: u.assetId,
            projectId: project.id,
            date,
            startMeter: u.startMeter ?? null,
            endMeter: u.endMeter ?? null,
            hoursUsed: hours ?? '0',
            fuelLitres: u.fuelLitres ?? null,
            fuelCost: u.fuelCost ?? null,
            operatorWorkerId: u.operatorWorkerId ?? null,
            notes: u.notes ?? null,
          };
          if (u.id) await tx.assetUsageLog.update({ where: { id: u.id }, data });
          else await tx.assetUsageLog.create({ data });
          if (u.endMeter && asset.meterType !== 'NONE') {
            const next = maxDecimal(asset.currentMeter, u.endMeter);
            if (!next.eq(dec(asset.currentMeter))) {
              await tx.asset.update({
                where: { id: asset.id },
                data: { currentMeter: next.toString() },
              });
            }
          }
        }

        // ── Expenses ──
        const existingExpenses = await tx.expense.findMany({
          where: { date, projectId: project.id },
          select: { id: true },
        });
        const expenseIds = new Set(existingExpenses.map((e) => e.id));
        const keepExpenses = new Set<string>();
        for (const [i, e] of body.expenses.entries()) {
          if (e.id) {
            if (!expenseIds.has(e.id)) throw invalid(`expenses.${i}.id`);
            keepExpenses.add(e.id);
          }
        }
        await tx.expense.deleteMany({
          where: { date, projectId: project.id, id: { notIn: [...keepExpenses] } },
        });
        for (const [i, e] of body.expenses.entries()) {
          await assertExpenseLinks(tx, e, `expenses.${i}.`);
          const data = {
            date,
            projectId: project.id,
            assetId: e.assetId ?? null,
            category: e.category,
            description: e.description,
            amount: e.amount,
            paidBy: e.paidBy,
            supplierId: e.supplierId ?? null,
            receiptDocumentId: e.receiptDocumentId ?? null,
          };
          if (e.id) await tx.expense.update({ where: { id: e.id }, data });
          else await tx.expense.create({ data });
        }
      },
      { timeout: 30_000 },
    );

    return this.get({ date: body.date, projectId: body.projectId });
  }

  /**
   * "Copy from yesterday": the attendance of the last earlier day (within 31 days) that has any
   * attendance for this project, to prefill the form.
   */
  async copyFrom(q: DailyEntryQuery): Promise<CopyFromDto> {
    const project = await this.project(q.projectId);
    const last = await this.prisma.attendance.findFirst({
      where: {
        projectId: project.id,
        date: { lt: dayToDate(q.date), gte: dayToDate(shiftDay(q.date, -COPY_LOOKBACK_DAYS)) },
      },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!last) return { date: null, attendance: [] };
    const rows = await this.prisma.attendance.findMany({
      where: { projectId: project.id, date: last.date, worker: { deletedAt: null } },
      include: { worker: { select: workerSelect } },
    });
    const elsewhere = await this.prisma.attendance.findMany({
      where: {
        date: dayToDate(q.date),
        workerId: { in: rows.map((r) => r.workerId) },
        projectId: { not: project.id },
      },
      include: { project: { select: projectSelect } },
    });
    const other = new Map(elsewhere.filter((e) => e.project).map((e) => [e.workerId, e.project!]));
    return {
      date: toDay(last.date),
      attendance: rows
        .map((r) => ({
          workerId: r.workerId,
          code: r.worker.code,
          fullName: r.worker.fullName,
          nameSinhala: r.worker.nameSinhala,
          skill: r.worker.skill,
          type: r.worker.type,
          status: r.status,
          otHours: r.otHours.toString(),
          otherProject: other.get(r.workerId) ?? null,
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    };
  }

  /** Attendance rows for a worker / project and a day range, with a small summary. */
  async attendance(q: AttendanceQuery) {
    const rows = await this.prisma.attendance.findMany({
      where: {
        date: { gte: dayToDate(q.from), lte: dayToDate(q.to) },
        ...(q.workerId ? { workerId: q.workerId } : {}),
        ...(q.projectId ? { projectId: q.projectId } : {}),
      },
      include: { project: { select: projectSelect } },
      orderBy: [{ date: 'asc' }],
    });
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    const present = count('PRESENT');
    const halfDays = count('HALF_DAY');
    return {
      items: rows,
      summary: {
        present,
        halfDays,
        absent: count('ABSENT'),
        leave: count('LEAVE'),
        daysWorked: dec(present).plus(dec(halfDays).dividedBy(2)).toString(),
        otHours: rows.reduce((s, r) => s.plus(dec(r.otHours)), dec(0)).toString(),
      },
    };
  }
}
