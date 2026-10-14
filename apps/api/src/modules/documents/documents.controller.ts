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
  Res,
} from '@nestjs/common';
import {
  type DocumentListQuery,
  type DocumentUpdate,
  documentListQuerySchema,
  documentUpdateSchema,
  downloadQuerySchema,
} from '@sc/shared';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { DocumentsService } from './documents.service.js';

const isInline = (q: z.infer<typeof downloadQuerySchema>) =>
  q.inline === '1' || q.inline === 'true';

@Controller('documents')
@AuditEntity('Document')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** ?ownerType=&ownerId=&category=&search=&expiring=30 — each item includes its current version. */
  @Get()
  list(@Query(new ZodValidationPipe(documentListQuerySchema)) q: DocumentListQuery) {
    return this.documents.list(q);
  }

  /** Multipart: ownerType, ownerId, category, title, description, issueDate, expiryDate, note + file. */
  @Post()
  create(@Req() req: Request) {
    return this.documents.create(req);
  }

  /** With every version, newest first. */
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(documentUpdateSchema)) body: DocumentUpdate,
  ) {
    return this.documents.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.remove(id);
  }

  /** Multipart: file + note, issueDate, expiryDate → becomes the current version. */
  @Post(':id/versions')
  addVersion(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.documents.addVersion(id, req);
  }

  @Post(':id/versions/:versionId/restore')
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.documents.restore(id, versionId);
  }

  /** The current version's file (e.g. for a logo or photo). `?inline=1` to show it in the browser. */
  @Get(':id/download')
  downloadCurrent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(downloadQuerySchema)) q: z.infer<typeof downloadQuerySchema>,
    @Res() res: Response,
  ) {
    return this.documents.download(id, null, isInline(q), res);
  }

  @Get(':id/versions/:versionId/download')
  download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Query(new ZodValidationPipe(downloadQuerySchema)) q: z.infer<typeof downloadQuerySchema>,
    @Res() res: Response,
  ) {
    return this.documents.download(id, versionId, isInline(q), res);
  }
}
