import { DEFAULT_SETTINGS, SETTING_KEYS } from '@sc/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import { hashPassword } from '../modules/auth/auth.service.js';

export interface BaseSeedResult {
  adminCreated: boolean;
  /** Setting keys that did not exist and were created with defaults in this run. */
  createdSettings: string[];
}

/**
 * Idempotent base seed (runs on every container start):
 * - the admin user from ADMIN_USERNAME / ADMIN_PASSWORD, if missing
 * - every settings key with its default value, if missing
 */
export async function seedBase(
  prisma: PrismaClient,
  opts: { adminUsername: string; adminPassword: string },
): Promise<BaseSeedResult> {
  let adminCreated = false;
  const existing = await prisma.user.findUnique({ where: { username: opts.adminUsername } });
  if (!existing) {
    await prisma.user.create({
      data: {
        username: opts.adminUsername,
        passwordHash: await hashPassword(opts.adminPassword),
        mustChangePassword: false,
        usingDefaultPassword: true,
      },
    });
    adminCreated = true;
  }

  const createdSettings: string[] = [];
  for (const key of SETTING_KEYS) {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (!row) {
      await prisma.setting.create({
        data: { key, value: JSON.parse(JSON.stringify(DEFAULT_SETTINGS[key])) },
      });
      createdSettings.push(key);
    }
  }
  return { adminCreated, createdSettings };
}
