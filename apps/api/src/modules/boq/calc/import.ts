import { BOQ_IMPORT_MAX_ROWS, type BoqImportPreviewRow, boqItemCreateSchema } from '@sc/shared';
import ExcelJS from 'exceljs';
import { itemAmount } from './progress.js';

/**
 * BOQ import: a CSV or Excel (.xlsx) sheet with the columns itemNo, description, unit, quantity,
 * rate. A header row is optional — when present, columns are matched by name ("Item No",
 * "Description", "Unit", "Qty"/"Quantity", "Rate"), otherwise by position. Heading rows (no unit,
 * quantity or rate) and empty rows are skipped. Numbers may contain thousands separators or "Rs.".
 */

export type Cell = string;

const HEADER_ALIASES: Record<string, (typeof FIELDS)[number]> = {
  itemno: 'itemNo',
  item: 'itemNo',
  no: 'itemNo',
  itemnumber: 'itemNo',
  description: 'description',
  desc: 'description',
  work: 'description',
  unit: 'unit',
  units: 'unit',
  quantity: 'quantity',
  qty: 'quantity',
  rate: 'rate',
  unitrate: 'rate',
  price: 'rate',
};
const FIELDS = ['itemNo', 'description', 'unit', 'quantity', 'rate'] as const;

/** Parses CSV text (RFC 4180: quotes, doubled quotes, commas/newlines inside quotes; ; also allowed). */
export function parseCsv(text: string): Cell[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** The first worksheet of an .xlsx file as text cells. */
export async function parseXlsx(data: Buffer): Promise<Cell[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: Cell[][] = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const cells: Cell[] = [];
    for (let c = 1; c <= Math.max(r.cellCount, 5); c++) cells.push(cellText(r.getCell(c).value));
    rows.push(cells);
  });
  return rows;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v && v.result !== undefined) return cellText(v.result as ExcelJS.CellValue);
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
  }
  return String(v);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** "Rs. 1,250.50" → "1250.50"; leaves anything it cannot read as is (validation reports it). */
export function cleanNumber(raw: string): string {
  return raw.replace(/rs\.?/gi, '').replace(/[,\s]/g, '').trim();
}

/** Turns parsed cells into preview rows with per-field validation codes. */
export function buildPreview(cells: Cell[][]): BoqImportPreviewRow[] {
  if (!cells.length) return [];
  let start = 0;
  let order: (typeof FIELDS)[number][] = [...FIELDS];
  const header = cells[0]!.map((c) => HEADER_ALIASES[norm(c)]);
  if (header.filter(Boolean).length >= 2) {
    start = 1;
    const map: (typeof FIELDS)[number][] = [];
    header.forEach((f, i) => {
      if (f && !map.includes(f)) map[i] = f;
    });
    order = map;
  }
  const out: BoqImportPreviewRow[] = [];
  for (let i = start; i < cells.length; i++) {
    const raw: Record<string, string> = {
      itemNo: '',
      description: '',
      unit: '',
      quantity: '',
      rate: '',
    };
    cells[i]!.forEach((c, col) => {
      const f = order[col];
      if (f) raw[f] = String(c ?? '').trim();
    });
    if (!Object.values(raw).some(Boolean)) continue;
    if (!raw.unit && !raw.quantity && !raw.rate) continue; // a heading row
    const values = {
      itemNo: raw.itemNo!,
      description: raw.description!,
      unit: raw.unit!,
      quantity: cleanNumber(raw.quantity!),
      rate: cleanNumber(raw.rate!),
    };
    const parsed = boqItemCreateSchema.safeParse(values);
    const errors = parsed.success
      ? []
      : parsed.error.issues.map((iss) => ({
          field: String(iss.path[0] ?? ''),
          message: iss.message,
        }));
    out.push({
      line: i + 1,
      ...values,
      amount: parsed.success ? itemAmount(values.quantity, values.rate).toFixed(2) : null,
      errors,
    });
    if (out.length > BOQ_IMPORT_MAX_ROWS) break;
  }
  return out;
}
