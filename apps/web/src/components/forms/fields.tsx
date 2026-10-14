'use client';

import type { EnumName } from '@sc/shared';
import { useTranslations } from 'next-intl';
import { type Control, type FieldPath, type FieldValues, useController } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { DateInput } from './date-input';
import { EnumSelect } from './enum-select';
import { FormField } from './form-field';
import { MoneyInput } from './money-input';

/**
 * react-hook-form fields with the standard label / hint / translated error layout.
 * Values are always strings (or booleans for switches) — money and numbers stay decimal strings.
 */
interface BaseProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  className?: string;
  /** id prefix, so the same form can appear twice on a page. */
  idPrefix?: string;
  disabled?: boolean;
}

const fieldId = (prefix: string | undefined, name: string) =>
  `${prefix ?? 'f'}-${name.replace(/\W+/g, '-')}`;

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  idPrefix,
  disabled,
  type = 'text',
  inputMode,
  placeholder,
}: BaseProps<T> & {
  type?: 'text' | 'tel' | 'email';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
}) {
  const { field, fieldState } = useController({ control, name });
  const { ref, value, onChange, onBlur } = field;
  const id = fieldId(idPrefix, name);
  return (
    <FormField
      id={id}
      label={label}
      description={description}
      error={fieldState.error}
      className={className}
    >
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={fieldState.invalid || undefined}
        className="h-11 text-base"
        name={field.name}
        ref={ref}
        onBlur={onBlur}
        value={(value as string | null | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}

/** Whole numbers / quantities typed as text (kept as a string). */
export function NumberField<T extends FieldValues>({
  decimals = 0,
  ...props
}: BaseProps<T> & { decimals?: number; placeholder?: string }) {
  const { field, fieldState } = useController({ control: props.control, name: props.name });
  const { ref, value, onChange, onBlur } = field;
  const id = fieldId(props.idPrefix, props.name);
  const pattern = new RegExp(decimals > 0 ? `^\\d*(\\.\\d{0,${decimals}})?$` : '^\\d*$');
  return (
    <FormField
      id={id}
      label={props.label}
      description={props.description}
      error={fieldState.error}
      className={props.className}
    >
      <Input
        id={id}
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        placeholder={props.placeholder}
        disabled={props.disabled}
        aria-invalid={fieldState.invalid || undefined}
        className="h-11 text-right text-base tabular-nums"
        name={field.name}
        ref={ref}
        onBlur={onBlur}
        value={(value as string | null | undefined) ?? ''}
        onChange={(e) => {
          const next = e.target.value.replace(/,/g, '').trim();
          if (next === '' || pattern.test(next)) onChange(next);
        }}
      />
    </FormField>
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  idPrefix,
  rows = 3,
}: BaseProps<T> & { rows?: number }) {
  const { field, fieldState } = useController({ control, name });
  const { ref, value, onChange, onBlur } = field;
  const id = fieldId(idPrefix, name);
  return (
    <FormField
      id={id}
      label={label}
      description={description}
      error={fieldState.error}
      className={className}
    >
      <Textarea
        id={id}
        rows={rows}
        aria-invalid={fieldState.invalid || undefined}
        className="text-base"
        name={field.name}
        ref={ref}
        onBlur={onBlur}
        value={(value as string | null | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}

export function MoneyField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  idPrefix,
  disabled,
}: BaseProps<T>) {
  const { field, fieldState } = useController({ control, name });
  const { ref, value, onChange, onBlur } = field;
  const id = fieldId(idPrefix, name);
  return (
    <FormField
      id={id}
      label={label}
      description={description}
      error={fieldState.error}
      className={className}
    >
      <MoneyInput
        id={id}
        disabled={disabled}
        aria-invalid={fieldState.invalid || undefined}
        className="h-11 text-base"
        name={field.name}
        ref={ref}
        onBlur={onBlur}
        value={value as string | null | undefined}
        onChange={onChange}
      />
    </FormField>
  );
}

export function DateField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  idPrefix,
  disabled,
}: BaseProps<T>) {
  const t = useTranslations('common');
  const { field, fieldState } = useController({ control, name });
  const { value, onChange } = field;
  const id = fieldId(idPrefix, name);
  return (
    <FormField
      id={id}
      label={label}
      description={description}
      error={fieldState.error}
      className={className}
    >
      <div className="flex items-center gap-2">
        <DateInput
          id={id}
          disabled={disabled}
          aria-invalid={fieldState.invalid || undefined}
          className="h-11 text-base"
          value={value as string | null | undefined}
          onChange={onChange}
          placeholder={t('pickDate')}
        />
        {value && !disabled ? (
          <button
            type="button"
            className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => onChange('')}
          >
            {t('clear')}
          </button>
        ) : null}
      </div>
    </FormField>
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  idPrefix,
  disabled,
  enumName,
  values,
}: BaseProps<T> & { enumName: EnumName; values?: readonly string[] }) {
  const { field, fieldState } = useController({ control, name });
  const { value, onChange } = field;
  const id = fieldId(idPrefix, name);
  return (
    <FormField
      id={id}
      label={label}
      description={description}
      error={fieldState.error}
      className={className}
    >
      <EnumSelect
        id={id}
        enumName={enumName}
        values={values}
        disabled={disabled}
        invalid={fieldState.invalid}
        value={(value as string | undefined) ?? ''}
        onChange={onChange}
      />
    </FormField>
  );
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  idPrefix,
}: BaseProps<T>) {
  const { field } = useController({ control, name });
  const { value, onChange } = field;
  const id = fieldId(idPrefix, name);
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3', className)}>
      <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} className="mt-0.5" />
      <div className="min-w-0">
        <label htmlFor={id} className="text-[0.95rem] font-medium">
          {label}
        </label>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
