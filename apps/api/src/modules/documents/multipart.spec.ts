import { describe, expect, it } from 'vitest';
import { contentDisposition, safeFileName } from './multipart.js';

describe('safeFileName', () => {
  it.each([
    ['Insurance 2026.PDF', 'Insurance-2026.pdf'],
    ['../../etc/passwd', 'passwd'],
    ['C:\\docs\\plan (v2).dwg', 'plan-v2.dwg'],
    ['රක්ෂණය.pdf', 'file.pdf'],
    ['', 'file'],
  ])('%j → %j', (input, out) => expect(safeFileName(input)).toBe(out));
});

describe('contentDisposition', () => {
  it('has an ASCII fallback and the UTF-8 name', () => {
    expect(contentDisposition('රක්ෂණය "a".pdf', true)).toBe(
      `inline; filename="______ _a_.pdf"; filename*=UTF-8''%E0%B6%BB%E0%B6%9A%E0%B7%8A%E0%B7%82%E0%B6%AB%E0%B6%BA%20%22a%22.pdf`,
    );
    expect(contentDisposition('plan.pdf', false)).toBe(
      `attachment; filename="plan.pdf"; filename*=UTF-8''plan.pdf`,
    );
  });
});
