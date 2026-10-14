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
  type AssetCreate,
  type AssetListQuery,
  type AssetUpdate,
  assetCreateSchema,
  assetListQuerySchema,
  assetUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { AssetsService } from './assets.service.js';

@Controller('assets')
@AuditEntity('Asset')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(assetListQuerySchema)) q: AssetListQuery) {
    return this.assets.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.assets.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(assetCreateSchema)) body: AssetCreate) {
    return this.assets.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assetUpdateSchema)) body: AssetUpdate,
  ) {
    return this.assets.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assets.remove(id);
  }
}
