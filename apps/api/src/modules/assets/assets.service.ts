import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AssetCreate,
  type AssetListQuery,
  type AssetUpdate,
  type Paginated,
  dayToDate,
} from '@sc/shared';
import { nextCode, withCodeRetry } from '../../common/codes/codes.js';
import { AppException } from '../../common/errors/app-exception.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly, searchWhere } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Asset, Prisma } from '../../generated/prisma/client.js';

export type AssetWithExpiry = Asset & { nextExpiry: Date | null };

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: AssetListQuery): Promise<Paginated<AssetWithExpiry>> {
    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
      ...(q.category ? { category: q.category } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.isVehicle !== undefined ? { isVehicle: q.isVehicle } : {}),
      ...searchWhere(q.search, ['name', 'code', 'registrationNo', 'make', 'model'] as const),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({ where, orderBy: { code: 'asc' }, ...toSkipTake(q) }),
      this.prisma.asset.count({ where }),
    ]);
    const expiries = await this.nextExpiries(rows.map((r) => r.id));
    return paginated(
      rows.map((r) => ({ ...r, nextExpiry: expiries.get(r.id) ?? null })),
      total,
      q,
    );
  }

  /** Earliest expiry date among the current versions of each asset's (not deleted) documents. */
  async nextExpiries(assetIds: string[]): Promise<Map<string, Date>> {
    const out = new Map<string, Date>();
    if (!assetIds.length) return out;
    const docs = await this.prisma.document.findMany({
      where: {
        ownerType: 'ASSET',
        ownerId: { in: assetIds },
        deletedAt: null,
        currentVersion: { expiryDate: { not: null } },
      },
      select: { ownerId: true, currentVersion: { select: { expiryDate: true } } },
    });
    for (const d of docs) {
      const expiry = d.currentVersion?.expiryDate;
      if (!d.ownerId || !expiry) continue;
      const prev = out.get(d.ownerId);
      if (!prev || expiry < prev) out.set(d.ownerId, expiry);
    }
    return out;
  }

  async get(id: string): Promise<AssetWithExpiry> {
    const row = await this.prisma.asset.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw AppException.notFound('Asset not found.');
    const expiries = await this.nextExpiries([id]);
    return { ...row, nextExpiry: expiries.get(id) ?? null };
  }

  private async assertRegistrationFree(
    registrationNo: string | null | undefined,
    exceptId?: string,
  ) {
    if (!registrationNo) return;
    const other = await this.prisma.asset.findFirst({
      where: { registrationNo, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (other) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'DUPLICATE',
        'This registration number is already used.',
        [{ path: 'registrationNo', message: 'REG_NO_TAKEN', code: 'custom' }],
      );
    }
  }

  /** Code AST-NNN. */
  async create(data: AssetCreate): Promise<AssetWithExpiry> {
    await this.assertRegistrationFree(data.registrationNo);
    const asset = await withCodeRetry(
      () => nextCode(this.prisma, 'Asset', 'AST-', 3),
      (code) =>
        this.prisma.asset.create({
          data: {
            ...data,
            code,
            purchaseDate: dayToDate(data.purchaseDate),
            currentMeter: data.currentMeter ?? '0',
            ownership: data.ownership ?? 'OWNED',
            status: data.status ?? 'AVAILABLE',
            meterType: data.meterType ?? 'HOURS',
            isVehicle: data.isVehicle ?? false,
          },
        }),
    );
    return this.get(asset.id);
  }

  async update(id: string, data: AssetUpdate): Promise<AssetWithExpiry> {
    await this.get(id);
    await this.assertRegistrationFree(data.registrationNo, id);
    await this.prisma.asset.update({
      where: { id },
      data: definedOnly({
        ...data,
        purchaseDate: dayToDate(data.purchaseDate),
        currentMeter: data.currentMeter === null ? '0' : data.currentMeter,
      }),
    });
    return this.get(id);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.get(id);
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }
}
