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
  type ExpenseCreate,
  type ExpenseListQuery,
  type ExpenseUpdate,
  expenseCreateSchema,
  expenseListQuerySchema,
  expenseUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { ExpensesService } from './expenses.service.js';

@Controller('expenses')
@AuditEntity('Expense')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(expenseListQuerySchema)) q: ExpenseListQuery) {
    return this.expenses.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.expenses.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(expenseCreateSchema)) body: ExpenseCreate) {
    return this.expenses.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(expenseUpdateSchema)) body: ExpenseUpdate,
  ) {
    return this.expenses.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.expenses.remove(id);
  }
}
