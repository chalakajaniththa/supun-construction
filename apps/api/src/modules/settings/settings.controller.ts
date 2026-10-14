import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import type { SettingKey, SettingsMap } from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
@AuditEntity('Setting')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getAll(): Promise<SettingsMap> {
    return this.settings.getAll();
  }

  /** Body: the fields to change; validated per key with the shared zod schema. */
  @Patch(':key')
  patch(@Param('key') key: string, @Body() body: unknown): Promise<SettingsMap[SettingKey]> {
    return this.settings.patch(key, body);
  }
}
