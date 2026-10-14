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
  type MaterialCreate,
  type MaterialListQuery,
  type MaterialUpdate,
  materialCreateSchema,
  materialListQuerySchema,
  materialUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { MaterialsService } from './materials.service.js';

@Controller('materials')
@AuditEntity('Material')
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(materialListQuerySchema)) q: MaterialListQuery) {
    return this.materials.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.materials.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(materialCreateSchema)) body: MaterialCreate) {
    return this.materials.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(materialUpdateSchema)) body: MaterialUpdate,
  ) {
    return this.materials.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.materials.remove(id);
  }
}
