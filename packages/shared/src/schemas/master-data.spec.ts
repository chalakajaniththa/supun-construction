import { describe, expect, it } from 'vitest';
import { DOCUMENT_CATEGORIES } from '../enums';
import { assetCreateSchema } from './assets';
import { dayToDate, isValidDay, optionalMoney, optionalText, toDay } from './common';
import {
  daysUntil,
  documentCreateSchema,
  documentVersionCreateSchema,
  expiryStatus,
  mimeTypeFor,
  orderedDocumentCategories,
  previewKind,
  suggestedDocumentCategories,
} from './documents';
import { clientCreateSchema, clientUpdateSchema } from './parties';
import { budgetUpdateSchema, projectCreateSchema, projectUpdateSchema } from './projects';
import {
  isValidNic,
  workerCreateSchema,
  workerRateCreateSchema,
  workerUpdateSchema,
} from './workers';

const issues = (r: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => (r.success ? [] : r.error!.issues.map((i) => `${i.path.join('.')}:${i.message}`));

describe('common helpers', () => {
  it.each([
    ['2026-10-14', true],
    ['2024-02-29', true],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['14/10/2026', false],
    ['', false],
  ])('isValidDay(%j) = %s', (v, ok) => expect(isValidDay(v)).toBe(ok));

  it('optional fields: "" and null → null, undefined stays undefined', () => {
    expect(optionalText(10).parse('')).toBeNull();
    expect(optionalText(10).parse('  x ')).toBe('x');
    expect(optionalText(10).parse(undefined)).toBeUndefined();
    expect(optionalMoney.parse('')).toBeNull();
    expect(optionalMoney.parse(null)).toBeNull();
    expect(optionalMoney.parse('12.5')).toBe('12.5');
    expect(optionalMoney.safeParse('-1').success).toBe(false);
  });

  it('day conversions', () => {
    expect(dayToDate('2026-10-14').toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(toDay('2026-10-14T00:00:00.000Z')).toBe('2026-10-14');
    expect(toDay(null)).toBe('');
  });
});

describe('clients', () => {
  it('requires name and type', () => {
    expect(issues(clientCreateSchema.safeParse({ name: ' ' }))).toEqual([
      'name:REQUIRED',
      'type:REQUIRED',
    ]);
  });

  it('PATCH leaves missing fields undefined (no accidental clearing)', () => {
    expect(clientUpdateSchema.parse({ phone: '011' })).toEqual({ phone: '011' });
    expect(clientUpdateSchema.parse({ email: '' })).toEqual({ email: null });
  });

  it('validates email', () => {
    expect(
      issues(clientCreateSchema.safeParse({ name: 'A', type: 'PRIVATE', email: 'x' })),
    ).toEqual(['email:INVALID_EMAIL']);
  });
});

describe('projects', () => {
  const base = {
    name: 'Road',
    type: 'ROAD',
    source: 'GOVERNMENT_TENDER',
    clientId: '6f1c4a52-4a2a-4c43-9d55-4b0d2b8f2d10',
    startDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
  };

  it('accepts a minimal project', () => {
    expect(projectCreateSchema.safeParse(base).success).toBe(true);
  });

  it('rejects end dates before the start date', () => {
    expect(
      issues(
        projectCreateSchema.safeParse({
          ...base,
          plannedEndDate: '2025-12-31',
          revisedEndDate: '2025-01-01',
        }),
      ),
    ).toEqual(['plannedEndDate:END_BEFORE_START', 'revisedEndDate:END_BEFORE_START']);
  });

  it('update is partial', () => {
    expect(projectUpdateSchema.parse({ status: 'ONGOING' })).toEqual({ status: 'ONGOING' });
  });

  it('budget: one line per category, money only', () => {
    expect(
      budgetUpdateSchema.safeParse({ lines: [{ category: 'LABOUR', amount: '100' }] }).success,
    ).toBe(true);
    expect(
      issues(
        budgetUpdateSchema.safeParse({
          lines: [
            { category: 'LABOUR', amount: '100' },
            { category: 'LABOUR', amount: '5' },
          ],
        }),
      ),
    ).toEqual(['lines:DUPLICATE_CATEGORY']);
    expect(
      issues(budgetUpdateSchema.safeParse({ lines: [{ category: 'LABOUR', amount: '1.234' }] })),
    ).toEqual(['lines.0.amount:INVALID_MONEY']);
  });
});

describe('workers', () => {
  it.each([
    ['851234567V', true],
    ['851234567x', true],
    ['198512345678', true],
    ['85123456V', false],
    ['1985123456789', false],
    ['ABCDEFGHIJ', false],
  ])('isValidNic(%j) = %s', (nic, ok) => expect(isValidNic(nic)).toBe(ok));

  const base = {
    fullName: 'Kamal',
    skill: 'MASON',
    type: 'DAILY',
    joinedDate: '2026-01-01',
    dailyRate: '3500',
  };

  it('normalises the NIC and treats "" as none', () => {
    expect(workerCreateSchema.parse({ ...base, nic: ' 851234567v ' }).nic).toBe('851234567V');
    expect(workerCreateSchema.parse({ ...base, nic: '' }).nic).toBeNull();
    expect(issues(workerCreateSchema.safeParse({ ...base, nic: '12345' }))).toEqual([
      'nic:INVALID_NIC',
    ]);
  });

  it('needs the right starting pay for the worker type', () => {
    expect(issues(workerCreateSchema.safeParse({ ...base, dailyRate: '' }))).toEqual([
      'dailyRate:REQUIRED',
    ]);
    expect(
      issues(workerCreateSchema.safeParse({ ...base, type: 'PERMANENT', dailyRate: undefined })),
    ).toEqual(['monthlySalary:REQUIRED']);
  });

  it('update keeps unspecified fields undefined', () => {
    expect(workerUpdateSchema.parse({ phone: '077' })).toEqual({ phone: '077' });
  });

  it('rate needs a valid date', () => {
    expect(
      issues(workerRateCreateSchema.safeParse({ effectiveFrom: '2026-02-30', dailyRate: '1' })),
    ).toEqual(['effectiveFrom:INVALID_DATE']);
  });
});

describe('assets', () => {
  it('upper-cases the registration number and parses the year', () => {
    const v = assetCreateSchema.parse({
      name: 'Tipper',
      category: 'TIPPER',
      registrationNo: ' lb-1234 ',
      yearOfManufacture: '2015',
    });
    expect(v.registrationNo).toBe('LB-1234');
    expect(v.yearOfManufacture).toBe(2015);
    expect(
      assetCreateSchema.parse({ name: 'X', category: 'TOOL', yearOfManufacture: '' })
        .yearOfManufacture,
    ).toBeNull();
  });

  it('rejects an impossible year', () => {
    expect(
      issues(
        assetCreateSchema.safeParse({ name: 'X', category: 'TOOL', yearOfManufacture: '1800' }),
      ),
    ).toEqual(['yearOfManufacture:INVALID_NUMBER']);
  });
});

describe('documents', () => {
  it.each([
    ['plan.PDF', 'application/pdf'],
    ['photo.jpeg', 'image/jpeg'],
    ['IMG_1.HEIC', 'image/heic'],
    ['site.dwg', 'image/vnd.dwg'],
    ['bundle.zip', 'application/zip'],
    ['virus.exe', null],
    ['noext', null],
  ])('mimeTypeFor(%j) = %s', (name, mime) => expect(mimeTypeFor(name)).toBe(mime));

  it('previewKind', () => {
    expect(previewKind('application/pdf')).toBe('pdf');
    expect(previewKind('image/png')).toBe('image');
    expect(previewKind('image/heic')).toBeNull();
  });

  it.each([
    ['2026-10-13', 'EXPIRED'],
    ['2026-10-14', 'SOON'],
    ['2026-11-13', 'SOON'],
    ['2026-11-14', 'OK'],
    [null, null],
  ])('expiryStatus(%j) on 2026-10-14 = %s', (expiry, status) =>
    expect(expiryStatus(expiry, '2026-10-14')).toBe(status),
  );

  it('daysUntil crosses month and year boundaries', () => {
    expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1);
    expect(daysUntil('2026-03-01', '2026-02-28')).toBe(1);
    expect(daysUntil('2026-10-01', '2026-10-14')).toBe(-13);
  });

  it('owner is required except for company documents', () => {
    expect(
      issues(
        documentCreateSchema.safeParse({ ownerType: 'ASSET', category: 'INSURANCE', title: 'Ins' }),
      ),
    ).toEqual(['ownerId:REQUIRED']);
    expect(
      documentCreateSchema.safeParse({
        ownerType: 'COMPANY',
        category: 'CIDA_REGISTRATION',
        title: 'CIDA',
      }).success,
    ).toBe(true);
  });

  it('expiry cannot be before the issue date', () => {
    expect(
      issues(
        documentVersionCreateSchema.safeParse({
          issueDate: '2026-05-01',
          expiryDate: '2026-04-30',
        }),
      ),
    ).toEqual(['expiryDate:EXPIRY_BEFORE_ISSUE']);
  });

  it('suggests vehicle documents for vehicles and lists every category once', () => {
    expect(suggestedDocumentCategories('ASSET', { isVehicle: true }).slice(0, 4)).toEqual([
      'REVENUE_LICENCE',
      'INSURANCE',
      'EMISSION_TEST',
      'FITNESS_CERTIFICATE',
    ]);
    const all = orderedDocumentCategories('WORKER');
    expect(all[0]).toBe('NIC_COPY');
    expect([...all].sort()).toEqual([...DOCUMENT_CATEGORIES].sort());
  });
});
