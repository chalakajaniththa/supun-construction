import { Injectable } from '@nestjs/common';
import {
  type BoqImport,
  type BoqImportPreviewDto,
  type BoqItemCreate,
  type BoqItemUpdate,
  type EotCreate,
  type EotUpdate,
  type MeasurementCreate,
  type ProgressRecord,
  type VariationCreate,
  type VariationUpdate,
  dayToDate,
  toDay,
} from '@sc/shared';
import { todayInColombo } from '../../common/dates/dates.js';
import { AppException } from '../../common/errors/app-exception.js';
import { sum } from '../../common/money/money.js';
import { definedOnly } from '../../common/pagination/search.js';
import { fieldError, requireProject } from '../../common/projects/require-project.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { SmallFile } from '../../common/upload/read-small-file.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { buildPreview, parseCsv, parseXlsx } from './calc/import.js';
import {
  type BoqItemLike,
  type ProgressResult,
  calculateProgress,
  checkMeasurement,
  itemAmount,
  measurementWarnings,
} from './calc/progress.js';

type Db = PrismaClient | Prisma.TransactionClient;

const itemInclude = {
  variation: { select: { id: true, number: true, title: true, status: true } },
  _count: { select: { measurements: true } },
} as const satisfies Prisma.BoqItemInclude;
type ItemRow = Prisma.BoqItemGetPayload<{ include: typeof itemInclude }>;

const toItemDto = ({ _count, ...it }: ItemRow) => ({
  ...it,
  amount: itemAmount(it.quantity.toString(), it.rate.toString()),
  measurementCount: _count.measurements,
});

const outOfOrder = (details: unknown) =>
  AppException.conflict(
    'MEASUREMENT_OUT_OF_ORDER',
    'Progress cannot go backwards: the quantity must not be below an earlier measurement or above a later one.',
    details,
  );

@Injectable()
export class BoqService {
  constructor(private readonly prisma: PrismaService) {}

  // ── BOQ items ─────────────────────────────────────────────────────────
  async list(projectId: string) {
    await requireProject(this.prisma, projectId);
    const rows = await this.prisma.boqItem.findMany({
      where: { projectId },
      include: itemInclude,
      orderBy: [{ sortOrder: 'asc' }, { itemNo: 'asc' }],
    });
    return rows.map(toItemDto);
  }

  private async item(projectId: string, itemId: string) {
    const row = await this.prisma.boqItem.findFirst({
      where: { id: itemId, projectId, project: { deletedAt: null } },
      include: itemInclude,
    });
    if (!row) throw AppException.notFound('BOQ item not found.');
    return row;
  }

  private async assertVariation(projectId: string, variationId: string | null | undefined) {
    if (!variationId) return;
    const v = await this.prisma.variation.findFirst({ where: { id: variationId, projectId } });
    if (!v) throw fieldError('variationId', 'NOT_FOUND');
  }

  private async nextSortOrder(db: Db, projectId: string) {
    const max = await db.boqItem.aggregate({ where: { projectId }, _max: { sortOrder: true } });
    return (max._max.sortOrder ?? 0) + 10;
  }

  async create(projectId: string, data: BoqItemCreate) {
    await requireProject(this.prisma, projectId);
    await this.assertVariation(projectId, data.variationId);
    const row = await this.prisma.boqItem.create({
      data: {
        projectId,
        itemNo: data.itemNo,
        description: data.description,
        unit: data.unit,
        quantity: data.quantity,
        rate: data.rate,
        sortOrder: data.sortOrder ?? (await this.nextSortOrder(this.prisma, projectId)),
        variationId: data.variationId ?? null,
      },
      include: itemInclude,
    });
    return toItemDto(row);
  }

  async update(projectId: string, itemId: string, data: BoqItemUpdate) {
    await this.item(projectId, itemId);
    await this.assertVariation(projectId, data.variationId);
    const row = await this.prisma.boqItem.update({
      where: { id: itemId },
      data: definedOnly({ ...data }) as Prisma.BoqItemUncheckedUpdateInput,
      include: itemInclude,
    });
    return toItemDto(row);
  }

  /** Items with recorded progress cannot be removed (their progress may already be billed). */
  async remove(projectId: string, itemId: string) {
    const row = await this.item(projectId, itemId);
    if (row._count.measurements) {
      throw AppException.conflict(
        'BOQ_HAS_PROGRESS',
        'Progress is recorded for this item, so it cannot be removed.',
      );
    }
    await this.prisma.boqItem.delete({ where: { id: itemId } });
    return { id: itemId };
  }

  // ── Import ────────────────────────────────────────────────────────────
  async importPreview(projectId: string, file: SmallFile): Promise<BoqImportPreviewDto> {
    await requireProject(this.prisma, projectId);
    const ext = file.fileName.toLowerCase().split('.').pop();
    let cells: string[][];
    try {
      if (ext === 'csv' || ext === 'txt') cells = parseCsv(file.data.toString('utf8'));
      else if (ext === 'xlsx') cells = await parseXlsx(file.data);
      else {
        throw AppException.badRequest('UNSUPPORTED_FILE_TYPE', 'Use a CSV or Excel (.xlsx) file.', {
          allowed: ['csv', 'xlsx'],
        });
      }
    } catch (err) {
      if (err instanceof AppException) throw err;
      throw AppException.badRequest('IMPORT_FILE_INVALID', 'This file could not be read.');
    }
    const rows = buildPreview(cells);
    if (!rows.length) {
      throw AppException.badRequest('IMPORT_FILE_INVALID', 'No BOQ items were found in this file.');
    }
    const valid = rows.filter((r) => !r.errors.length);
    return {
      fileName: file.fileName,
      rows,
      validCount: valid.length,
      errorCount: rows.length - valid.length,
      total: sum(valid.map((r) => r.amount)).toFixed(2),
    };
  }

  /** Adds the confirmed rows (or replaces the whole BOQ while no progress is recorded). */
  async importRows(projectId: string, body: BoqImport) {
    await requireProject(this.prisma, projectId);
    await this.prisma.$transaction(async (tx) => {
      if (body.replace) {
        const measured = await tx.boqMeasurement.count({ where: { boqItem: { projectId } } });
        if (measured) {
          throw AppException.conflict(
            'BOQ_HAS_PROGRESS',
            'Progress is already recorded, so the BOQ cannot be replaced. Add the items instead.',
          );
        }
        await tx.boqItem.deleteMany({ where: { projectId } });
      }
      const start = await this.nextSortOrder(tx, projectId);
      await tx.boqItem.createMany({
        data: body.rows.map((r, i) => ({
          projectId,
          itemNo: r.itemNo,
          description: r.description,
          unit: r.unit,
          quantity: r.quantity,
          rate: r.rate,
          sortOrder: start + i * 10,
        })),
      });
    });
    return this.list(projectId);
  }

  // ── Measurements & progress ───────────────────────────────────────────
  async measurements(itemId: string) {
    const item = await this.prisma.boqItem.findFirst({
      where: { id: itemId, project: { deletedAt: null } },
      select: { id: true },
    });
    if (!item) throw AppException.notFound('BOQ item not found.');
    return this.prisma.boqMeasurement.findMany({
      where: { boqItemId: itemId },
      orderBy: { date: 'desc' },
    });
  }

  /** Records (or replaces, for the same date) one cumulative measurement. */
  async addMeasurement(itemId: string, data: MeasurementCreate) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.boqItem.findFirst({
        where: { id: itemId, project: { deletedAt: null } },
        include: { measurements: true },
      });
      if (!item) throw AppException.notFound('BOQ item not found.');
      const others = item.measurements
        .filter((m) => toDay(m.date) !== data.date)
        .map((m) => ({ date: toDay(m.date), cumulativeQty: m.cumulativeQty.toString() }));
      if (checkMeasurement(others, data.date, data.cumulativeQty)) {
        throw outOfOrder({ items: [{ boqItemId: item.id, itemNo: item.itemNo }] });
      }
      const measurement = await tx.boqMeasurement.upsert({
        where: { boqItemId_date: { boqItemId: itemId, date: dayToDate(data.date) } },
        create: {
          boqItemId: itemId,
          date: dayToDate(data.date),
          cumulativeQty: data.cumulativeQty,
          notes: data.notes ?? null,
        },
        update: { cumulativeQty: data.cumulativeQty, notes: data.notes ?? null },
      });
      return {
        measurement,
        warnings: measurementWarnings(item.quantity.toString(), data.cumulativeQty),
      };
    });
  }

  async removeMeasurement(itemId: string, measurementId: string) {
    const m = await this.prisma.boqMeasurement.findFirst({
      where: { id: measurementId, boqItemId: itemId },
    });
    if (!m) throw AppException.notFound('Measurement not found.');
    await this.prisma.boqMeasurement.delete({ where: { id: measurementId } });
    return { id: measurementId };
  }

  /** "Record progress": several items on one date, all or nothing. */
  async recordProgress(projectId: string, body: ProgressRecord) {
    await requireProject(this.prisma, projectId);
    return this.prisma.$transaction(
      async (tx) => {
        const items = await tx.boqItem.findMany({
          where: { projectId, id: { in: body.items.map((i) => i.boqItemId) } },
          include: { measurements: true },
        });
        const byId = new Map(items.map((i) => [i.id, i]));
        const bad: { boqItemId: string; itemNo: string }[] = [];
        const warnings: { boqItemId: string; itemNo: string; warning: 'OVER_QUANTITY' }[] = [];
        body.items.forEach((entry, idx) => {
          const item = byId.get(entry.boqItemId);
          if (!item) throw fieldError(`items.${idx}.boqItemId`, 'NOT_FOUND');
          const others = item.measurements
            .filter((m) => toDay(m.date) !== body.date)
            .map((m) => ({ date: toDay(m.date), cumulativeQty: m.cumulativeQty.toString() }));
          if (checkMeasurement(others, body.date, entry.cumulativeQty)) {
            bad.push({ boqItemId: item.id, itemNo: item.itemNo });
          }
          for (const w of measurementWarnings(item.quantity.toString(), entry.cumulativeQty)) {
            warnings.push({ boqItemId: item.id, itemNo: item.itemNo, warning: w });
          }
        });
        if (bad.length) throw outOfOrder({ items: bad });
        for (const entry of body.items) {
          await tx.boqMeasurement.upsert({
            where: { boqItemId_date: { boqItemId: entry.boqItemId, date: dayToDate(body.date) } },
            create: {
              boqItemId: entry.boqItemId,
              date: dayToDate(body.date),
              cumulativeQty: entry.cumulativeQty,
              notes: body.notes ?? null,
            },
            update: { cumulativeQty: entry.cumulativeQty, notes: body.notes ?? null },
          });
        }
        return { saved: body.items.length, warnings };
      },
      { timeout: 30_000 },
    );
  }

  /** The BOQ with measurements in the shape the calculators use (null when there is no BOQ). */
  async boqForCalc(db: Db, projectId: string): Promise<BoqItemLike[] | null> {
    const items = await db.boqItem.findMany({
      where: { projectId },
      include: {
        measurements: { select: { date: true, cumulativeQty: true } },
        variation: { select: { status: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { itemNo: 'asc' }],
    });
    if (!items.length) return null;
    return items.map((it) => ({
      id: it.id,
      itemNo: it.itemNo,
      description: it.description,
      unit: it.unit,
      quantity: it.quantity.toString(),
      rate: it.rate.toString(),
      excluded: Boolean(it.variation && it.variation.status !== 'APPROVED'),
      measurements: it.measurements.map((m) => ({
        date: toDay(m.date),
        cumulativeQty: m.cumulativeQty.toString(),
      })),
    }));
  }

  /** Progress as of a day (default today); null when the project has no BOQ. */
  async progressOf(db: Db, projectId: string, asOf: string): Promise<ProgressResult | null> {
    const items = await this.boqForCalc(db, projectId);
    return items ? calculateProgress(items, asOf) : null;
  }

  async progress(projectId: string, asOf?: string) {
    await requireProject(this.prisma, projectId);
    const day = asOf ?? todayInColombo();
    const r = (await this.progressOf(this.prisma, projectId, day)) ?? calculateProgress([], day);
    return { asOf: day, ...r };
  }

  // ── Variations ────────────────────────────────────────────────────────
  async variations(projectId: string) {
    await requireProject(this.prisma, projectId);
    const rows = await this.prisma.variation.findMany({
      where: { projectId },
      include: { _count: { select: { boqItems: true } } },
      orderBy: { number: 'asc' },
    });
    return rows.map(({ _count, ...v }) => ({ ...v, boqItemCount: _count.boqItems }));
  }

  async createVariation(projectId: string, data: VariationCreate) {
    await requireProject(this.prisma, projectId);
    const max = await this.prisma.variation.aggregate({
      where: { projectId },
      _max: { number: true },
    });
    const v = await this.prisma.variation.create({
      data: {
        projectId,
        number: (max._max.number ?? 0) + 1,
        title: data.title,
        date: dayToDate(data.date),
        status: data.status ?? 'PENDING',
        amountChange: data.amountChange,
        notes: data.notes ?? null,
      },
    });
    return { ...v, boqItemCount: 0 };
  }

  private async variation(projectId: string, id: string) {
    await requireProject(this.prisma, projectId);
    const v = await this.prisma.variation.findFirst({
      where: { id, projectId },
      include: { _count: { select: { boqItems: true } } },
    });
    if (!v) throw AppException.notFound('Variation not found.');
    return v;
  }

  async updateVariation(projectId: string, id: string, data: VariationUpdate) {
    await this.variation(projectId, id);
    const v = await this.prisma.variation.update({
      where: { id },
      data: definedOnly({
        ...data,
        date: data.date ? dayToDate(data.date) : undefined,
      }) as Prisma.VariationUncheckedUpdateInput,
      include: { _count: { select: { boqItems: true } } },
    });
    const { _count, ...rest } = v;
    return { ...rest, boqItemCount: _count.boqItems };
  }

  async removeVariation(projectId: string, id: string) {
    const v = await this.variation(projectId, id);
    if (v._count.boqItems) {
      throw AppException.conflict(
        'CONFLICT',
        'This variation has BOQ items. Remove or move them first.',
      );
    }
    await this.prisma.variation.delete({ where: { id } });
    return { id };
  }

  // ── Extensions of time ────────────────────────────────────────────────
  async extensions(projectId: string) {
    await requireProject(this.prisma, projectId);
    return this.prisma.extensionOfTime.findMany({
      where: { projectId },
      orderBy: [{ approvedDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** The latest approved EOT sets the project's revised end date (none → cleared). */
  private async syncRevisedEnd(tx: Db, projectId: string) {
    const latest = await tx.extensionOfTime.findFirst({
      where: { projectId },
      orderBy: [{ approvedDate: 'desc' }, { createdAt: 'desc' }],
    });
    await tx.project.update({
      where: { id: projectId },
      data: { revisedEndDate: latest?.newEndDate ?? null },
    });
  }

  async createExtension(projectId: string, data: EotCreate) {
    const project = await requireProject(this.prisma, projectId);
    if (data.newEndDate < toDay(project.startDate))
      throw fieldError('newEndDate', 'END_BEFORE_START');
    return this.prisma.$transaction(async (tx) => {
      const eot = await tx.extensionOfTime.create({
        data: {
          projectId,
          previousEndDate: project.revisedEndDate ?? project.plannedEndDate,
          newEndDate: dayToDate(data.newEndDate),
          approvedDate: dayToDate(data.approvedDate),
          reference: data.reference ?? null,
          reason: data.reason ?? null,
        },
      });
      await this.syncRevisedEnd(tx, projectId);
      return eot;
    });
  }

  async updateExtension(projectId: string, id: string, data: EotUpdate) {
    const project = await requireProject(this.prisma, projectId);
    const eot = await this.prisma.extensionOfTime.findFirst({ where: { id, projectId } });
    if (!eot) throw AppException.notFound('Extension not found.');
    if (data.newEndDate && data.newEndDate < toDay(project.startDate)) {
      throw fieldError('newEndDate', 'END_BEFORE_START');
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.extensionOfTime.update({
        where: { id },
        data: definedOnly({
          newEndDate: data.newEndDate ? dayToDate(data.newEndDate) : undefined,
          approvedDate: data.approvedDate ? dayToDate(data.approvedDate) : undefined,
          reference: data.reference,
          reason: data.reason,
        }) as Prisma.ExtensionOfTimeUncheckedUpdateInput,
      });
      await this.syncRevisedEnd(tx, projectId);
      return row;
    });
  }

  async removeExtension(projectId: string, id: string) {
    await requireProject(this.prisma, projectId);
    const eot = await this.prisma.extensionOfTime.findFirst({ where: { id, projectId } });
    if (!eot) throw AppException.notFound('Extension not found.');
    await this.prisma.$transaction(async (tx) => {
      await tx.extensionOfTime.delete({ where: { id } });
      await this.syncRevisedEnd(tx, projectId);
    });
    return { id };
  }
}
