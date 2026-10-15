import { describe, expect, it } from 'vitest';
import {
  cellLabel,
  dateLabel,
  filePart,
  moneyLabel,
  monthLabel,
  qtyLabel,
  total,
  totalQty,
} from './model.js';

describe('report formatting', () => {
  it.each([
    ['1250000', '1,250,000.00'],
    ['1250000.5', '1,250,000.50'],
    ['-675379', '-675,379.00'],
    ['0', '0.00'],
    ['999.999', '1,000.00'],
    [12, '12.00'],
  ])('money %s → %s', (v, out) => expect(moneyLabel(v)).toBe(out));

  it.each([
    ['45.5', '45.5'],
    ['1234.125', '1,234.125'],
    ['10.000', '10'],
    ['-2', '-2'],
  ])('qty %s → %s', (v, out) => expect(qtyLabel(v)).toBe(out));

  it('formats dates, months, percentages and empties', () => {
    expect(dateLabel('2026-10-05')).toBe('05 Oct 2026');
    expect(monthLabel('2026-09')).toBe('September 2026');
    expect(cellLabel('107.345', 'pct')).toBe('107.3%');
    expect(cellLabel(null, 'money')).toBe('');
    expect(cellLabel('', 'date')).toBe('');
    expect(cellLabel(3, 'int')).toBe('3');
  });

  it('totals are exact decimals', () => {
    expect(total(['0.1', '0.2', null, undefined])).toBe('0.30');
    expect(totalQty(['0.5', '1.25', '0.005'])).toBe('1.755');
  });

  it('makes safe file names', () => {
    expect(filePart('PRJ-2026-001')).toBe('PRJ-2026-001');
    expect(filePart('IPC/01 (draft)')).toBe('IPC-01-draft');
  });
});
