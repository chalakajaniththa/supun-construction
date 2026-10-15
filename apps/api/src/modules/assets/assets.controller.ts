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
  type MaintenanceCreate,
  type MaintenanceUpdate,
  type UsageListQuery,
  assetCreateSchema,
  assetListQuerySchema,
  assetUpdateSchema,
  maintenanceCreateSchema,
  maintenanceUpdateSchema,
  usageListQuerySchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { AssetOpsService } from './asset-ops.service.js';
import { AssetsService } from './assets.service.js';

@Controller('assets')
@AuditEntity('Asset')
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly ops: AssetOpsService,
  ) {}

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

  @Get(':id/usage')
  usage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(usageListQuerySchema)) q: UsageListQuery,
  ) {
    return this.ops.usage(id, q);
  }

  @Get(':id/service-status')
  serviceStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.serviceStatus(id);
  }

  @Get(':id/maintenance')
  listMaintenance(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.listMaintenance(id);
  }

  @Post(':id/maintenance')
  @AuditEntity('MaintenanceRecord')
  createMaintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(maintenanceCreateSchema)) body: MaintenanceCreate,
  ) {
    return this.ops.createMaintenance(id, body);
  }

  @Patch(':id/maintenance/:recordId')
  @AuditEntity('MaintenanceRecord')
  updateMaintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body(new ZodValidationPipe(maintenanceUpdateSchema)) body: MaintenanceUpdate,
  ) {
    return this.ops.updateMaintenance(id, recordId, body);
  }

  @Delete(':id/maintenance/:recordId')
  @AuditEntity('MaintenanceRecord')
  removeMaintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ) {
    return this.ops.removeMaintenance(id, recordId);
  }
}
