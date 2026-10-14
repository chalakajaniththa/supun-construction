import { z } from 'zod';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_OWNER_TYPES,
  type DocumentCategory,
  type DocumentOwnerType,
} from '../enums';
import {
  enumField,
  isOnOrAfter,
  optionalDate,
  optionalText,
  optionalUuid,
  requiredText,
} from './common';
import { paginationQuerySchema } from './pagination';

// ── Files ───────────────────────────────────────────────────────────────
export const DEFAULT_MAX_UPLOAD_MB = 50;

/** Allowed upload types: extension → the Content-Type we store and serve. */
export const ALLOWED_FILE_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  dwg: 'image/vnd.dwg',
  dxf: 'image/vnd.dxf',
  zip: 'application/zip',
};

/** For the file picker's `accept` attribute. */
export const UPLOAD_ACCEPT = Object.keys(ALLOWED_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** The Content-Type for an allowed file name, or null when the type is not allowed. */
export function mimeTypeFor(fileName: string): string | null {
  return ALLOWED_FILE_TYPES[fileExtension(fileName)] ?? null;
}

/** Browsers can show these inline (preview dialog). */
export function previewKind(mimeType: string): 'pdf' | 'image' | null {
  if (mimeType === 'application/pdf') return 'pdf';
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return 'image';
  return null;
}

// ── Expiry ──────────────────────────────────────────────────────────────
export const EXPIRY_SOON_DAYS = 30;
export type ExpiryStatus = 'EXPIRED' | 'SOON' | 'OK';

/** Whole days from `today` to `expiry` (both "YYYY-MM-DD"); negative when already expired. */
export function daysUntil(expiry: string, today: string): number {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+expiry.slice(0, 4), +expiry.slice(5, 7) - 1, +expiry.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Red / orange / green badge: EXPIRED when the expiry day is before today, SOON within
 * `soonDays` days (inclusive), otherwise OK. No expiry → null.
 */
export function expiryStatus(
  expiry: string | null | undefined,
  today: string,
  soonDays = EXPIRY_SOON_DAYS,
): ExpiryStatus | null {
  if (!expiry) return null;
  const days = daysUntil(expiry.slice(0, 10), today);
  if (days < 0) return 'EXPIRED';
  if (days <= soonDays) return 'SOON';
  return 'OK';
}

// ── Category suggestions ────────────────────────────────────────────────
const VEHICLE_DOCS: DocumentCategory[] = [
  'REVENUE_LICENCE',
  'INSURANCE',
  'EMISSION_TEST',
  'FITNESS_CERTIFICATE',
  'REGISTRATION_BOOK',
];

/** Categories offered first in the upload dialog, by owner. The rest follow. */
export function suggestedDocumentCategories(
  ownerType: DocumentOwnerType,
  opts: { isVehicle?: boolean } = {},
): DocumentCategory[] {
  switch (ownerType) {
    case 'COMPANY':
      return ['CIDA_REGISTRATION', 'CERTIFICATE', 'INSURANCE', 'LETTER'];
    case 'PROJECT':
      return ['CONTRACT', 'PLAN_DRAWING', 'BOQ', 'ESTIMATE', 'LETTER', 'PHOTO', 'BOND_COPY'];
    case 'ASSET':
      return opts.isVehicle
        ? [...VEHICLE_DOCS, 'INVOICE', 'PHOTO']
        : ['INSURANCE', 'INVOICE', 'CERTIFICATE', 'PHOTO'];
    case 'WORKER':
      return ['NIC_COPY', 'CERTIFICATE', 'PHOTO', 'LETTER'];
    case 'SUPPLIER':
      return ['INVOICE', 'RECEIPT', 'LETTER', 'CERTIFICATE'];
    case 'CLIENT':
      return ['CONTRACT', 'LETTER', 'RECEIPT'];
  }
}

/** Suggested first, then every other category (each once). */
export function orderedDocumentCategories(
  ownerType: DocumentOwnerType,
  opts: { isVehicle?: boolean } = {},
): DocumentCategory[] {
  const first = suggestedDocumentCategories(ownerType, opts);
  return [...first, ...DOCUMENT_CATEGORIES.filter((c) => !first.includes(c))];
}

// ── Requests ────────────────────────────────────────────────────────────
const versionFields = {
  issueDate: optionalDate,
  expiryDate: optionalDate,
  note: optionalText(1000),
};

const refineExpiry = (
  v: { issueDate?: string | null; expiryDate?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (!isOnOrAfter(v.issueDate, v.expiryDate)) {
    ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'EXPIRY_BEFORE_ISSUE' });
  }
};

/** POST /documents (multipart fields; the file is the `file` part). */
export const documentCreateSchema = z
  .object({
    ownerType: enumField(DOCUMENT_OWNER_TYPES),
    ownerId: optionalUuid,
    category: enumField(DOCUMENT_CATEGORIES),
    title: requiredText(200),
    description: optionalText(2000),
    ...versionFields,
  })
  .superRefine((v, ctx) => {
    if (v.ownerType !== 'COMPANY' && !v.ownerId) {
      ctx.addIssue({ code: 'custom', path: ['ownerId'], message: 'REQUIRED' });
    }
    refineExpiry(v, ctx);
  });
export type DocumentCreateInput = z.input<typeof documentCreateSchema>;
export type DocumentCreate = z.output<typeof documentCreateSchema>;

/** POST /documents/:id/versions (multipart fields + `file`). */
export const documentVersionCreateSchema = z.object(versionFields).superRefine(refineExpiry);
export type DocumentVersionCreateInput = z.input<typeof documentVersionCreateSchema>;
export type DocumentVersionCreate = z.output<typeof documentVersionCreateSchema>;

export const documentUpdateSchema = z.object({
  title: requiredText(200).optional(),
  category: enumField(DOCUMENT_CATEGORIES).optional(),
  description: optionalText(2000),
});
export type DocumentUpdateInput = z.input<typeof documentUpdateSchema>;
export type DocumentUpdate = z.output<typeof documentUpdateSchema>;

export const documentListQuerySchema = paginationQuerySchema.extend({
  ownerType: z.enum(DOCUMENT_OWNER_TYPES).optional(),
  ownerId: z.uuid().optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  /** Current version expires within this many days (or has already expired). */
  expiring: z.coerce.number().int().min(0).max(3650).optional(),
});
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

export const downloadQuerySchema = z.object({
  inline: z.enum(['0', '1', 'true', 'false']).optional(),
});

// ── Responses ───────────────────────────────────────────────────────────
export interface DocumentVersionDto {
  id: string;
  documentId: string;
  versionNo: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  issueDate: string | null;
  expiryDate: string | null;
  note: string | null;
  /** Set when this version was made by restoring an older one. */
  restoredFromVersionNo: number | null;
  uploadedAt: string;
}

export interface DocumentDto {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string | null;
  /** Name / code of the owner, for lists across owners. */
  ownerName: string | null;
  ownerCode: string | null;
  category: DocumentCategory;
  title: string;
  description: string | null;
  currentVersionId: string | null;
  currentVersion: DocumentVersionDto | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetailDto extends DocumentDto {
  /** Newest first. */
  versions: DocumentVersionDto[];
}
