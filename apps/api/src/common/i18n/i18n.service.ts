import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntlMessageFormat } from 'intl-messageformat';
import type { Env } from '../../config/env.js';

export const LOCALES = ['en', 'si'] as const;
export type Locale = (typeof LOCALES)[number];

export type TranslateValues = Record<string, string | number | null | undefined>;
/** t('reports.r1.title', { code }) → the text in one locale (falls back to English, then the key). */
export type Translator = ((key: string, values?: TranslateValues) => string) & {
  locale: Locale;
  has: (key: string) => boolean;
};

type Messages = Record<string, unknown>;

/**
 * The API uses the web's message files (apps/web/messages/*.json) so report labels, reminder
 * sentences and e-mails read exactly like the screens. In Docker the files are copied to
 * /app/messages (see docker/api.Dockerfile).
 */
export function resolveMessagesDir(configured?: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    configured,
    join(process.cwd(), 'messages'),
    join(process.cwd(), '..', 'web', 'messages'),
    // src/common/i18n or dist/common/i18n → apps/web/messages
    resolve(here, '..', '..', '..', '..', 'web', 'messages'),
  ].filter((c): c is string => Boolean(c));
  const found = candidates.find((c) => existsSync(join(c, 'en.json')));
  if (!found) throw new Error(`Message files not found (looked in: ${candidates.join(', ')})`);
  return found;
}

function lookup(messages: Messages, key: string): string | undefined {
  let cur: unknown = messages;
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function createTranslator(locale: Locale, all: Record<Locale, Messages>): Translator {
  const cache = new Map<string, IntlMessageFormat>();
  const fn = (key: string, values?: TranslateValues) => {
    const own = lookup(all[locale], key);
    const msg = own ?? lookup(all.en, key);
    if (msg === undefined) return key;
    const useLocale = own !== undefined ? locale : 'en';
    const cacheKey = `${useLocale}:${key}`;
    let f = cache.get(cacheKey);
    if (!f) {
      f = new IntlMessageFormat(msg, useLocale === 'si' ? 'si-LK' : 'en-GB');
      cache.set(cacheKey, f);
    }
    const clean: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(values ?? {})) clean[k] = v ?? '';
    return String(f.format(clean));
  };
  return Object.assign(fn, {
    locale,
    has: (key: string) =>
      lookup(all[locale], key) !== undefined || lookup(all.en, key) !== undefined,
  });
}

@Injectable()
export class I18nService {
  private readonly messages: Record<Locale, Messages>;
  private readonly translators = new Map<Locale, Translator>();

  constructor(config: ConfigService<Env, true>) {
    const dir = resolveMessagesDir(config.get('MESSAGES_DIR', { infer: true }));
    this.messages = {
      en: JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8')) as Messages,
      si: JSON.parse(readFileSync(join(dir, 'si.json'), 'utf8')) as Messages,
    };
  }

  translator(locale: Locale): Translator {
    let t = this.translators.get(locale);
    if (!t) {
      t = createTranslator(locale, this.messages);
      this.translators.set(locale, t);
    }
    return t;
  }

  /** `?locale=` wins, then the NEXT_LOCALE cookie the web sets, then English. */
  static pickLocale(query?: string, cookie?: string): Locale {
    for (const v of [query, cookie]) if (v === 'en' || v === 'si') return v;
    return 'en';
  }
}
