import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildPreview, cleanNumber, parseCsv, parseXlsx } from './import.js';

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas and newlines inside quotes, CRLF and a BOM', () => {
    const rows = parseCsv('﻿a,"b, c","say ""hi"""\r\n1,"two\nlines",3\n');
    expect(rows).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', 'two\nlines', '3'],
    ]);
  });

  it('accepts semicolon-separated files', () => {
    expect(parseCsv('1;Excavation;m3;10;1500')).toEqual([['1', 'Excavation', 'm3', '10', '1500']]);
  });
});

describe('buildPreview', () => {
  it('matches columns by header name and skips headings and blank rows', () => {
    const rows = buildPreview(
      parseCsv(
        [
          'Description,Item No,Unit,Qty,Rate',
          '1. EARTHWORKS,,,,',
          '"Excavation in soil, any depth",1.1,m3,"1,250.5",Rs. 1500',
          ',,,,',
          'Backfilling,1.2,m3,300,850.25',
        ].join('\n'),
      ),
    );
    expect(
      rows.map((r) => [r.line, r.itemNo, r.description, r.unit, r.quantity, r.rate, r.amount]),
    ).toEqual([
      [3, '1.1', 'Excavation in soil, any depth', 'm3', '1250.5', '1500', '1875750.00'],
      [5, '1.2', 'Backfilling', 'm3', '300', '850.25', '255075.00'],
    ]);
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
  });

  it('uses positional columns without a header and reports bad values per field', () => {
    const rows = buildPreview(parseCsv('2.1,Sub-base,m3,abc,4500\n2.2,,m2,10,-5\n2.3,ABC,m3,10,'));
    expect(rows[0]!.errors).toEqual([{ field: 'quantity', message: 'INVALID_QUANTITY' }]);
    expect(rows[0]!.amount).toBeNull();
    expect(rows[1]!.errors.map((e) => e.field).sort()).toEqual(['description', 'rate']);
    expect(rows[2]!.errors).toEqual([{ field: 'rate', message: 'INVALID_MONEY' }]);
  });

  it('cleanNumber strips Rs. and separators', () => {
    expect(cleanNumber('Rs. 1,234,567.50')).toBe('1234567.50');
    expect(cleanNumber(' 12 500 ')).toBe('12500');
  });
});

describe('parseXlsx', () => {
  it('reads the first sheet (numbers, formulas, rich text)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('BOQ');
    ws.addRow(['Item No', 'Description', 'Unit', 'Quantity', 'Rate']);
    ws.addRow(['1.1', 'Site clearance', 'm2', 2400, 85.5]);
    ws.addRow([
      '1.2',
      { richText: [{ text: 'Excavation ' }, { text: 'to level' }] },
      'm3',
      { formula: '100*2', result: 200 },
      1450,
    ]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const rows = buildPreview(await parseXlsx(buf));
    expect(rows.map((r) => [r.itemNo, r.description, r.quantity, r.rate, r.amount])).toEqual([
      ['1.1', 'Site clearance', '2400', '85.5', '205200.00'],
      ['1.2', 'Excavation to level', '200', '1450', '290000.00'],
    ]);
  });
});
