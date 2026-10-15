import { NOTIFICATION_TITLE_KEYS, notificationValues } from '@sc/shared';
import { describe, expect, it } from 'vitest';
import { testTranslator } from '../../modules/reports/test-translator.js';
import { I18nService, createTranslator } from './i18n.service.js';

describe('createTranslator', () => {
  const t = createTranslator('si', {
    en: {
      a: { b: 'Hello {name}' },
      only: 'English only',
      n: '{days, plural, =0 {today} other {in # days}}',
    },
    si: { a: { b: 'ආයුබෝවන් {name}' } },
  });

  it('formats ICU messages and falls back to English, then the key', () => {
    expect(t('a.b', { name: 'Supun' })).toBe('ආයුබෝවන් Supun');
    expect(t('only')).toBe('English only');
    expect(t('n', { days: 0 })).toBe('today');
    expect(t('n', { days: 5 })).toBe('in 5 days');
    expect(t('missing.key')).toBe('missing.key');
    expect(t.has('only')).toBe(true);
    expect(t.has('nope')).toBe(false);
  });

  it('picks the locale from the query, then the cookie', () => {
    expect(I18nService.pickLocale('si', 'en')).toBe('si');
    expect(I18nService.pickLocale(undefined, 'si')).toBe('si');
    expect(I18nService.pickLocale('xx', undefined)).toBe('en');
  });
});

describe('notification sentences (real message files)', () => {
  it.each(['en', 'si'] as const)('every title key renders in %s', (locale) => {
    const t = testTranslator(locale);
    const values = notificationValues(
      {
        params: {
          category: 'INSURANCE',
          ownerType: 'ASSET',
          ownerName: 'JCB 1',
          ownerCode: 'AST-001',
          bondType: 'PERFORMANCE_BOND',
          referenceNo: 'PB-1',
          projectName: 'Road',
          projectCode: 'PRJ-2026-001',
          assetName: 'JCB 1',
          assetCode: 'AST-001',
          meterType: 'HOURS',
          dueAt: '1250.000',
        },
        dueDate: '2026-10-20',
      },
      '2026-10-15',
      {
        enumLabel: (n, v) => t(`enums.${n}.${v}`),
        company: t('notifications.company'),
        unit: (m) => t(`notifications.units.${m}`),
      },
    );
    for (const key of NOTIFICATION_TITLE_KEYS) {
      const s = t(`notifications.titles.${key}`, values);
      expect(s).not.toContain('{');
      expect(s.length).toBeGreaterThan(5);
    }
    expect(t.missing).toEqual(new Set());
    if (locale === 'en') {
      expect(t('notifications.titles.documentExpires', values)).toBe(
        'Insurance of JCB 1 (AST-001) expires in 5 days',
      );
      expect(t('notifications.titles.serviceDue', values)).toBe(
        'JCB 1 (AST-001) is due for a service at 1250 hours',
      );
    }
  });
});
