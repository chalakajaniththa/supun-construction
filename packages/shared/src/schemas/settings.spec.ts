import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTING_KEYS, settingSchemas } from './settings';
import { changePasswordSchema } from './auth';

describe('settings schemas', () => {
  it.each(SETTING_KEYS)('default %s settings are valid', (key) => {
    expect(settingSchemas[key].safeParse(DEFAULT_SETTINGS[key]).success).toBe(true);
  });

  it('reminder days are de-duplicated and sorted descending', () => {
    expect(settingSchemas.reminders.parse({ daysBefore: [7, 30, 7, 14] }).daysBefore).toEqual([
      30, 14, 7,
    ]);
  });

  it('company name is required', () => {
    expect(
      settingSchemas.company.safeParse({ ...DEFAULT_SETTINGS.company, name: ' ' }).success,
    ).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('requires matching confirmation', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'old-pass',
      newPassword: 'new-password',
      confirmPassword: 'other-password',
    });
    expect(r.success).toBe(false);
  });
});
