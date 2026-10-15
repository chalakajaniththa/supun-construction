import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type DocumentListQuery,
  type DocumentOwnerType,
  type DocumentUpdate,
  type Paginated,
  dayToDate,
  documentCreateSchema,
  documentVersionCreateSchema,
  previewKind,
} from '@sc/shared';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { addDays, todayInColombo } from '../../common/dates/dates.js';
import { AppException } from '../../common/errors/app-exception.js';
import { paginated, toSkipTake } from '../../common/pagination/pagination.js';
import { definedOnly } from '../../common/pagination/search.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import type { Env } from '../../config/env.js';
import type { Document, DocumentVersion, Prisma } from '../../generated/prisma/client.js';
import {
  type ReceivedUpload,
  type StoredFile,
  contentDisposition,
  receiveUpload,
  safeFileName,
} from './multipart.js';

/** A version as returned by the API (the storage key stays internal). */
export type VersionView = Omit<DocumentVersion, 'storageKey' | 'createdAt' | 'updatedAt'>;

export type DocumentView = Omit<Document, 'deletedAt'> & {
  ownerName: string | null;
  ownerCode: string | null;
  currentVersion: VersionView | null;
  versionCount: number;
};

export type DocumentDetailView = DocumentView & { versions: VersionView[] };

const OWNER_TABLES: Record<Exclude<DocumentOwnerType, 'COMPANY'>, true> = {
  PROJECT: true,
  ASSET: true,
  WORKER: true,
  SUPPLIER: true,
  CLIENT: true,
};

export function storageKeyFor(documentId: string, versionNo: number, fileName: string): string {
  return `documents/${documentId}/v${versionNo}-${randomUUID()}-${safeFileName(fileName)}`;
}

function toVersionView(v: DocumentVersion): VersionView {
  const { storageKey: _k, createdAt: _c, updatedAt: _u, ...rest } = v;
  return rest;
}

function validationError(issues: z.core.$ZodIssue[]): AppException {
  return AppException.badRequest(
    'VALIDATION_FAILED',
    'Some values are not valid.',
    issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code })),
  );
}

const withCurrent = {
  currentVersion: true,
  _count: { select: { versions: true } },
} satisfies Prisma.DocumentInclude;

type DocRow = Prisma.DocumentGetPayload<{ include: typeof withCurrent }>;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: ConfigService<Env, true>,
  ) {
    this.maxBytes = config.get('MAX_UPLOAD_MB', { infer: true }) * 1024 * 1024;
  }

  // ── Reading ─────────────────────────────────────────────────────────────

  async list(q: DocumentListQuery): Promise<Paginated<DocumentView>> {
    const and: Prisma.DocumentWhereInput[] = [{ deletedAt: null }];
    if (q.ownerType) and.push({ ownerType: q.ownerType });
    if (q.ownerId) and.push({ ownerId: q.ownerId });
    if (q.category) and.push({ category: q.category });
    if (q.expiring !== undefined) {
      and.push({
        currentVersion: { expiryDate: { lte: dayToDate(addDays(todayInColombo(), q.expiring)) } },
      });
    }
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      const ownerIds = await this.ownerIdsMatching(q.search);
      and.push({
        OR: [
          { title: contains },
          { description: contains },
          { currentVersion: { fileName: contains } },
          ...(ownerIds.length ? [{ ownerId: { in: ownerIds } }] : []),
        ],
      });
    }
    const where: Prisma.DocumentWhereInput = { AND: and };
    const orderBy: Prisma.DocumentOrderByWithRelationInput[] =
      q.expiring !== undefined
        ? [{ currentVersion: { expiryDate: 'asc' } }, { title: 'asc' }]
        : [{ updatedAt: 'desc' }];
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({ where, include: withCurrent, orderBy, ...toSkipTake(q) }),
      this.prisma.document.count({ where }),
    ]);
    return paginated(await this.withOwners(rows), total, q);
  }

  /**
   * Every non-deleted document whose current version expires on or before `until` (expired ones
   * included), soonest first — for reminders and the expiry report.
   */
  async expiringUntil(until: string): Promise<DocumentView[]> {
    const rows = await this.prisma.document.findMany({
      where: { deletedAt: null, currentVersion: { expiryDate: { lte: dayToDate(until) } } },
      include: withCurrent,
      orderBy: [{ currentVersion: { expiryDate: 'asc' } }, { title: 'asc' }],
    });
    return this.withOwners(rows);
  }

  async get(id: string): Promise<DocumentDetailView> {
    const row = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: { ...withCurrent, versions: { orderBy: { versionNo: 'desc' } } },
    });
    if (!row) throw AppException.notFound('Document not found.');
    const [view] = await this.withOwners([row]);
    return { ...view!, versions: row.versions.map(toVersionView) };
  }

  /** Ids of owners (any type) whose name / code matches a search text. */
  private async ownerIdsMatching(search: string): Promise<string[]> {
    const contains = { contains: search, mode: 'insensitive' as const };
    const [projects, assets, workers, suppliers, clients] = await Promise.all([
      this.prisma.project.findMany({
        where: { OR: [{ name: contains }, { code: contains }] },
        select: { id: true },
        take: 200,
      }),
      this.prisma.asset.findMany({
        where: { OR: [{ name: contains }, { code: contains }, { registrationNo: contains }] },
        select: { id: true },
        take: 200,
      }),
      this.prisma.worker.findMany({
        where: { OR: [{ fullName: contains }, { code: contains }, { nameSinhala: contains }] },
        select: { id: true },
        take: 200,
      }),
      this.prisma.supplier.findMany({
        where: { OR: [{ name: contains }, { code: contains }] },
        select: { id: true },
        take: 200,
      }),
      this.prisma.client.findMany({ where: { name: contains }, select: { id: true }, take: 200 }),
    ]);
    return [...projects, ...assets, ...workers, ...suppliers, ...clients].map((r) => r.id);
  }

  /** Adds ownerName / ownerCode (one query per owner type on the page). */
  private async withOwners(rows: DocRow[]): Promise<DocumentView[]> {
    const ids = (type: DocumentOwnerType) => [
      ...new Set(rows.filter((r) => r.ownerType === type && r.ownerId).map((r) => r.ownerId!)),
    ];
    const names = new Map<string, { name: string; code: string | null }>();
    const add = (list: { id: string; name: string; code?: string | null }[]) => {
      for (const o of list) names.set(o.id, { name: o.name, code: o.code ?? null });
    };
    const [projects, assets, workers, suppliers, clients] = await Promise.all([
      this.prisma.project.findMany({
        where: { id: { in: ids('PROJECT') } },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.asset.findMany({
        where: { id: { in: ids('ASSET') } },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.worker.findMany({
        where: { id: { in: ids('WORKER') } },
        select: { id: true, fullName: true, code: true },
      }),
      this.prisma.supplier.findMany({
        where: { id: { in: ids('SUPPLIER') } },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.client.findMany({
        where: { id: { in: ids('CLIENT') } },
        select: { id: true, name: true },
      }),
    ]);
    add(projects);
    add(assets);
    add(workers.map((w) => ({ id: w.id, name: w.fullName, code: w.code })));
    add(suppliers);
    add(clients);
    return rows.map(({ _count, currentVersion, deletedAt: _d, ...doc }) => {
      const owner = doc.ownerId ? names.get(doc.ownerId) : undefined;
      return {
        ...doc,
        ownerName: owner?.name ?? null,
        ownerCode: owner?.code ?? null,
        currentVersion: currentVersion ? toVersionView(currentVersion) : null,
        versionCount: _count.versions,
      };
    });
  }

  private async findVersion(documentId: string, versionId: string): Promise<DocumentVersion> {
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId, document: { deletedAt: null } },
    });
    if (!version) throw AppException.notFound('Document version not found.');
    return version;
  }

  // ── Uploads ─────────────────────────────────────────────────────────────

  private async receive(
    req: Request,
    documentId: string,
    versionNo: number,
  ): Promise<ReceivedUpload & { file: StoredFile }> {
    const upload = await receiveUpload(req, {
      storage: this.storage,
      maxBytes: this.maxBytes,
      makeKey: (fileName) => storageKeyFor(documentId, versionNo, fileName),
    });
    if (upload.problem || !upload.file) {
      if (upload.file) await this.discard(upload.file);
      const problem = upload.problem ?? 'FILE_REQUIRED';
      if (problem === 'FILE_TOO_LARGE') {
        throw new AppException(HttpStatus.PAYLOAD_TOO_LARGE, problem, 'The file is too big.', {
          maxMb: this.maxBytes / 1024 / 1024,
        });
      }
      throw AppException.badRequest(
        problem,
        problem === 'UNSUPPORTED_FILE_TYPE'
          ? 'This type of file is not allowed.'
          : 'Please choose a file.',
      );
    }
    return upload as ReceivedUpload & { file: StoredFile };
  }

  private async discard(file: StoredFile): Promise<void> {
    await this.storage.deleteObject(file.key).catch((err: unknown) => {
      this.logger.warn(`Could not remove unused upload ${file.key}: ${String(err)}`);
    });
  }

  private async assertOwner(ownerType: DocumentOwnerType, ownerId: string | null | undefined) {
    if (ownerType === 'COMPANY') return;
    if (!(ownerType in OWNER_TABLES) || !ownerId) throw this.ownerNotFound();
    const where = { id: ownerId, deletedAt: null };
    const found = await (async () => {
      switch (ownerType) {
        case 'PROJECT':
          return this.prisma.project.findFirst({ where, select: { id: true } });
        case 'ASSET':
          return this.prisma.asset.findFirst({ where, select: { id: true } });
        case 'WORKER':
          return this.prisma.worker.findFirst({ where, select: { id: true } });
        case 'SUPPLIER':
          return this.prisma.supplier.findFirst({ where, select: { id: true } });
        case 'CLIENT':
          return this.prisma.client.findFirst({ where, select: { id: true } });
      }
    })();
    if (!found) throw this.ownerNotFound();
  }

  private ownerNotFound(): AppException {
    return AppException.badRequest('OWNER_NOT_FOUND', 'The owner of this document was not found.', [
      { path: 'ownerId', message: 'NOT_FOUND', code: 'custom' },
    ]);
  }

  /** POST /documents — metadata + file → the document and its version 1. */
  async create(req: Request): Promise<DocumentDetailView> {
    const documentId = randomUUID();
    const { fields, file } = await this.receive(req, documentId, 1);
    try {
      const parsed = documentCreateSchema.safeParse(fields);
      if (!parsed.success) throw validationError(parsed.error.issues);
      const meta = parsed.data;
      await this.assertOwner(meta.ownerType, meta.ownerId);
      await this.prisma.$transaction(async (tx) => {
        await tx.document.create({
          data: {
            id: documentId,
            ownerType: meta.ownerType,
            ownerId: meta.ownerType === 'COMPANY' ? null : meta.ownerId,
            category: meta.category,
            title: meta.title,
            description: meta.description ?? null,
          },
        });
        const version = await tx.documentVersion.create({
          data: {
            documentId,
            versionNo: 1,
            storageKey: file.key,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            sha256: file.sha256,
            issueDate: dayToDate(meta.issueDate),
            expiryDate: dayToDate(meta.expiryDate),
            note: meta.note ?? null,
          },
        });
        await tx.document.update({
          where: { id: documentId },
          data: { currentVersionId: version.id },
        });
      });
    } catch (err) {
      await this.discard(file);
      throw err;
    }
    return this.get(documentId);
  }

  /** POST /documents/:id/versions — a new file becomes the current version (versionNo + 1). */
  async addVersion(id: string, req: Request): Promise<DocumentDetailView> {
    const doc = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!doc) {
      req.resume();
      throw AppException.notFound('Document not found.');
    }
    const versionNo = await this.nextVersionNo(id);
    const { fields, file } = await this.receive(req, id, versionNo);
    try {
      const parsed = documentVersionCreateSchema.safeParse(fields);
      if (!parsed.success) throw validationError(parsed.error.issues);
      const meta = parsed.data;
      await this.prisma.$transaction(async (tx) => {
        const version = await tx.documentVersion.create({
          data: {
            documentId: id,
            versionNo,
            storageKey: file.key,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            sha256: file.sha256,
            issueDate: dayToDate(meta.issueDate),
            expiryDate: dayToDate(meta.expiryDate),
            note: meta.note ?? null,
          },
        });
        await tx.document.update({ where: { id }, data: { currentVersionId: version.id } });
      });
    } catch (err) {
      await this.discard(file);
      throw err;
    }
    return this.get(id);
  }

  private async nextVersionNo(documentId: string): Promise<number> {
    const agg = await this.prisma.documentVersion.aggregate({
      where: { documentId },
      _max: { versionNo: true },
    });
    return (agg._max.versionNo ?? 0) + 1;
  }

  async update(id: string, data: DocumentUpdate): Promise<DocumentDetailView> {
    await this.get(id);
    await this.prisma.document.update({ where: { id }, data: definedOnly(data) });
    return this.get(id);
  }

  /** Copies an old version forward as a new current version. History is never rewritten. */
  async restore(id: string, versionId: string): Promise<DocumentDetailView> {
    const old = await this.findVersion(id, versionId);
    const versionNo = await this.nextVersionNo(id);
    const key = storageKeyFor(id, versionNo, old.fileName);
    await this.storage.copyObject(old.storageKey, key);
    try {
      await this.prisma.$transaction(async (tx) => {
        const version = await tx.documentVersion.create({
          data: {
            documentId: id,
            versionNo,
            storageKey: key,
            fileName: old.fileName,
            mimeType: old.mimeType,
            sizeBytes: old.sizeBytes,
            sha256: old.sha256,
            issueDate: old.issueDate,
            expiryDate: old.expiryDate,
            note: old.note,
            restoredFromVersionNo: old.versionNo,
          },
        });
        await tx.document.update({ where: { id }, data: { currentVersionId: version.id } });
      });
    } catch (err) {
      await this.storage.deleteObject(key).catch(() => undefined);
      throw err;
    }
    return this.get(id);
  }

  /** Soft delete; the files stay in storage (and in backups). */
  async remove(id: string): Promise<{ id: string }> {
    await this.get(id);
    await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  // ── Downloads ───────────────────────────────────────────────────────────

  async download(
    id: string,
    versionId: string | null,
    inline: boolean,
    res: Response,
  ): Promise<void> {
    let version: DocumentVersion;
    if (versionId) {
      version = await this.findVersion(id, versionId);
    } else {
      const doc = await this.prisma.document.findFirst({
        where: { id, deletedAt: null },
        include: { currentVersion: true },
      });
      if (!doc?.currentVersion) throw AppException.notFound('Document not found.');
      version = doc.currentVersion;
    }
    const { stream, info } = await this.storage.getObjectStream(version.storageKey);
    const showInline = inline && previewKind(version.mimeType) !== null;
    res.status(200);
    res.setHeader('Content-Type', version.mimeType);
    res.setHeader('Content-Length', String(info.size || version.sizeBytes));
    res.setHeader('Content-Disposition', contentDisposition(version.fileName, showInline));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader('ETag', `"${version.sha256}"`);
    await pipeline(stream, res);
  }
}
