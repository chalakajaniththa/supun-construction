import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  type SettingKey,
  type SettingsMap,
  settingSchemas,
} from '@sc/shared';
import { AppException } from '../../common/errors/app-exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key);
}

/** Merges a stored value over the defaults; falls back to the defaults if it is invalid. */
export function resolveSetting<K extends SettingKey>(key: K, stored: unknown): SettingsMap[K] {
  const base = DEFAULT_SETTINGS[key];
  const merged =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...base, ...stored } : base;
  const parsed = settingSchemas[key].safeParse(merged);
  return (parsed.success ? parsed.data : base) as SettingsMap[K];
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<SettingsMap> {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      company: resolveSetting('company', byKey.get('company')),
      payroll: resolveSetting('payroll', byKey.get('payroll')),
      reminders: resolveSetting('reminders', byKey.get('reminders')),
      billing: resolveSetting('billing', byKey.get('billing')),
    };
  }

  async get<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return resolveSetting(key, row?.value);
  }

  /** Partial update: the body is merged over the current value, then the whole value is validated. */
  async patch(key: string, body: unknown): Promise<SettingsMap[SettingKey]> {
    if (!isSettingKey(key)) {
      throw new AppException(HttpStatus.NOT_FOUND, 'UNKNOWN_SETTING', `Unknown setting "${key}".`);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Body must be an object.',
      );
    }
    const current = await this.get(key);
    const result = settingSchemas[key].safeParse({ ...current, ...body });
    if (!result.success) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Some values are not valid.',
        result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      );
    }
    const value = JSON.parse(JSON.stringify(result.data));
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    return result.data;
  }
}
