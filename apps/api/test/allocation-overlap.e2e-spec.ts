import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { findPgCode, mapPrismaError } from '../src/common/errors/prisma-error.mapper.js';
import { type TestContext, createTestApp, resetDb } from './helpers.js';

/** The btree_gist exclusion constraints from migration *_allocation_exclusion_constraints. */
describe('allocation overlap constraints', () => {
  let ctx: TestContext;
  let workerId: string;
  let assetId: string;
  let projectId: string;

  const at = (hhmm: string, day = '2026-10-14') => new Date(`${day}T${hhmm}:00+05:30`);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
    const client = await ctx.prisma.client.create({
      data: { name: 'Test PS', type: 'GOVERNMENT' },
    });
    const project = await ctx.prisma.project.create({
      data: {
        code: 'PRJ-TEST-001',
        name: 'Test road',
        type: 'ROAD',
        source: 'GOVERNMENT_TENDER',
        clientId: client.id,
        startDate: new Date('2026-10-01'),
        plannedEndDate: new Date('2027-03-31'),
      },
    });
    projectId = project.id;
    const worker = await ctx.prisma.worker.create({
      data: {
        code: 'W-9001',
        fullName: 'Test Worker',
        skill: 'MASON',
        type: 'DAILY',
        joinedDate: new Date('2026-01-01'),
      },
    });
    workerId = worker.id;
    const asset = await ctx.prisma.asset.create({
      data: { code: 'AST-901', name: 'Test JCB', category: 'JCB_BACKHOE' },
    });
    assetId = asset.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function rawWorkerInsert(start: Date, end: Date, status = 'PLANNED') {
    return ctx.prisma.$executeRaw`
      INSERT INTO "WorkerAllocation" (id, "workerId", "projectId", "startAt", "endAt", status, "updatedAt")
      VALUES (gen_random_uuid(), ${workerId}::uuid, ${projectId}::uuid, ${start}, ${end},
              ${status}::"AllocationStatus", now())`;
  }

  async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (err) {
      return findPgCode(err);
    }
    return undefined;
  }

  it('rejects an overlapping worker allocation with SQLSTATE 23P01 (raw insert)', async () => {
    await rawWorkerInsert(at('10:00'), at('12:00'));
    expect(await sqlState(rawWorkerInsert(at('11:00'), at('13:00')))).toBe('23P01');
    expect(await sqlState(rawWorkerInsert(at('09:00'), at('10:30')))).toBe('23P01');
    expect(await sqlState(rawWorkerInsert(at('10:30'), at('11:30')))).toBe('23P01');
    expect(await ctx.prisma.workerAllocation.count()).toBe(1);
  });

  it('allows back-to-back worker allocations (10:00–12:00, 12:00–14:00)', async () => {
    await rawWorkerInsert(at('10:00'), at('12:00'));
    await rawWorkerInsert(at('12:00'), at('14:00'));
    expect(await ctx.prisma.workerAllocation.count()).toBe(2);
  });

  it('ignores cancelled allocations', async () => {
    await rawWorkerInsert(at('10:00'), at('12:00'), 'CANCELLED');
    await rawWorkerInsert(at('10:00'), at('12:00'));
    expect(await ctx.prisma.workerAllocation.count()).toBe(2);
  });

  it('allows the same time slot for different workers', async () => {
    const other = await ctx.prisma.worker.create({
      data: {
        code: 'W-9002',
        fullName: 'Other',
        skill: 'HELPER',
        type: 'DAILY',
        joinedDate: new Date(),
      },
    });
    await rawWorkerInsert(at('10:00'), at('12:00'));
    await ctx.prisma.workerAllocation.create({
      data: { workerId: other.id, projectId, startAt: at('10:00'), endAt: at('12:00') },
    });
    expect(await ctx.prisma.workerAllocation.count()).toBe(2);
  });

  it('maps an overlapping Prisma create to 409 ALLOCATION_OVERLAP', async () => {
    await ctx.prisma.workerAllocation.create({
      data: { workerId, projectId, startAt: at('08:00'), endAt: at('17:00') },
    });
    let error: unknown;
    try {
      await ctx.prisma.workerAllocation.create({
        data: { workerId, projectId, startAt: at('16:00'), endAt: at('18:00') },
      });
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(findPgCode(error)).toBe('23P01');
    expect(mapPrismaError(error)).toMatchObject({ statusCode: 409, code: 'ALLOCATION_OVERLAP' });
  });

  it('rejects endAt <= startAt (check constraint)', async () => {
    expect(await sqlState(rawWorkerInsert(at('12:00'), at('12:00')))).toBe('23514');
    expect(await sqlState(rawWorkerInsert(at('12:00'), at('11:00')))).toBe('23514');
  });

  it('applies the same rules to asset allocations', async () => {
    await ctx.prisma.assetAllocation.create({
      data: {
        assetId,
        projectId,
        startAt: at('07:00', '2026-10-15'),
        endAt: at('12:00', '2026-10-15'),
      },
    });
    await ctx.prisma.assetAllocation.create({
      data: {
        assetId,
        projectId,
        startAt: at('12:00', '2026-10-15'),
        endAt: at('17:00', '2026-10-15'),
      },
    });
    const overlap = ctx.prisma.assetAllocation.create({
      data: {
        assetId,
        projectId,
        startAt: at('11:00', '2026-10-15'),
        endAt: at('13:00', '2026-10-15'),
      },
    });
    expect(await sqlState(overlap)).toBe('23P01');
    const reversed = ctx.prisma.assetAllocation.create({
      data: {
        assetId,
        projectId,
        startAt: at('18:00', '2026-10-15'),
        endAt: at('17:00', '2026-10-15'),
      },
    });
    expect(await sqlState(reversed)).toBe('23514');
    expect(await ctx.prisma.assetAllocation.count()).toBe(2);
  });
});
