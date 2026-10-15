import { describe, expect, it } from 'vitest';
import { fileNameFrom } from './download';

describe('fileNameFrom', () => {
  it('reads RFC 5987 and plain file names', () => {
    expect(fileNameFrom(`attachment; filename="a.pdf"; filename*=UTF-8''%E0%B6%85.pdf`, 'x')).toBe(
      'අ.pdf',
    );
    expect(fileNameFrom('attachment; filename="payroll-sheet_2026-09.xlsx"', 'x')).toBe(
      'payroll-sheet_2026-09.xlsx',
    );
    expect(fileNameFrom(null, 'fallback.pdf')).toBe('fallback.pdf');
  });
});
