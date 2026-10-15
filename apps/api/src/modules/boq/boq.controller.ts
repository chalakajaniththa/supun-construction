import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  type BoqImport,
  type BoqItemCreate,
  type BoqItemUpdate,
  type EotCreate,
  type EotUpdate,
  type MeasurementCreate,
  type ProgressQuery,
  type ProgressRecord,
  type VariationCreate,
  type VariationUpdate,
  boqImportSchema,
  boqItemCreateSchema,
  boqItemUpdateSchema,
  eotCreateSchema,
  eotUpdateSchema,
  measurementCreateSchema,
  progressQuerySchema,
  progressRecordSchema,
  variationCreateSchema,
  variationUpdateSchema,
} from '@sc/shared';
import type { Request } from 'express';
import { AuditEntity, SkipAudit } from '../../common/audit/audit.decorator.js';
import { readSmallFile } from '../../common/upload/read-small-file.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { BoqService } from './boq.service.js';

/** Largest BOQ import file. */
const IMPORT_MAX_BYTES = 5 * 1_048_576;

/** BOQ items, import, measurements and progress (Step 4). */
@Controller()
@AuditEntity('BoqItem')
export class BoqController {
  constructor(private readonly boq: BoqService) {}

  @Get('projects/:id/boq')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.boq.list(id);
  }

  @Post('projects/:id/boq')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(boqItemCreateSchema)) body: BoqItemCreate,
  ) {
    return this.boq.create(id, body);
  }

  /** Multipart (field `file`): a CSV or .xlsx file → preview rows with validation codes. */
  @Post('projects/:id/boq/import/preview')
  @SkipAudit()
  async importPreview(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const file = await readSmallFile(req, IMPORT_MAX_BYTES);
    return this.boq.importPreview(id, file);
  }

  @Post('projects/:id/boq/import')
  importRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(boqImportSchema)) body: BoqImport,
  ) {
    return this.boq.importRows(id, body);
  }

  @Patch('projects/:id/boq/:itemId')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(boqItemUpdateSchema)) body: BoqItemUpdate,
  ) {
    return this.boq.update(id, itemId, body);
  }

  @Delete('projects/:id/boq/:itemId')
  remove(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.boq.remove(id, itemId);
  }

  @Get('boq/:itemId/measurements')
  measurements(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.boq.measurements(itemId);
  }

  @Post('boq/:itemId/measurements')
  @AuditEntity('BoqMeasurement')
  addMeasurement(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(measurementCreateSchema)) body: MeasurementCreate,
  ) {
    return this.boq.addMeasurement(itemId, body);
  }

  @Delete('boq/:itemId/measurements/:measurementId')
  @AuditEntity('BoqMeasurement')
  removeMeasurement(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('measurementId', ParseUUIDPipe) measurementId: string,
  ) {
    return this.boq.removeMeasurement(itemId, measurementId);
  }

  @Get('projects/:id/progress')
  progress(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(progressQuerySchema)) q: ProgressQuery,
  ) {
    return this.boq.progress(id, q.asOf);
  }

  @Post('projects/:id/progress')
  @AuditEntity('BoqMeasurement')
  recordProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(progressRecordSchema)) body: ProgressRecord,
  ) {
    return this.boq.recordProgress(id, body);
  }
}

/** Variations and extensions of time. */
@Controller('projects/:id')
export class VariationsController {
  constructor(private readonly boq: BoqService) {}

  @Get('variations')
  variations(@Param('id', ParseUUIDPipe) id: string) {
    return this.boq.variations(id);
  }

  @Post('variations')
  @AuditEntity('Variation')
  createVariation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(variationCreateSchema)) body: VariationCreate,
  ) {
    return this.boq.createVariation(id, body);
  }

  @Patch('variations/:variationId')
  @AuditEntity('Variation')
  updateVariation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variationId', ParseUUIDPipe) variationId: string,
    @Body(new ZodValidationPipe(variationUpdateSchema)) body: VariationUpdate,
  ) {
    return this.boq.updateVariation(id, variationId, body);
  }

  @Delete('variations/:variationId')
  @AuditEntity('Variation')
  removeVariation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variationId', ParseUUIDPipe) variationId: string,
  ) {
    return this.boq.removeVariation(id, variationId);
  }

  @Get('extensions')
  extensions(@Param('id', ParseUUIDPipe) id: string) {
    return this.boq.extensions(id);
  }

  @Post('extensions')
  @AuditEntity('ExtensionOfTime')
  createExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(eotCreateSchema)) body: EotCreate,
  ) {
    return this.boq.createExtension(id, body);
  }

  @Patch('extensions/:eotId')
  @AuditEntity('ExtensionOfTime')
  updateExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eotId', ParseUUIDPipe) eotId: string,
    @Body(new ZodValidationPipe(eotUpdateSchema)) body: EotUpdate,
  ) {
    return this.boq.updateExtension(id, eotId, body);
  }

  @Delete('extensions/:eotId')
  @AuditEntity('ExtensionOfTime')
  removeExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eotId', ParseUUIDPipe) eotId: string,
  ) {
    return this.boq.removeExtension(id, eotId);
  }
}
