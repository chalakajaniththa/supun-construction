import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { type ResetSampleDataInput, resetSampleDataSchema } from '@sc/shared';
import { AuditAction, AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@AuditEntity('SampleData')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Body `{ confirm: "RESET" }`. Takes up to a minute (the sample files are uploaded again). */
  @Post('reset-sample-data')
  @HttpCode(200)
  @AuditAction('DELETE')
  reset(@Body(new ZodValidationPipe(resetSampleDataSchema)) _body: ResetSampleDataInput) {
    return this.admin.resetSampleData();
  }
}
