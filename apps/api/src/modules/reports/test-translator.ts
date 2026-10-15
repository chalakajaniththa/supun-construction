import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Locale,
  type Translator,
  createTranslator,
  resolveMessagesDir,
} from '../../common/i18n/i18n.service.js';

/** The real message files, plus a list of keys a test asked for that do not exist. */
export function testTranslator(locale: Locale = 'en'): Translator & { missing: Set<string> } {
  const dir = resolveMessagesDir();
  const all = {
    en: JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8')) as Record<string, unknown>,
    si: JSON.parse(readFileSync(join(dir, 'si.json'), 'utf8')) as Record<string, unknown>,
  };
  const t = createTranslator(locale, all);
  const missing = new Set<string>();
  const wrapped = ((key: string, values?: Record<string, string | number | null | undefined>) => {
    if (!t.has(key)) missing.add(key);
    return t(key, values);
  }) as Translator & { missing: Set<string> };
  return Object.assign(wrapped, { locale, has: t.has, missing });
}
