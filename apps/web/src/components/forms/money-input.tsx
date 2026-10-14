'use client';

import { useTranslations } from 'next-intl';
import { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Money input: keeps the value as a decimal **string** (never a float), allows only digits and
 * one dot with up to 2 decimals, shows the "Rs." prefix.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value' | 'type'> & {
    value: string | null | undefined;
    onChange: (value: string) => void;
    allowNegative?: boolean;
    decimals?: number;
  }
>(function MoneyInput(
  { value, onChange, allowNegative = false, decimals = 2, className, ...props },
  ref,
) {
  const t = useTranslations('common');
  const pattern = new RegExp(`^${allowNegative ? '-?' : ''}\\d*(\\.\\d{0,${decimals}})?$`);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
        {t('rupees')}
      </span>
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value ?? ''}
        onChange={(e) => {
          const next = e.target.value.replace(/,/g, '').trim();
          if (next === '' || pattern.test(next)) onChange(next);
        }}
        className={cn('pl-12 text-right tabular-nums', className)}
        {...props}
      />
    </div>
  );
});
