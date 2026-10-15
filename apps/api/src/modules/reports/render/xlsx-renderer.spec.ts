import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { ReportDoc } from '../model.js';
import { testTranslator } from '../test-translator.js';
import { excelValue, renderXlsx, sheetName } from './xlsx-renderer.js';

const company = {
  name: 'Supun Construction',
  address: '',
  phone: '',
  email: '',
  cidaGrade: 'C5',
  logo: null,
};

const doc: ReportDoc = {
  title: 'Expenses',
  filters: [{ label: 'Period', value: '01 Oct 2026 – 15 Oct 2026' }],
  landscape: false,
  filename: 'expenses',
  sections: [
    {
      kind: 'table',
      sheet: 'Summary',
      columns: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'name', label: 'Description', type: 'text' },
        { key: 'qty', label: 'Qty', type: 'qty' },
        { key: 'amount', label: 'Amount (Rs.)', type: 'money' },
      ],
      rows: [
        { date: '2026-10-02', name: 'සිමෙන්ති', qty: '1.5', amount: '1250000.50' },
        { date: '2026-10-03', name: 'Sand', qty: '2', amount: '0.10' },
      ],
      totals: { name: 'Total', amount: '1250000.60' },
    },
    {
      kind: 'keyValue',
      sheet: 'Totals',
      items: [{ label: 'Spent', value: '99.99', type: 'money', strong: true }],
    },
  ],
};

describe('excel helpers', () => {
  it('converts cells to numbers and dates', () => {
    expect(excelValue('1250000.50', 'money')).toBe(1250000.5);
    expect(excelValue(null, 'money')).toBeNull();
    expect(excelValue('2026-10-02', 'date')).toEqual(new Date('2026-10-02T00:00:00Z'));
    expect(excelValue('x', 'text')).toBe('x');
  });

  it('makes valid, unique sheet names', () => {
    const used = new Set<string>();
    expect(sheetName('A/B: [c]?', used)).toBe('A B   c');
    expect(sheetName('Summary', used)).toBe('Summary');
    expect(sheetName('summary', used)).toBe('summary 2');
    expect(sheetName('x'.repeat(40), used)).toHaveLength(31);
  });
});

describe('renderXlsx', () => {
  it('writes a workbook with a styled header row, number formats, totals and a sheet per section', async () => {
    const buf = await renderXlsx(doc, company, testTranslator('en'), '15 Oct 2026 10:00');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', 'Totals']);
    const ws = wb.getWorksheet('Summary')!;
    expect(ws.getCell('A1').value).toBe('Supun Construction');
    let header = 0;
    ws.eachRow((row, n) => {
      if (row.getCell(1).value === 'Date' && !header) header = n;
    });
    expect(header).toBeGreaterThan(0);
    expect(ws.getRow(header).values).toEqual([
      undefined,
      'Date',
      'Description',
      'Qty',
      'Amount (Rs.)',
    ]);
    expect(ws.getRow(header).font?.bold).toBe(true);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: header });
    const first = ws.getRow(header + 1);
    expect(first.getCell(2).value).toBe('සිමෙන්ති');
    expect(first.getCell(4).value).toBe(1250000.5);
    expect(first.getCell(4).numFmt).toBe('#,##0.00');
    const totals = ws.getRow(header + 3);
    expect(totals.getCell(2).value).toBe('Total');
    expect(totals.getCell(4).value).toBe(1250000.6);
    expect(wb.getWorksheet('Totals')!.getRow(1).getCell(2).value).toBe(99.99);
  });
});
