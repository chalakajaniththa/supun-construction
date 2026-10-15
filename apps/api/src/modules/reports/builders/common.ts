import type { Translator } from '../../../common/i18n/i18n.service.js';
import { dateLabel, monthLabel } from '../model.js';

export const enumLabel = (t: Translator, enumName: string, value: string | null | undefined) =>
  value ? t(`enums.${enumName}.${value}`) : '';

/** "01 Oct 2026 – 15 Oct 2026", "from …", "until …" or "all time". */
export function rangeLabel(t: Translator, from?: string | null, to?: string | null): string {
  if (from && to) return `${dateLabel(from)} – ${dateLabel(to)}`;
  if (from) return t('reports.common.fromOnly', { date: dateLabel(from) });
  if (to) return t('reports.common.untilOnly', { date: dateLabel(to) });
  return t('reports.common.allTime');
}

export const periodFilter = (t: Translator, from?: string | null, to?: string | null) => ({
  label: t('reports.common.period'),
  value: rangeLabel(t, from, to),
});

export const monthFilter = (t: Translator, month: string) => ({
  label: t('reports.common.month'),
  value: monthLabel(month),
});

/** "Name (CODE)" */
export const named = (name: string | null | undefined, code: string | null | undefined) =>
  name && code ? `${name} (${code})` : (name ?? code ?? '');

/** "2026-10" from year + month */
export const monthOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
