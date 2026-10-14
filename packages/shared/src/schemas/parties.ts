import { z } from 'zod';
import { CLIENT_TYPES, SUPPLIER_TYPES, type ClientType, type SupplierType } from '../enums';
import { enumField, optionalEmail, optionalText, requiredText } from './common';
import { paginationQuerySchema } from './pagination';

// ── Clients ─────────────────────────────────────────────────────────────
export const clientCreateSchema = z.object({
  name: requiredText(200),
  type: enumField(CLIENT_TYPES),
  contactPerson: optionalText(200),
  phone: optionalText(50),
  email: optionalEmail,
  address: optionalText(500),
  notes: optionalText(2000),
});
export type ClientCreateInput = z.input<typeof clientCreateSchema>;
export type ClientCreate = z.output<typeof clientCreateSchema>;
export const clientUpdateSchema = clientCreateSchema.partial();
export type ClientUpdate = z.output<typeof clientUpdateSchema>;

export const clientListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(CLIENT_TYPES).optional(),
});
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;

export interface ClientDto {
  id: string;
  name: string;
  type: ClientType;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Number of (not deleted) projects of this client. */
  projectCount?: number;
}

// ── Suppliers ───────────────────────────────────────────────────────────
export const supplierCreateSchema = z.object({
  name: requiredText(200),
  type: enumField(SUPPLIER_TYPES),
  phone: optionalText(50),
  address: optionalText(500),
  notes: optionalText(2000),
});
export type SupplierCreateInput = z.input<typeof supplierCreateSchema>;
export type SupplierCreate = z.output<typeof supplierCreateSchema>;
export const supplierUpdateSchema = supplierCreateSchema.partial();
export type SupplierUpdate = z.output<typeof supplierUpdateSchema>;

export const supplierListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(SUPPLIER_TYPES).optional(),
});
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;

export interface SupplierDto {
  id: string;
  code: string;
  name: string;
  type: SupplierType;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
