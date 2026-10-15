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
  type BondCreate,
  type BondListQuery,
  type BondUpdate,
  bondCreateSchema,
  bondListQuerySchema,
  bondUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { BondsService } from './bonds.service.js';

@Controller()
@AuditEntity('Bond')
export class BondsController {
  constructor(private readonly bonds: BondsService) {}

  @Get('bonds')
  list(@Query(new ZodValidationPipe(bondListQuerySchema)) q: BondListQuery) {
    return this.bonds.list(q);
  }

  @Get('projects/:id/bonds')
  listForProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.bonds.listForProject(id);
  }

  @Post('projects/:id/bonds')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(bondCreateSchema)) body: BondCreate,
  ) {
    return this.bonds.create(id, body);
  }

  @Patch('projects/:id/bonds/:bondId')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bondId', ParseUUIDPipe) bondId: string,
    @Body(new ZodValidationPipe(bondUpdateSchema)) body: BondUpdate,
  ) {
    return this.bonds.update(id, bondId, body);
  }

  @Delete('projects/:id/bonds/:bondId')
  remove(@Param('id', ParseUUIDPipe) id: string, @Param('bondId', ParseUUIDPipe) bondId: string) {
    return this.bonds.remove(id, bondId);
  }
}
