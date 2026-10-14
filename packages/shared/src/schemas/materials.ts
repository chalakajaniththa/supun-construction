import { z } from 'zod';
import { MATERIAL_CATEGORIES, type MaterialCategory } from '../enums';
import { enumField, optionalText, requiredText } from './common';
import { paginationQuerySchema } from './pagination';

/** Units offered in the materials form (free text is still allowed). */
export const COMMON_UNITS = [
  'bag',
  'cube',
  'm³',
  'm²',
  'm',
  'kg',
  'ton',
  'nos',
  'l',
  'load',
] as const;

export const materialCreateSchema = z.object({
  name: requiredText(200),
  nameSinhala: optionalText(200),
  unit: requiredText(30),
  category: enumField(MATERIAL_CATEGORIES),
});
export type MaterialCreateInput = z.input<typeof materialCreateSchema>;
export type MaterialCreate = z.output<typeof materialCreateSchema>;
export const materialUpdateSchema = materialCreateSchema.partial();
export type MaterialUpdate = z.output<typeof materialUpdateSchema>;

export const materialListQuerySchema = paginationQuerySchema.extend({
  category: z.enum(MATERIAL_CATEGORIES).optional(),
});
export type MaterialListQuery = z.infer<typeof materialListQuerySchema>;

export interface MaterialDto {
  id: string;
  name: string;
  nameSinhala: string | null;
  unit: string;
  category: MaterialCategory;
  createdAt: string;
  updatedAt: string;
}
