'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** "HH:mm" time picker (the browser's own time input, 15-minute steps). */
export function TimeInput({
  value,
  onChange,
  id,
  className,
  disabled,
  invalid,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  'aria-label'?: string;
}) {
  return (
    <Input
      id={id}
      type="time"
      step={900}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      className={cn('h-11 text-base tabular-nums', className)}
    />
  );
}
