import { describe, expect, it } from 'vitest';
import { budgetSum } from './budget';
import { formatFileSize } from './upload';

describe('budgetSum', () => {
  it('adds exactly (no float errors)', () => {
    expect(budgetSum(['0.1', '0.2'])).toBe('0.30');
    expect(budgetSum(['7800000.00', '19500000', '9200000.10', ''])).toBe('36500000.10');
  });

  it('skips blanks and half-typed values', () => {
    expect(budgetSum(['', '12.', 'abc', '5'])).toBe('5.00');
    expect(budgetSum([])).toBe('0.00');
  });
});

describe('formatFileSize', () => {
  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [1_572_864, '1.5 MB'],
    [52_428_800, '50.0 MB'],
  ])('%i → %s', (bytes, text) => expect(formatFileSize(bytes)).toBe(text));
});
