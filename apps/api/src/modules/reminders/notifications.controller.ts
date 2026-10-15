import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { type NotificationListQuery, notificationListQuerySchema } from '@sc/shared';
import { AuditEntity, SkipAudit } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { NotificationsService } from './notifications.service.js';
import { ReminderScanner } from './reminder-scanner.service.js';

@Controller()
@AuditEntity('Notification')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly scanner: ReminderScanner,
  ) {}

  @Get('notifications')
  list(@Query(new ZodValidationPipe(notificationListQuerySchema)) q: NotificationListQuery) {
    return this.notifications.list(q);
  }

  @Get('notifications/count')
  count() {
    return this.notifications.count();
  }

  // Reading a reminder is not a business change: not audited.
  @Post('notifications/read-all')
  @HttpCode(200)
  @SkipAudit()
  readAll() {
    return this.notifications.markAllRead();
  }

  @Post('notifications/:id/read')
  @HttpCode(200)
  @SkipAudit()
  read(@Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(id);
  }

  @Post('reminders/run')
  @HttpCode(200)
  @SkipAudit()
  run() {
    return this.scanner.run();
  }
}
