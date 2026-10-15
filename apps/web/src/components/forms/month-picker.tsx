'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatMonth } from '@/lib/format';

/** "2026-10" ± n months */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** ‹ October 2026 › — works the same in every browser (Safari has no month input). */
export function MonthPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (m: string) => void;
  id?: string;
}) {
  const t = useTranslations('payroll');
  return (
    <div className="flex items-center gap-1" id={id}>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label={t('prevMonth')}
        onClick={() => onChange(shiftMonth(value, -1))}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <span className="min-w-40 text-center text-lg font-semibold" data-testid="month-value">
        {formatMonth(value)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label={t('nextMonth')}
        onClick={() => onChange(shiftMonth(value, 1))}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
