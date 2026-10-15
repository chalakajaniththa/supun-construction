import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  type AllocationListQuery,
  type AllocationUpdate,
  type AssetAllocationCreate,
  type AvailabilityQuery,
  type WorkerAllocationCreate,
  allocationListQuerySchema,
  allocationUpdateSchema,
  assetAllocationCreateSchema,
  availabilityQuerySchema,
  workerAllocationCreateSchema,
} from '@sc/shared';
import { AuditAction, AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { AllocationsService } from './allocations.service.js';

@Controller('allocations')
@AuditEntity('Allocation')
export class AllocationsController {
  constructor(private readonly allocations: AllocationsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(allocationListQuerySchema)) q: AllocationListQuery) {
    return this.allocations.list(q);
  }

  @Get('availability')
  availability(@Query(new ZodValidationPipe(availabilityQuerySchema)) q: AvailabilityQuery) {
    return this.allocations.availability(q);
  }

  @Post('workers')
  @AuditEntity('WorkerAllocation')
  createWorkers(
    @Body(new ZodValidationPipe(workerAllocationCreateSchema)) body: WorkerAllocationCreate,
  ) {
    return this.allocations.createWorkers(body);
  }

  @Post('assets')
  @AuditEntity('AssetAllocation')
  createAssets(
    @Body(new ZodValidationPipe(assetAllocationCreateSchema)) body: AssetAllocationCreate,
  ) {
    return this.allocations.createAssets(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(allocationUpdateSchema)) body: AllocationUpdate,
  ) {
    return this.allocations.update(id, body);
  }

  @Post(':id/cancel')
  @AuditAction('UPDATE')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.allocations.cancel(id);
  }
}
