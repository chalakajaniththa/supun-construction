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
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@AuditEntity('Project')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(projectListQuerySchema)) q: ProjectListQuery) {
    return this.projects.list(q);
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
