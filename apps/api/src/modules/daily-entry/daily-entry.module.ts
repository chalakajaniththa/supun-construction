import { Module } from '@nestjs/common';
import { AttendanceController, DailyEntryController } from './daily-entry.controller.js';
import { DailyEntryService } from './daily-entry.service.js';

@Module({
  controllers: [DailyEntryController, AttendanceController],
  providers: [DailyEntryService],
})
export class DailyEntryModule {}
