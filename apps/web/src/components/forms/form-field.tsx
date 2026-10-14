'use client';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { useValidationMessage } from '@/hooks/use-error-message';

/** Label + control + hint + translated error, laid out the same everywhere. */
export function FormField({
  id,
  label,
  description,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  description?: string;
  /** A react-hook-form field error; its message is an i18n code. */
  error?: { message?: unknown };
  children: React.ReactNode;
  className?: string;
}) {
  const translate = useValidationMessage();
  const message = translate(typeof error?.message === 'string' ? error.message : undefined);
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id} className="text-[0.95rem]">
        {label}
      </FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {message ? <FieldError>{message}</FieldError> : null}
    </Field>
  );
}
