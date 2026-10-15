import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AllocationConflict,
  type AllocationKind,
  type AllocationListQuery,
  type AllocationUpdate,
  type AssetAllocationCreate,
  type AvailabilityDto,
  type AvailabilityQuery,
  type WorkerAllocationCreate,
  colomboDay,
  colomboDayRange,
  colomboInstant,
  colomboTime,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { PG_EXCLUSION_VIOLATION, findPgCode } from '../../common/errors/prisma-error.mapper.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  type ExistingBooking,
  type Slot,
  buildSlots,
  findConflicts,
  slotWindow,
} from './calc/slots.js';

type Db = PrismaService | Prisma.TransactionClient;

const projectSelect = { id: true, code: true, name: true } as const;
const workerInclude = {
  project: { select: projectSelect },
  worker: { select: { id: true, code: true, fullName: true, skill: true } },
} as const;
const assetInclude = {
  project: { select: projectSelect },
  asset: { select: { id: true, code: true, name: true, category: true } },
  operator: { select: { id: true, code: true, fullName: true } },
} as const;

type WorkerRow = Prisma.WorkerAllocationGetPayload<{ include: typeof workerInclude }>;
type AssetRow = Prisma.AssetAllocationGetPayload<{ include: typeof assetInclude }>;

function toDto(kind: AllocationKind, row: WorkerRow | AssetRow) {
  const w = kind === 'worker' ? (row as WorkerRow) : null;
  const a = kind === 'asset' ? (row as AssetRow) : null;
  return {
    id: row.id,
    kind,
    workerId: w?.workerId ?? null,
    assetId: a?.assetId ?? null,
    projectId: row.projectId,
    startAt: row.startAt,
    endAt: row.endAt,
    status: row.status,
    notes: row.notes,
    operatorWorkerId: a?.operatorWorkerId ?? null,
    project: row.project,
    worker: w?.worker ?? null,
    asset: a?.asset ?? null,
    operator: a?.operator ?? null,
  };
}

function overlapError(conflicts: AllocationConflict[]): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'ALLOCATION_OVERLAP',
    'This allocation overlaps another allocation for the same worker or machine.',
    { conflicts },
  );
}

@Injectable()
export class AllocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Allocations that touch the days from..to (Colombo), oldest first. */
  async list(q: AllocationListQuery) {
    const from = colomboDayRange(q.from).start;
    const to = colomboDayRange(q.to).end;
    const common = {
      startAt: { lt: to },
      endAt: { gt: from },
      ...(q.includeCancelled ? {} : { status: 'PLANNED' as const }),
      ...(q.projectId ? { projectId: q.projectId } : {}),
    };
    if (q.kind === 'worker') {
      const rows = await this.prisma.workerAllocation.findMany({
        where: { ...common, ...(q.workerId ? { workerId: q.workerId } : {}) },
        include: workerInclude,
        orderBy: [{ startAt: 'asc' }],
      });
      return rows.map((r) => toDto('worker', r));
    }
    const rows = await this.prisma.assetAllocation.findMany({
      where: { ...common, ...(q.assetId ? { assetId: q.assetId } : {}) },
      include: assetInclude,
      orderBy: [{ startAt: 'asc' }],
    });
    return rows.map((r) => toDto('asset', r));
  }

  async createWorkers(body: WorkerAllocationCreate) {
    await this.assertProject(body.projectId);
    const ids = [...new Set(body.workerIds)];
    const found = await this.prisma.worker.count({ where: { id: { in: ids }, deletedAt: null } });
    if (found !== ids.length) throw this.notFound('workerIds');
    const slots = buildSlots({ ...body, resourceIds: ids });
    return this.insert('worker', slots, (tx) =>
      tx.workerAllocation.createManyAndReturn({
        data: slots.map((s) => ({
          workerId: s.resourceId,
          projectId: body.projectId,
          startAt: s.start,
          endAt: s.end,
          notes: body.notes ?? null,
        })),
        include: workerInclude,
      }),
    );
  }

  async createAssets(body: AssetAllocationCreate) {
    await this.assertProject(body.projectId);
    const ids = [...new Set(body.assetIds)];
    const found = await this.prisma.asset.count({ where: { id: { in: ids }, deletedAt: null } });
    if (found !== ids.length) throw this.notFound('assetIds');
    if (body.operatorWorkerId) await this.assertWorker(body.operatorWorkerId, 'operatorWorkerId');
    const slots = buildSlots({ ...body, resourceIds: ids });
    return this.insert('asset', slots, (tx) =>
      tx.assetAllocation.createManyAndReturn({
        data: slots.map((s) => ({
          assetId: s.resourceId,
          projectId: body.projectId,
          startAt: s.start,
          endAt: s.end,
          operatorWorkerId: body.operatorWorkerId ?? null,
          notes: body.notes ?? null,
        })),
        include: assetInclude,
      }),
    );
  }

  /**
   * All-or-nothing insert: clashes are looked up first so that every conflict can be listed;
   * the exclusion constraint still guards against races (then the lookup is repeated).
   */
  private async insert<R extends WorkerRow | AssetRow>(
    kind: AllocationKind,
    slots: Slot[],
    create: (tx: Prisma.TransactionClient) => Promise<R[]>,
  ) {
    const conflicts = await this.conflictsFor(this.prisma, kind, slots);
    if (conflicts.length) throw overlapError(conflicts);
    try {
      const rows = await this.prisma.$transaction((tx) => create(tx));
      return rows.map((r) => toDto(kind, r));
    } catch (err) {
      if (findPgCode(err) === PG_EXCLUSION_VIOLATION) {
        throw overlapError(await this.conflictsFor(this.prisma, kind, slots));
      }
      throw err;
    }
  }

  /** Move (project / day) or resize (times) a planned allocation. */
  async update(id: string, body: AllocationUpdate) {
    const { kind, row } = await this.find(id);
    if (row.status === 'CANCELLED') {
      throw AppException.conflict('CONFLICT', 'A cancelled allocation cannot be changed.');
    }
    if (body.projectId) await this.assertProject(body.projectId);
    if (body.operatorWorkerId) await this.assertWorker(body.operatorWorkerId, 'operatorWorkerId');
    const day = body.date ?? colomboDay(row.startAt);
    const startTime = body.startTime ?? colomboTime(row.startAt);
    const endTime = body.endTime ?? colomboTime(row.endAt);
    if (endTime <= startTime) {
      throw AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
        { path: 'endTime', message: 'END_TIME_BEFORE_START', code: 'custom' },
      ]);
    }
    const resourceId = kind === 'worker' ? (row as WorkerRow).workerId : (row as AssetRow).assetId;
    const slot: Slot = {
      resourceId,
      start: colomboInstant(day, startTime),
      end: colomboInstant(day, endTime),
    };
    const conflicts = await this.conflictsFor(this.prisma, kind, [slot], id);
    if (conflicts.length) throw overlapError(conflicts);
    const data = {
      startAt: slot.start,
      endAt: slot.end,
      ...(body.projectId ? { projectId: body.projectId } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    };
    try {
      if (kind === 'worker') {
        const updated = await this.prisma.workerAllocation.update({
          where: { id },
          data,
          include: workerInclude,
        });
        return toDto('worker', updated);
      }
      const updated = await this.prisma.assetAllocation.update({
        where: { id },
        data: {
          ...data,
          ...(body.operatorWorkerId !== undefined
            ? { operatorWorkerId: body.operatorWorkerId }
            : {}),
        },
        include: assetInclude,
      });
      return toDto('asset', updated);
    } catch (err) {
      if (findPgCode(err) === PG_EXCLUSION_VIOLATION) {
        throw overlapError(await this.conflictsFor(this.prisma, kind, [slot], id));
      }
      throw err;
    }
  }

  /** Cancelling frees the slot (the exclusion constraint ignores CANCELLED rows). */
  async cancel(id: string) {
    const { kind } = await this.find(id);
    if (kind === 'worker') {
      const row = await this.prisma.workerAllocation.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: workerInclude,
      });
      return toDto('worker', row);
    }
    const row = await this.prisma.assetAllocation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: assetInclude,
    });
    return toDto('asset', row);
  }

  /** Workers (active) or machines (not disposed) and whether they are free for every slot. */
  async availability(q: AvailabilityQuery): Promise<AvailabilityDto> {
    const resources =
      q.kind === 'worker'
        ? (
            await this.prisma.worker.findMany({
              where: { deletedAt: null, active: true },
              select: { id: true, code: true, fullName: true },
              orderBy: { code: 'asc' },
            })
          ).map((w) => ({ id: w.id, code: w.code, name: w.fullName }))
        : await this.prisma.asset.findMany({
            where: { deletedAt: null, status: { not: 'DISPOSED' } },
            select: { id: true, code: true, name: true },
            orderBy: { code: 'asc' },
          });
    const slots = buildSlots({ ...q, resourceIds: resources.map((r) => r.id) });
    const conflicts = await this.conflictsFor(this.prisma, q.kind, slots);
    const busyProjects = new Map<string, Set<string>>();
    for (const c of conflicts) {
      const set = busyProjects.get(c.resourceId) ?? new Set<string>();
      set.add(c.projectName);
      busyProjects.set(c.resourceId, set);
    }
    return {
      free: resources.filter((r) => !busyProjects.has(r.id)),
      busy: resources
        .filter((r) => busyProjects.has(r.id))
        .map((r) => ({ ...r, projects: [...busyProjects.get(r.id)!] })),
    };
  }

  /** Existing PLANNED bookings that clash with the slots, with names for the error dialog. */
  async conflictsFor(
    db: Db,
    kind: AllocationKind,
    slots: readonly Slot[],
    excludeId?: string,
  ): Promise<AllocationConflict[]> {
    const window = slotWindow(slots);
    if (!window) return [];
    const resourceIds = [...new Set(slots.map((s) => s.resourceId))];
    const where = {
      status: 'PLANNED' as const,
      startAt: { lt: window.to },
      endAt: { gt: window.from },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    };
    let existing: (ExistingBooking & {
      projectId: string;
      projectName: string;
      name: string;
      code: string;
    })[];
    if (kind === 'worker') {
      const rows = await db.workerAllocation.findMany({
        where: { ...where, workerId: { in: resourceIds } },
        include: {
          project: { select: projectSelect },
          worker: { select: { code: true, fullName: true } },
        },
      });
      existing = rows.map((r) => ({
        id: r.id,
        resourceId: r.workerId,
        startAt: r.startAt,
        endAt: r.endAt,
        projectId: r.projectId,
        projectName: r.project.name,
        name: r.worker.fullName,
        code: r.worker.code,
      }));
    } else {
      const rows = await db.assetAllocation.findMany({
        where: { ...where, assetId: { in: resourceIds } },
        include: {
          project: { select: projectSelect },
          asset: { select: { code: true, name: true } },
        },
      });
      existing = rows.map((r) => ({
        id: r.id,
        resourceId: r.assetId,
        startAt: r.startAt,
        endAt: r.endAt,
        projectId: r.projectId,
        projectName: r.project.name,
        name: r.asset.name,
        code: r.asset.code,
      }));
    }
    const byId = new Map(existing.map((e) => [e.id, e]));
    return findConflicts(slots, existing).map(({ slot, booking }) => {
      const e = byId.get(booking.id)!;
      return {
        kind,
        resourceId: e.resourceId,
        resourceName: e.name,
        resourceCode: e.code,
        allocationId: e.id,
        projectId: e.projectId,
        projectName: e.projectName,
        startAt: e.startAt.toISOString(),
        endAt: e.endAt.toISOString(),
        requestedStartAt: slot.start.toISOString(),
        requestedEndAt: slot.end.toISOString(),
      };
    });
  }

  private async find(
    id: string,
  ): Promise<{ kind: 'worker'; row: WorkerRow } | { kind: 'asset'; row: AssetRow }> {
    const w = await this.prisma.workerAllocation.findUnique({
      where: { id },
      include: workerInclude,
    });
    if (w) return { kind: 'worker', row: w };
    const a = await this.prisma.assetAllocation.findUnique({
      where: { id },
      include: assetInclude,
    });
    if (a) return { kind: 'asset', row: a };
    throw AppException.notFound('Allocation not found.');
  }

  private notFound(path: string): AppException {
    return AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
      { path, message: 'NOT_FOUND', code: 'custom' },
    ]);
  }

  private async assertProject(id: string): Promise<void> {
    const p = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!p) throw this.notFound('projectId');
  }

  private async assertWorker(id: string, path: string): Promise<void> {
    const w = await this.prisma.worker.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!w) throw this.notFound(path);
  }
}
