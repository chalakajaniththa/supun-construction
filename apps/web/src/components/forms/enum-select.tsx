'use client';

import { ALL_ENUMS, type EnumName } from '@sc/shared';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Value used for "All" in filters (Radix Select does not allow an empty value). */
export const ALL = '__all__';

/** "ProjectType" → "projectType" (the i18n namespace under `enums`). */
export const enumKey = (name: EnumName) => name.charAt(0).toLowerCase() + name.slice(1);

/** Translates enum values: useEnumLabel()('ProjectType', 'ROAD') → "Road". */
export function useEnumLabel() {
  const t = useTranslations('enums');
  return (name: EnumName, value: string | null | undefined) =>
    value ? t(`${enumKey(name)}.${value}` as 'projectType.ROAD') : '—';
}

/** A select over a shared enum, labelled from i18n. `allLabel` adds an "All" option (filters). */
export function EnumSelect({
  enumName,
  values,
  value,
  onChange,
  id,
  allLabel,
  placeholder,
  disabled,
  invalid,
  className,
  'aria-label': ariaLabel,
}: {
  enumName: EnumName;
  /** A subset / custom order of the enum's values. */
  values?: readonly string[];
  value: string | undefined;
  onChange: (value: string) => void;
  id?: string;
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const label = useEnumLabel();
  const tc = useTranslations('common');
  const options = values ?? ALL_ENUMS[enumName];
  return (
    <Select
      value={value ? value : allLabel ? ALL : ''}
      onValueChange={(v) => onChange(v === ALL ? '' : v)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn('h-11 w-full text-base data-[size=default]:h-11', className)}
      >
        <SelectValue placeholder={placeholder ?? tc('choose')} />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value={ALL}>{allLabel}</SelectItem> : null}
        {options.map((v) => (
          <SelectItem key={v} value={v} className="text-base">
            {label(enumName, v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A compact filter select for list toolbars ("All types", …). */
export function EnumFilter(props: {
  enumName: EnumName;
  value: string | undefined;
  onChange: (value: string) => void;
  allLabel: string;
  values?: readonly string[];
  testId?: string;
}) {
  return (
    <div className="w-48" data-testid={props.testId}>
      <EnumSelect
        {...props}
        aria-label={props.allLabel}
        className="h-10 data-[size=default]:h-10"
      />
    </div>
  );
}
