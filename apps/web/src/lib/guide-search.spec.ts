import { describe, expect, it } from 'vitest';
import { normalize, queryWords, searchDocs, stem, type SearchDoc } from './guide-search';

const DOCS: SearchDoc[] = [
  {
    id: 'payroll',
    fields: [
      { text: 'Pay the monthly salaries', weight: 8 },
      { text: 'salary, wages, EPF, වැටුප්', weight: 5 },
      { text: 'Open Payroll and press Calculate salaries.', weight: 1 },
    ],
  },
  {
    id: 'advance',
    fields: [
      { text: 'Give a salary advance', weight: 8 },
      { text: 'loan, අත්තිකාරම්', weight: 5 },
    ],
  },
  {
    id: 'insurance',
    fields: [
      { text: 'Renew insurance or a licence', weight: 8 },
      { text: 'ශ්\u200dරී ලංකා රක්ෂණය', weight: 5 },
    ],
  },
];

describe('normalize', () => {
  it('lower-cases and drops punctuation and Sinhala joiners', () => {
    expect(normalize('  EPF / ETF — Summary! ')).toBe('epf etf summary');
    expect(normalize('ශ්\u200dරී')).toBe('ශ්රී');
  });

  it('keeps Sinhala vowel signs', () => {
    expect(normalize('වැටුප්')).toBe('වැටුප්');
  });
});

describe('stem', () => {
  it('cuts one common English ending', () => {
    expect(stem('salary')).toBe('salar');
    expect(stem('salaries')).toBe('salar');
    expect(stem('booking')).toBe('book');
    expect(stem('bills')).toBe('bill');
    expect(stem('epf')).toBe('epf');
    expect(stem('වැටුප්')).toBe('වැටුප්');
  });
});

describe('queryWords', () => {
  it('splits into unique words', () => {
    expect(queryWords('Salary salary  advance')).toEqual(['salary', 'advance']);
    expect(queryWords('   ')).toEqual([]);
  });
});

describe('searchDocs', () => {
  it('finds nothing for an empty query', () => {
    expect(searchDocs(DOCS, '')).toEqual([]);
  });

  it('matches part of a word', () => {
    expect(searchDocs(DOCS, 'salar').map((h) => h.id)).toEqual(['payroll', 'advance']);
  });

  it('needs every word', () => {
    expect(searchDocs(DOCS, 'salary loan').map((h) => h.id)).toEqual(['advance']);
    expect(searchDocs(DOCS, 'salary banana')).toEqual([]);
  });

  it('ranks a title match above a body match', () => {
    const hits = searchDocs(DOCS, 'advance');
    expect(hits[0]!.id).toBe('advance');
  });

  it('finds Sinhala words, with or without the joiner', () => {
    expect(searchDocs(DOCS, 'වැටුප්').map((h) => h.id)).toEqual(['payroll']);
    expect(searchDocs(DOCS, 'ශ්රී').map((h) => h.id)).toEqual(['insurance']);
    expect(searchDocs(DOCS, 'ශ්\u200dරී').map((h) => h.id)).toEqual(['insurance']);
  });

  it('finds a plural in the title from a singular query', () => {
    const docs: SearchDoc[] = [
      { id: 'advance', fields: [{ text: 'Give a salary advance', weight: 8 }] },
      { id: 'payroll', fields: [{ text: 'Pay the monthly salaries', weight: 8 }], boost: 1.5 },
    ];
    expect(searchDocs(docs, 'salary').map((h) => h.id)).toEqual(['payroll', 'advance']);
  });

  it('is not case sensitive', () => {
    expect(searchDocs(DOCS, 'epf').map((h) => h.id)).toEqual(['payroll']);
  });
});
