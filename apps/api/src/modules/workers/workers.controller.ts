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
  type WorkerCreate,
  type WorkerListQuery,
  type WorkerRateCreate,
  type WorkerUpdate,
  workerCreateSchema,
  workerListQuerySchema,
  workerRateCreateSchema,
  workerUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { WorkersService } from './workers.service.js';

@Controller('workers')
@AuditEntity('Worker')
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(workerListQuerySchema)) q: WorkerListQuery) {
    return this.workers.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.workers.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(workerCreateSchema)) body: WorkerCreate) {
    return this.workers.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(workerUpdateSchema)) body: WorkerUpdate,
  ) {
    return this.workers.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workers.remove(id);
  }

  @Get(':id/rates')
  listRates(@Param('id', ParseUUIDPipe) id: string) {
    return this.workers.listRates(id);
  }

  @Post(':id/rates')
  @AuditEntity('WorkerRate')
  addRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(workerRateCreateSchema)) body: WorkerRateCreate,
  ) {
    return this.workers.addRate(id, body);
  }

  @Delete(':id/rates/:rateId')
  @AuditEntity('WorkerRate')
  removeRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rateId', ParseUUIDPipe) rateId: string,
  ) {
    return this.workers.removeRate(id, rateId);
  }
}
