import { describe, expect, it } from 'vitest';
import {
  bondReminders,
  daysUntil,
  deadlineReminders,
  documentReminders,
  expiryThreshold,
  reconcile,
  serviceReminders,
  severityForDays,
  type ReminderCandidate,
} from './rules.js';

const TODAY = '2026-10-15';
const DAYS = [30, 14, 7];

describe('daysUntil', () => {
  it.each([
    ['2026-10-15', 0],
    ['2026-10-16', 1],
    ['2026-10-14', -1],
    ['2026-11-01', 17],
    ['2027-01-01', 78],
  ])('%s → %i', (day, n) => expect(daysUntil(TODAY, day)).toBe(n));
});

describe('expiryThreshold', () => {
  it.each([
    [-1, 'expired'],
    [-400, 'expired'],
    [0, '7'],
    [7, '7'],
    [8, '14'],
    [14, '14'],
    [15, '30'],
    [30, '30'],
    [31, null],
  ])('%i days left → %s', (left, step) => expect(expiryThreshold(left, DAYS)).toBe(step));

  it('works with one configured value and unsorted lists', () => {
    expect(expiryThreshold(45, [60])).toBe('60');
    expect(expiryThreshold(5, [7, 30])).toBe('7');
    expect(expiryThreshold(10, [])).toBeNull();
    expect(expiryThreshold(-1, [])).toBe('expired');
  });
});

describe('severityForDays', () => {
  it.each([
    [-1, 'DANGER'],
    [0, 'WARNING'],
    [7, 'WARNING'],
    [8, 'INFO'],
    [30, 'INFO'],
  ])('%i → %s', (left, sev) => expect(severityForDays(left)).toBe(sev));
});

const doc = (
  expiryDate: string,
  extra: Partial<Parameters<typeof documentReminders>[0][0]> = {},
) => ({
  documentId: 'd1',
  versionId: 'v1',
  title: 'Insurance 2026',
  category: 'INSURANCE',
  ownerType: 'ASSET',
  ownerId: 'a1',
  ownerName: 'JCB 1',
  ownerCode: 'AST-001',
  expiryDate,
  ...extra,
});

describe('documentReminders', () => {
  it('creates one reminder per expiring current version with the right step', () => {
    const r = documentReminders(
      [
        doc('2026-10-20'),
        doc('2026-10-01', { documentId: 'd2' }),
        doc('2027-03-01', { documentId: 'd3' }),
      ],
      TODAY,
      DAYS,
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      type: 'DOCUMENT_EXPIRY',
      severity: 'WARNING',
      titleKey: 'documentExpires',
      entityType: 'DOCUMENT',
      entityId: 'd1',
      dueDate: '2026-10-20',
      dedupeKey: 'doc:d1:v1:7',
      params: { category: 'INSURANCE', ownerCode: 'AST-001', ownerType: 'ASSET' },
    });
    expect(r[1]).toMatchObject({
      severity: 'DANGER',
      titleKey: 'documentExpired',
      dedupeKey: 'doc:d2:v1:expired',
    });
  });

  it('is INFO a month ahead and expires "today" as WARNING', () => {
    expect(documentReminders([doc('2026-11-10')], TODAY, DAYS)[0]!.severity).toBe('INFO');
    const today = documentReminders([doc(TODAY)], TODAY, DAYS)[0]!;
    expect(today.severity).toBe('WARNING');
    expect(today.titleKey).toBe('documentExpires');
  });

  it('a new version (new id, later expiry) gives a different key or nothing', () => {
    const old = documentReminders([doc('2026-10-20')], TODAY, DAYS);
    const renewed = documentReminders([doc('2027-10-20', { versionId: 'v2' })], TODAY, DAYS);
    expect(old).toHaveLength(1);
    expect(renewed).toHaveLength(0);
  });
});

describe('bondReminders', () => {
  const bond = (expiryDate: string) => ({
    bondId: 'b1',
    type: 'PERFORMANCE_BOND',
    referenceNo: 'PB-1',
    bank: 'BOC',
    projectId: 'p1',
    projectCode: 'PRJ-2026-001',
    projectName: 'Road',
    expiryDate,
  });

  it.each([
    ['2026-11-04', 'INFO', 'bondExpires', 'bond:b1:2026-11-04:30'],
    ['2026-10-25', 'INFO', 'bondExpires', 'bond:b1:2026-10-25:14'],
    ['2026-10-22', 'WARNING', 'bondExpires', 'bond:b1:2026-10-22:7'],
    ['2026-10-10', 'DANGER', 'bondExpired', 'bond:b1:2026-10-10:expired'],
  ])('expiry %s → %s', (expiry, severity, titleKey, key) => {
    const [r] = bondReminders([bond(expiry)], TODAY, DAYS);
    expect(r).toMatchObject({ severity, titleKey, dedupeKey: key, entityType: 'BOND' });
    expect(r!.params.projectId).toBe('p1');
  });

  it('ignores bonds further away than the largest setting', () => {
    expect(bondReminders([bond('2026-12-31')], TODAY, DAYS)).toEqual([]);
  });
});

describe('serviceReminders', () => {
  const asset = (currentMeter: string, extra = {}) => ({
    assetId: 'a1',
    code: 'AST-001',
    name: 'JCB 1',
    meterType: 'HOURS' as const,
    currentMeter,
    lastServiceMeter: '1000',
    serviceIntervalMeter: '250',
    ...extra,
  });

  it.each([
    ['1200', null],
    ['1225', 'WARNING'],
    ['1250', 'DANGER'],
    ['1400', 'DANGER'],
  ])('meter %s → %s', (meter, severity) => {
    const r = serviceReminders([asset(meter)]);
    if (!severity) expect(r).toEqual([]);
    else {
      expect(r[0]!.severity).toBe(severity);
      expect(r[0]!.titleKey).toBe(severity === 'DANGER' ? 'serviceOverdue' : 'serviceDue');
      expect(r[0]!.params.dueAt).toBe('1250');
    }
  });

  it('a service (new last-service reading) clears the reminder and changes the key', () => {
    const before = serviceReminders([asset('1240')]);
    expect(before[0]!.dedupeKey).toBe('asset:a1:service:1000:DUE_SOON');
    expect(serviceReminders([asset('1240', { lastServiceMeter: '1240' })])).toEqual([]);
  });

  it('skips machines that are not tracked', () => {
    expect(serviceReminders([asset('5000', { meterType: 'NONE' })])).toEqual([]);
    expect(serviceReminders([asset('5000', { serviceIntervalMeter: null })])).toEqual([]);
  });
});

describe('deadlineReminders', () => {
  const project = (currentEndDate: string, status = 'ONGOING' as const) => ({
    projectId: 'p1',
    code: 'PRJ-2026-001',
    name: 'Road',
    status,
    currentEndDate,
  });

  it.each([
    ['2026-10-30', null],
    ['2026-10-29', 'INFO'],
    ['2026-10-22', 'WARNING'],
    ['2026-10-15', 'WARNING'],
    ['2026-10-14', 'DANGER'],
  ])('end %s → %s', (end, severity) => {
    const r = deadlineReminders([project(end)], TODAY);
    if (!severity) expect(r).toEqual([]);
    else expect(r[0]!.severity).toBe(severity);
  });

  it('only for ONGOING projects', () => {
    expect(deadlineReminders([project('2026-10-20', 'ON_HOLD' as never)], TODAY)).toEqual([]);
  });

  it('a new end date (extension of time) changes the key', () => {
    expect(deadlineReminders([project('2026-10-20')], TODAY)[0]!.dedupeKey).toBe(
      'project:p1:deadline:2026-10-20:7',
    );
  });
});

describe('reconcile', () => {
  const cand = (key: string): ReminderCandidate => ({
    type: 'DOCUMENT_EXPIRY',
    severity: 'INFO',
    titleKey: 'documentExpires',
    params: {},
    entityType: 'DOCUMENT',
    entityId: 'd',
    dueDate: null,
    dedupeKey: key,
  });

  it('creates new, updates existing, reopens resolved and resolves cleared ones', () => {
    const plan = reconcile(
      [
        { id: '1', dedupeKey: 'a', resolvedAt: null },
        { id: '2', dedupeKey: 'b', resolvedAt: new Date() },
        { id: '3', dedupeKey: 'c', resolvedAt: null },
        { id: '4', dedupeKey: 'd', resolvedAt: new Date() },
      ],
      [cand('a'), cand('b'), cand('e'), cand('e')],
    );
    expect(plan.create.map((c) => c.dedupeKey)).toEqual(['e']);
    expect(plan.update).toEqual([
      { id: '1', candidate: cand('a'), reopen: false },
      { id: '2', candidate: cand('b'), reopen: true },
    ]);
    expect(plan.resolve).toEqual(['3']);
  });

  it('is idempotent (dedupe): running twice with the same state changes nothing new', () => {
    const first = reconcile([], [cand('a')]);
    expect(first.create).toHaveLength(1);
    const second = reconcile([{ id: '1', dedupeKey: 'a', resolvedAt: null }], [cand('a')]);
    expect(second.create).toHaveLength(0);
    expect(second.resolve).toHaveLength(0);
  });
});
