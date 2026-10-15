import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  type BudgetUpdate,
  type CostQuery,
  costQuerySchema,
  type ProjectCreate,
  type ProjectListQuery,
  type ProjectUpdate,
  budgetUpdateSchema,
  projectCreateSchema,
  projectListQuerySchema,
  projectUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { CostingService } from '../costing/costing.service.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@AuditEntity('Project')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly costing: CostingService,
  ) {}

  @Get()
  list(@Query(new ZodValidationPipe(projectListQuerySchema)) q: ProjectListQuery) {
    return this.projects.list(q);
  }

  /** Health of every active project (dashboard). Declared before :id. */
  @Get('health')
  allHealth() {
    return this.costing.allHealth();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(projectCreateSchema)) body: ProjectCreate) {
    return this.projects.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(projectUpdateSchema)) body: ProjectUpdate,
  ) {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(id);
  }

  @Get(':id/costs')
  costs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(costQuerySchema)) q: CostQuery,
  ) {
    return this.costing.costs(id, q);
  }

  @Get(':id/health')
  health(@Param('id', ParseUUIDPipe) id: string) {
    return this.costing.health(id);
  }

  @Get(':id/budget')
  getBudget(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.getBudget(id);
  }

  /** Upserts every budget line at once; categories left out are removed. */
  @Put(':id/budget')
  @AuditEntity('ProjectBudget')
  putBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(budgetUpdateSchema)) body: BudgetUpdate,
  ) {
    return this.projects.putBudget(id, body);
  }
}
