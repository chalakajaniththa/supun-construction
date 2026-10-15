import { describe, expect, it } from 'vitest';
import {
  advanceCreateSchema,
  dailyEntrySaveSchema,
  expenseCreateSchema,
  purchaseCreateSchema,
  subtractQty,
  usageFromMeters,
  workerAllocationCreateSchema,
} from './operations';

const uuid = '00000000-0000-4000-8000-000000000001';
const uuid2 = '00000000-0000-4000-8000-000000000002';
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message);

describe('usageFromMeters (hours from meters)', () => {
  it.each([
    [{ meterType: 'HOURS', startMeter: '1000', endMeter: '1007.5' }, '7.5', null],
    [{ meterType: 'HOURS', startMeter: '1000', hoursUsed: '6' }, '6', null],
    [{ meterType: 'HOURS', hoursUsed: '' }, null, null],
    [{ meterType: 'KM', startMeter: '218400', endMeter: '218520.4', hoursUsed: '8' }, '8', '120.4'],
    [{ meterType: 'NONE', hoursUsed: '5.5' }, '5.5', null],
  ] as const)('%j → hours %s, distance %s', (input, hours, distance) => {
    expect(usageFromMeters(input)).toEqual({ hours, distance });
  });

  it('subtracts exactly (no float errors)', () => {
    expect(subtractQty('0.3', '0.1')).toBe('0.2');
    expect(subtractQty('1007.125', '1000')).toBe('7.125');
    expect(subtractQty('1', '1.5')).toBe('-0.5');
    expect(subtractQty('10', '10')).toBe('0');
  });
});

describe('allocation create', () => {
  const base = {
    workerIds: [uuid],
    projectId: uuid2,
    fromDate: '2026-10-12',
    startTime: '08:00',
    endTime: '17:00',
  };
  it('accepts a single day and a range', () => {
    expect(workerAllocationCreateSchema.safeParse(base).success).toBe(true);
    expect(workerAllocationCreateSchema.safeParse({ ...base, toDate: '2026-10-18' }).success).toBe(
      true,
    );
  });
  it.each([
    [{ startTime: '17:00', endTime: '08:00' }, 'END_TIME_BEFORE_START'],
    [{ startTime: '8:00' }, 'INVALID_TIME'],
    [{ toDate: '2026-10-11' }, 'END_BEFORE_START'],
    [{ toDate: '2027-01-31' }, 'RANGE_TOO_LONG'],
    [{ workerIds: [] }, 'REQUIRED'],
  ])('rejects %j with %s', (patch, message) => {
    expect(messages(workerAllocationCreateSchema.safeParse({ ...base, ...patch }))).toContain(
      message,
    );
  });
});

describe('daily entry save', () => {
  it('flags duplicate workers and an end meter below the start', () => {
    const r = dailyEntrySaveSchema.safeParse({
      date: '2026-10-14',
      projectId: uuid,
      attendance: [
        { workerId: uuid2, status: 'PRESENT' },
        { workerId: uuid2, status: 'ABSENT' },
      ],
      usage: [{ assetId: uuid, startMeter: '10', endMeter: '9.5' }],
      expenses: [],
    });
    expect(messages(r).sort()).toEqual(['DUPLICATE_WORKER', 'END_METER_BEFORE_START']);
  });

  it('turns empty optional values into null', () => {
    const r = dailyEntrySaveSchema.parse({
      date: '2026-10-14',
      projectId: uuid,
      attendance: [{ workerId: uuid2, status: 'HALF_DAY', otHours: '', notes: '' }],
      usage: [],
      expenses: [
        { category: 'MEALS', description: 'Tea', amount: '450', paidBy: 'CASH', supplierId: '' },
      ],
    });
    expect(r.attendance[0]).toMatchObject({ otHours: null, notes: null });
    expect(r.expenses[0]!.supplierId).toBeNull();
  });
});

describe('money rules', () => {
  it('a credit expense needs a supplier; amounts must be positive', () => {
    const base = { date: '2026-10-14', category: 'OTHER', description: 'x', paidBy: 'CASH' };
    expect(messages(expenseCreateSchema.safeParse({ ...base, amount: '0' }))).toContain(
      'MUST_BE_POSITIVE',
    );
    expect(
      messages(expenseCreateSchema.safeParse({ ...base, amount: '10', paidBy: 'CREDIT' })),
    ).toContain('SUPPLIER_REQUIRED_FOR_CREDIT');
  });

  it('a purchase needs lines with a positive quantity', () => {
    const base = { supplierId: uuid, date: '2026-10-14', paymentType: 'CASH' };
    expect(messages(purchaseCreateSchema.safeParse({ ...base, lines: [] }))).toContain('NO_LINES');
    expect(
      messages(
        purchaseCreateSchema.safeParse({
          ...base,
          lines: [{ materialId: uuid2, quantity: '0', unitPrice: '10' }],
        }),
      ),
    ).toContain('MUST_BE_POSITIVE');
  });

  it('advance recovery per month cannot exceed the amount', () => {
    expect(
      messages(
        advanceCreateSchema.safeParse({
          date: '2026-10-14',
          amount: '1000',
          recoveryPerMonth: '1500',
        }),
      ),
    ).toEqual(['RECOVERY_MORE_THAN_AMOUNT']);
  });
});
