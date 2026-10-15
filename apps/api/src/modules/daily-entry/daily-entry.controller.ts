import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import {
  type AttendanceQuery,
  type DailyEntryQuery,
  type DailyEntrySave,
  attendanceQuerySchema,
  dailyEntryQuerySchema,
  dailyEntrySaveSchema,
} from '@sc/shared';
import { AuditAction, AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { DailyEntryService } from './daily-entry.service.js';

@Controller('daily-entry')
@AuditEntity('DailyEntry')
export class DailyEntryController {
  constructor(private readonly daily: DailyEntryService) {}

  @Get()
  get(@Query(new ZodValidationPipe(dailyEntryQuerySchema)) q: DailyEntryQuery) {
    return this.daily.get(q);
  }

  @Get('copy-from')
  copyFrom(@Query(new ZodValidationPipe(dailyEntryQuerySchema)) q: DailyEntryQuery) {
    return this.daily.copyFrom(q);
  }

  @Put()
  @AuditAction('UPDATE')
  save(@Body(new ZodValidationPipe(dailyEntrySaveSchema)) body: DailyEntrySave) {
    return this.daily.save(body);
  }
}

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly daily: DailyEntryService) {}

  @Get()
  list(@Query(new ZodValidationPipe(attendanceQuerySchema)) q: AttendanceQuery) {
    return this.daily.attendance(q);
  }
}
