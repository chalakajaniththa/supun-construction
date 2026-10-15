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
} from '@nestjs/common';
import {
  type AdvanceCreate,
  type AdvanceListQuery,
  type AdvanceUpdate,
  advanceCreateSchema,
  advanceListQuerySchema,
  advanceUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { AdvancesService } from './advances.service.js';

/** Salary advances: GET /advances and /workers/:id/advances. */
@Controller()
@AuditEntity('Advance')
export class AdvancesController {
  constructor(private readonly advances: AdvancesService) {}

  @Get('advances')
  list(@Query(new ZodValidationPipe(advanceListQuerySchema)) q: AdvanceListQuery) {
    return this.advances.list(q);
  }

  @Get('workers/:id/advances')
  listForWorker(@Param('id', ParseUUIDPipe) id: string) {
    return this.advances.listForWorker(id);
  }

  @Post('workers/:id/advances')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(advanceCreateSchema)) body: AdvanceCreate,
  ) {
    return this.advances.create(id, body);
  }

  @Patch('workers/:id/advances/:advanceId')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('advanceId', ParseUUIDPipe) advanceId: string,
    @Body(new ZodValidationPipe(advanceUpdateSchema)) body: AdvanceUpdate,
  ) {
    return this.advances.update(id, advanceId, body);
  }

  @Delete('workers/:id/advances/:advanceId')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('advanceId', ParseUUIDPipe) advanceId: string,
  ) {
    return this.advances.remove(id, advanceId);
  }
}
