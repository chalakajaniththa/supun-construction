'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, type Locale, isLocale } from './config';

/** Remembers the UI language in a cookie for a year. */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
}
