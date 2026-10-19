import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { type ResetDataInput, resetDataSchema } from '@sc/shared';
import { AuditAction, AuditEntity } from '../../common/audit/audit.decorator.js';
import { CurrentUser, type SessionUser } from '../../common/auth/session-user.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@AuditEntity('Data')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /**
   * Body `{ mode: "SAMPLE" | "EMPTY", confirm: "RESET", password }` (the password is redacted in
   * the audit log). Takes up to a minute with the sample data (its files are uploaded again).
   */
  @Post('reset-data')
  @HttpCode(200)
  @AuditAction('DELETE')
  reset(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(resetDataSchema)) body: ResetDataInput,
  ) {
    return this.admin.resetData(user.id, body);
  }
}
