'use client';

import { cn } from '@/lib/utils';

/** Big toggle buttons (one choice). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  size = 'md',
  testId,
}: {
  options: { value: T; label: string; tone?: 'success' | 'warning' | 'danger' | 'info' }[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  testId?: string;
}) {
  const tones = {
    success: 'data-[on=true]:bg-success data-[on=true]:text-white',
    warning: 'data-[on=true]:bg-warning data-[on=true]:text-foreground',
    danger: 'data-[on=true]:bg-destructive data-[on=true]:text-white',
    info: 'data-[on=true]:bg-primary data-[on=true]:text-primary-foreground',
  } as const;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1 lg:flex-nowrap"
      data-testid={testId}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-on={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md font-medium transition-colors hover:bg-background disabled:opacity-50',
              size === 'md' ? 'min-w-20 px-3 py-1.5 text-[0.95rem]' : 'px-2.5 py-1 text-sm',
              tones[o.tone ?? 'info'],
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
