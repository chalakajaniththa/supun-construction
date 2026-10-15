import { Injectable } from '@nestjs/common';
import {
  type MaintenanceCreate,
  type MaintenanceUpdate,
  type ServiceStatusDto,
  type UsageListQuery,
  dayToDate,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { dec, maxDecimal } from '../../common/money/money.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { serviceStatus } from './calc/service-status.js';

const usageInclude = {
  project: { select: { id: true, code: true, name: true } },
  operator: { select: { id: true, code: true, fullName: true } },
} as const;
const maintenanceInclude = { supplier: { select: { id: true, code: true, name: true } } } as const;

/** Usage log, maintenance records and service status of a machine / vehicle. */
@Injectable()
export class AssetOpsService {
  constructor(private readonly prisma: PrismaService) {}

  private async asset(id: string) {
    const a = await this.prisma.asset.findFirst({ where: { id, deletedAt: null } });
    if (!a) throw AppException.notFound('Asset not found.');
    return a;
  }

  async usage(assetId: string, q: UsageListQuery) {
    await this.asset(assetId);
    const where: Prisma.AssetUsageLogWhereInput = {
      assetId,
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: dayToDate(q.from) } : {}),
              ...(q.to ? { lte: dayToDate(q.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total, agg] = await this.prisma.$transaction([
      this.prisma.assetUsageLog.findMany({
        where,
        include: usageInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...toSkipTake(q),
      }),
      this.prisma.assetUsageLog.count({ where }),
      this.prisma.assetUsageLog.aggregate({
        where,
        _sum: { hoursUsed: true, fuelLitres: true, fuelCost: true },
      }),
    ]);
    return {
      ...paginated(items, total, q),
      totals: {
        hours: dec(agg._sum.hoursUsed).toString(),
        fuelLitres: dec(agg._sum.fuelLitres).toString(),
        fuelCost: dec(agg._sum.fuelCost).toFixed(2),
      },
    };
  }

  async serviceStatus(assetId: string): Promise<ServiceStatusDto> {
    const a = await this.asset(assetId);
    return {
      meterType: a.meterType,
      currentMeter: a.currentMeter.toString(),
      lastServiceMeter: a.lastServiceMeter?.toString() ?? null,
      interval: a.serviceIntervalMeter?.toString() ?? null,
      ...serviceStatus({
        meterType: a.meterType,
        currentMeter: a.currentMeter,
        lastServiceMeter: a.lastServiceMeter,
        serviceIntervalMeter: a.serviceIntervalMeter,
      }),
    };
  }

  async listMaintenance(assetId: string) {
    await this.asset(assetId);
    return this.prisma.maintenanceRecord.findMany({
      where: { assetId },
      include: maintenanceInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async assertSupplier(supplierId: string | null | undefined) {
    if (!supplierId) return;
    const ok = await this.prisma.supplier.count({ where: { id: supplierId, deletedAt: null } });
    if (!ok) {
      throw AppException.badRequest('VALIDATION_FAILED', 'Some values are not valid.', [
        { path: 'supplierId', message: 'NOT_FOUND', code: 'custom' },
      ]);
    }
  }

  /**
   * A SERVICE record sets the machine's last-service meter (the reading given, or the current meter).
   * A reading above the current meter moves the meter forward.
   */
  async createMaintenance(assetId: string, data: MaintenanceCreate) {
    const asset = await this.asset(assetId);
    await this.assertSupplier(data.supplierId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.maintenanceRecord.create({
        data: {
          assetId,
          date: dayToDate(data.date),
          type: data.type,
          description: data.description,
          meterReading: data.meterReading ?? null,
          cost: data.cost ?? '0',
          supplierId: data.supplierId ?? null,
          nextServiceMeter: data.nextServiceMeter ?? null,
        },
        include: maintenanceInclude,
      });
      await this.applyMeters(tx, asset, row.type, data.meterReading ?? null);
      return row;
    });
  }

  async updateMaintenance(assetId: string, id: string, data: MaintenanceUpdate) {
    const asset = await this.asset(assetId);
    const current = await this.prisma.maintenanceRecord.findFirst({ where: { id, assetId } });
    if (!current) throw AppException.notFound('Maintenance record not found.');
    await this.assertSupplier(data.supplierId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.maintenanceRecord.update({
        where: { id },
        data: definedOnly({
          ...data,
          date: data.date ? dayToDate(data.date) : undefined,
          cost: data.cost === null ? '0' : data.cost,
        }) as Prisma.MaintenanceRecordUncheckedUpdateInput,
        include: maintenanceInclude,
      });
      if (row.type === 'SERVICE' || current.type === 'SERVICE') {
        await this.recomputeLastService(tx, assetId);
      }
      await this.applyMeters(tx, asset, 'OTHER', row.meterReading?.toString() ?? null);
      return row;
    });
  }

  async removeMaintenance(assetId: string, id: string) {
    await this.asset(assetId);
    const current = await this.prisma.maintenanceRecord.findFirst({ where: { id, assetId } });
    if (!current) throw AppException.notFound('Maintenance record not found.');
    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceRecord.delete({ where: { id } });
      if (current.type === 'SERVICE') await this.recomputeLastService(tx, assetId);
    });
    return { id };
  }

  private async applyMeters(
    tx: Prisma.TransactionClient,
    asset: { id: string; meterType: string; currentMeter: Prisma.Decimal },
    type: string,
    reading: string | null,
  ) {
    if (asset.meterType === 'NONE') return;
    const fresh = await tx.asset.findUniqueOrThrow({ where: { id: asset.id } });
    const data: Prisma.AssetUpdateInput = {};
    if (reading && dec(reading).gt(dec(fresh.currentMeter))) {
      data.currentMeter = maxDecimal(fresh.currentMeter, reading).toString();
    }
    if (type === 'SERVICE') data.lastServiceMeter = reading ?? fresh.currentMeter.toString();
    if (Object.keys(data).length) await tx.asset.update({ where: { id: asset.id }, data });
  }

  /** After a SERVICE record changed or was removed: last service = the latest remaining one. */
  private async recomputeLastService(tx: Prisma.TransactionClient, assetId: string) {
    const latest = await tx.maintenanceRecord.findFirst({
      where: { assetId, type: 'SERVICE', meterReading: { not: null } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    if (latest?.meterReading) {
      await tx.asset.update({
        where: { id: assetId },
        data: { lastServiceMeter: latest.meterReading },
      });
    }
  }
}
