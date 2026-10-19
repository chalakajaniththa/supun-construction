import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { type BackupRunsQuery, backupRunsQuerySchema } from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { BackupService } from './backup.service.js';

@Controller('backup')
@AuditEntity('BackupRequest')
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get('status')
  status() {
    return this.backup.status();
  }

  @Get('runs')
  runs(@Query(new ZodValidationPipe(backupRunsQuerySchema)) q: BackupRunsQuery) {
    return this.backup.runs(q);
  }

  /** Google Drive connection: status, and the sign-in started from Settings → Backup. */
  @Get('gdrive')
  gdrive() {
    return this.backup.gdrive();
  }

  @Post('gdrive/connect')
  @HttpCode(202)
  connect() {
    return this.backup.gdriveAction('CONNECT');
  }

  @Post('gdrive/cancel')
  @HttpCode(202)
  cancel() {
    return this.backup.gdriveAction('CANCEL');
  }

  @Post('gdrive/disconnect')
  @HttpCode(202)
  disconnect() {
    return this.backup.gdriveAction('DISCONNECT');
  }

  /** "Backup now" — 202: the backup container starts it within a few seconds. */
  @Post('run')
  @HttpCode(202)
  run() {
    return this.backup.request();
  }
}
