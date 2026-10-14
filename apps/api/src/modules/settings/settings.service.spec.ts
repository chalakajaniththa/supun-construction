import { DEFAULT_SETTINGS } from '@sc/shared';
import { describe, expect, it } from 'vitest';
import { isSettingKey, resolveSetting } from './settings.service.js';

describe('resolveSetting', () => {
  it('returns defaults when nothing is stored', () => {
    expect(resolveSetting('payroll', undefined)).toEqual(DEFAULT_SETTINGS.payroll);
  });

  it('merges stored values over defaults (new keys get defaults)', () => {
    expect(resolveSetting('billing', { defaultRetentionPct: '5' })).toEqual({
      defaultRetentionPct: '5',
      defaultRetentionCapPct: '5',
    });
  });

  it('falls back to defaults when the stored value is invalid', () => {
    expect(resolveSetting('reminders', { daysBefore: 'nope' })).toEqual(DEFAULT_SETTINGS.reminders);
  });

  it('knows the valid keys', () => {
    expect(isSettingKey('company')).toBe(true);
    expect(isSettingKey('nope')).toBe(false);
  });
});
