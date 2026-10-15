import ExcelJS from 'exceljs';
import type { Translator } from '../../../common/i18n/i18n.service.js';
import { dec } from '../../../common/money/money.js';
import {
  type Cell,
  type CellType,
  type ReportCompany,
  type ReportDoc,
  type Section,
  cellLabel,
} from '../model.js';

const NUM_FMT: Partial<Record<CellType, string>> = {
  money: '#,##0.00',
  qty: '#,##0.###',
  pct: '0.0',
  int: '0',
  date: 'dd mmm yyyy',
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE5EDFF' },
};
const TOTAL_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEEF2FF' },
};
const FONT = 'Noto Sans';

/** Excel value of a cell: numbers for money / qty / pct / int (formatted), real dates. */
export function excelValue(v: Cell, type: CellType): ExcelJS.CellValue {
  if (v === null || v === undefined || v === '') return null;
  switch (type) {
    case 'money':
    case 'qty':
    case 'pct':
    case 'int':
      return dec(v).toNumber();
    case 'date':
      return new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
    default:
      return String(v);
  }
}

/** Excel sheet names: ≤ 31 chars, no []:*?/\ and unique in the book. */
export function sheetName(name: string, used: Set<string>): string {
  const base =
    name
      .replace(/[[\]:*?/\\]/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet';
  let n = base;
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 28)} ${i}`;
  used.add(n.toLowerCase());
  return n;
}

/**
 * exceljs: a header block (company, title, filters), then each section — a styled header row,
 * number formats, a frozen header (first table of a sheet), a totals row and auto column widths.
 * A section with `sheet` starts a new worksheet.
 */
export async function renderXlsx(
  doc: ReportDoc,
  company: ReportCompany,
  t: Translator,
  generatedAt: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = company.name;
  wb.created = new Date();
  const used = new Set<string>();
  let ws: ExcelJS.Worksheet | null = null;
  let widths: number[] = [];
  let frozen = false;

  const fit = () => {
    if (!ws) return;
    widths.forEach((w, i) => {
      ws!.getColumn(i + 1).width = Math.min(60, Math.max(8, w + 2));
    });
  };
  const track = (col: number, text: string) => {
    widths[col] = Math.max(widths[col] ?? 0, text.length);
  };
  const newSheet = (name: string, withHeader: boolean) => {
    fit();
    ws = wb.addWorksheet(sheetName(name, used), {
      pageSetup: {
        paperSize: 9,
        orientation: doc.landscape ? 'landscape' : 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    widths = [];
    frozen = false;
    if (withHeader) {
      const title = ws.addRow([company.name]);
      title.font = { name: FONT, bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
      const r2 = ws.addRow([doc.title]);
      r2.font = { name: FONT, bold: true, size: 12 };
      if (doc.subtitle) ws.addRow([doc.subtitle]).font = { name: FONT, size: 11 };
      for (const f of doc.filters)
        ws.addRow([`${f.label}: ${f.value}`]).font = { name: FONT, size: 10 };
      ws.addRow([`${t('reports.common.generated')}: ${generatedAt}`]).font = {
        name: FONT,
        size: 9,
        color: { argb: 'FF6B7280' },
      };
      ws.addRow([]);
    }
  };

  const addSection = (s: Section) => {
    const sheet = ws!;
    if (s.title) {
      const r = sheet.addRow([s.title]);
      r.font = { name: FONT, bold: true, size: 12 };
    }
    if (s.note) sheet.addRow([s.note]).font = { name: FONT, italic: true, size: 9 };
    if (s.kind === 'keyValue') {
      for (const item of s.items) {
        const r = sheet.addRow([item.label, excelValue(item.value, item.type)]);
        r.font = { name: FONT, bold: Boolean(item.strong) };
        const fmt = NUM_FMT[item.type];
        if (fmt) r.getCell(2).numFmt = fmt;
        track(0, item.label);
        track(1, cellLabel(item.value, item.type));
      }
      sheet.addRow([]);
      return;
    }
    const header = sheet.addRow(s.columns.map((c) => c.label));
    header.font = { name: FONT, bold: true, color: { argb: 'FF1E3A8A' } };
    header.alignment = { vertical: 'bottom', wrapText: true };
    header.eachCell((c) => {
      c.fill = HEADER_FILL;
      c.border = { bottom: { style: 'thin', color: { argb: 'FF93A5D9' } } };
    });
    s.columns.forEach((c, i) => track(i, c.label.length > 24 ? c.label.slice(0, 24) : c.label));
    if (!frozen) {
      sheet.views = [{ state: 'frozen', ySplit: header.number }];
      frozen = true;
    }
    for (const row of s.rows) {
      const r = sheet.addRow(s.columns.map((c) => excelValue(row[c.key] ?? null, c.type)));
      r.font = { name: FONT };
      s.columns.forEach((c, i) => {
        const fmt = NUM_FMT[c.type];
        if (fmt) r.getCell(i + 1).numFmt = fmt;
        track(i, cellLabel(row[c.key] ?? null, c.type));
      });
    }
    if (s.totals) {
      const r = sheet.addRow(s.columns.map((c) => excelValue(s.totals![c.key] ?? null, c.type)));
      r.font = { name: FONT, bold: true };
      s.columns.forEach((c, i) => {
        const cell = r.getCell(i + 1);
        cell.fill = TOTAL_FILL;
        cell.border = { top: { style: 'thin', color: { argb: 'FF1D4ED8' } } };
        const fmt = NUM_FMT[c.type];
        if (fmt) cell.numFmt = fmt;
        track(i, cellLabel(s.totals![c.key] ?? null, c.type));
      });
    }
    s.columns.forEach((c, i) => {
      if (c.width) widths[i] = Math.max(widths[i] ?? 0, c.width);
    });
    sheet.addRow([]);
  };

  doc.sections.forEach((s, i) => {
    if (i === 0) newSheet(s.sheet ?? t('reports.common.sheet'), true);
    else if (s.sheet) newSheet(s.sheet, false);
    addSection(s);
  });
  if (!ws) newSheet(t('reports.common.sheet'), true);
  fit();
  return Buffer.from(await wb.xlsx.writeBuffer());
}
