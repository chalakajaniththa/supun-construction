'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { errorMessageKey } from '@/lib/api-client';

/** Turns any error (ApiError or not) into a friendly, translated sentence. */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return useCallback(
    (err: unknown) => t(errorMessageKey(err, (code) => t.has(code)) as 'generic'),
    [t],
  );
}

/**
 * Translates a form error message code: a validation code ("REQUIRED" → errors.validation.REQUIRED),
 * or an API error code ("WRONG_PASSWORD" → errors.WRONG_PASSWORD); anything else → "INVALID".
 */
export function useValidationMessage() {
  const t = useTranslations('errors');
  return useCallback(
    (message: string | undefined) => {
      if (!message) return undefined;
      if (t.has(`validation.${message}`))
        return t(`validation.${message}` as 'validation.REQUIRED');
      if (/^[A-Z_]+$/.test(message) && t.has(message)) return t(message as 'generic');
      return t('validation.INVALID');
    },
    [t],
  );
}
