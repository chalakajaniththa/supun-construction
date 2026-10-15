import type { Translator } from '../../common/i18n/i18n.service.js';
import { type DecimalInput, dec, sum } from '../../common/money/money.js';

/**
 * A report as data: the PDF renderer (Handlebars → Gotenberg) and the Excel renderer (exceljs)
 * both draw the same structure, so the two formats always agree.
 */
export type CellType = 'text' | 'money' | 'qty' | 'int' | 'date' | 'pct';
/** Money / qty / pct are decimal strings (exact); dates "YYYY-MM-DD". */
export type Cell = string | number | null;

export interface Column {
  key: string;
  label: string;
  type: CellType;
  /** Excel column width in characters (otherwise auto). */
  width?: number;
}

interface SectionBase {
  title?: string;
  /** Excel: start a new worksheet with this name (≤ 31 chars). */
  sheet?: string;
  /** PDF: start on a new page. */
  pageBreakBefore?: boolean;
  /** A short line under the title. */
  note?: string;
}

export interface TableSection extends SectionBase {
  kind: 'table';
  columns: Column[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
  /** Smaller text for wide tables (attendance grid). */
  dense?: boolean;
}

export interface KeyValueItem {
  label: string;
  value: Cell;
  type: CellType;
  strong?: boolean;
}

export interface KeyValueSection extends SectionBase {
  kind: 'keyValue';
  items: KeyValueItem[];
}

export type Section = TableSection | KeyValueSection;

export interface ReportDoc {
  title: string;
  /** Shown under the title (e.g. the project or month). */
  subtitle?: string;
  filters: { label: string; value: string }[];
  sections: Section[];
  landscape: boolean;
  /** Without extension, e.g. "project-cost_PRJ-2026-001_2026-10". */
  filename: string;
}

/** Company details printed in the header. */
export interface ReportCompany {
  name: string;
  address: string;
  phone: string;
  email: string;
  cidaGrade: string;
  /** data: URL of the logo, when one is set. */
  logo: string | null;
}

export interface BuildContext {
  t: Translator;
  today: string;
}

/** Σ of a column as a 2-dp string (totals rows). */
export const total = (values: readonly (DecimalInput | null | undefined)[]) =>
  sum(values).toFixed(2);
/** Σ of quantities (up to 3 dp, no trailing zeros). */
export const totalQty = (values: readonly (DecimalInput | null | undefined)[]) =>
  sum(values).toDecimalPlaces(3).toString();

export const money = (v: DecimalInput | null | undefined): string | null =>
  v === null || v === undefined || v === '' ? null : dec(v).toFixed(2);

/** "Rs." label suffix for money columns. */
export const rs = (t: Translator, label: string) => `${label} (${t('common.rupees')})`;

/** Safe file-name part: letters, digits, dash, underscore. */
export const filePart = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

/** "October 2026" (en-GB in both languages, like the screens). */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}

/** "14 Oct 2026" */
export function dateLabel(day: string | null | undefined): string {
  if (!day) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

/** "1,250,000.00" (always 2 dp, exact). */
export function moneyLabel(v: Cell): string {
  if (v === null || v === '') return '';
  const d = dec(v).toFixed(2);
  const [int, frac] = d.split('.');
  const neg = int!.startsWith('-');
  const digits = neg ? int!.slice(1) : int!;
  return `${neg ? '-' : ''}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

/** Quantity: up to 3 dp, thousands separators. */
export function qtyLabel(v: Cell): string {
  if (v === null || v === '') return '';
  const d = dec(v).toDecimalPlaces(3).toString();
  const [int, frac] = d.split('.');
  const neg = int!.startsWith('-');
  const digits = neg ? int!.slice(1) : int!;
  return `${neg ? '-' : ''}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}`;
}

export function cellLabel(v: Cell, type: CellType): string {
  if (v === null || v === undefined || v === '') return '';
  switch (type) {
    case 'money':
      return moneyLabel(v);
    case 'qty':
      return qtyLabel(v);
    case 'pct':
      return `${dec(v).toFixed(1)}%`;
    case 'date':
      return dateLabel(String(v));
    case 'int':
      return String(v);
    default:
      return String(v);
  }
}
