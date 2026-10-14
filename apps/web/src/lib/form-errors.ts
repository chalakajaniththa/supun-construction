import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api-client';

/**
 * Copies field errors from a 400 VALIDATION_FAILED response onto the form.
 * Returns true when at least one field error was applied.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): boolean {
  if (
    !(err instanceof ApiError) ||
    err.code !== 'VALIDATION_FAILED' ||
    !Array.isArray(err.details)
  ) {
    return false;
  }
  let applied = false;
  for (const d of err.details as { path?: string; message?: string }[]) {
    const field = d.path?.split('.')[0];
    if (field && fields.includes(field)) {
      setError(field as Path<T>, { type: 'server', message: d.message });
      applied = true;
    }
  }
  return applied;
}
