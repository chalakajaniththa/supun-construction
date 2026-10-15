import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DocumentsModule } from '../documents/documents.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { DigestService } from './digest.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { ReminderScanner } from './reminder-scanner.service.js';
import { ReminderTriggerInterceptor } from './reminder-trigger.interceptor.js';

@Module({
  imports: [SettingsModule, DocumentsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ReminderScanner,
    DigestService,
    { provide: APP_INTERCEPTOR, useClass: ReminderTriggerInterceptor },
  ],
  exports: [NotificationsService, ReminderScanner],
})
export class RemindersModule {}
