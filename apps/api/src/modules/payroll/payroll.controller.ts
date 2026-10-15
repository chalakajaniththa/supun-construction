import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  type PayrollLineUpdate,
  type PayrollRunCreate,
  payrollLineUpdateSchema,
  payrollRunCreateSchema,
} from '@sc/shared';
import { z } from 'zod';
import { AuditAction, AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { PayrollService } from './payroll.service.js';

const runListQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

/** Monthly payroll runs (Step 4) and a worker's payslips. */
@Controller()
@AuditEntity('PayrollRun')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('payroll/runs')
  list(@Query(new ZodValidationPipe(runListQuery)) q: z.infer<typeof runListQuery>) {
    return this.payroll.list(q);
  }

  /** Creates the month's draft, or regenerates it. */
  @Post('payroll/runs')
  generate(@Body(new ZodValidationPipe(payrollRunCreateSchema)) body: PayrollRunCreate) {
    return this.payroll.generate(body);
  }

  @Get('payroll/runs/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.get(id);
  }

  @Patch('payroll/runs/:id/lines/:lineId')
  @AuditEntity('PayrollLine')
  updateLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body(new ZodValidationPipe(payrollLineUpdateSchema)) body: PayrollLineUpdate,
  ) {
    return this.payroll.updateLine(id, lineId, body);
  }

  @Post('payroll/runs/:id/finalize')
  @AuditAction('UPDATE')
  finalize(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.finalize(id);
  }

  @Post('payroll/runs/:id/reopen')
  @AuditAction('UPDATE')
  reopen(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.reopen(id);
  }

  @Get('workers/:id/payslips')
  payslips(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.payslips(id);
  }
}
