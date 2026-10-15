import type { NotificationDto, ProjectHealthDto } from '@sc/shared';
import { describe, expect, it } from 'vitest';
import {
  buildSeries,
  healthAttention,
  lastMonths,
  mergeAttention,
  monthBounds,
  sumMoney,
  workersOnSite,
} from './dashboard.js';

describe('lastMonths', () => {
  it('counts back across the year boundary', () => {
    expect(lastMonths('2026-02', 6)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(lastMonths('2026-10', 1)).toEqual(['2026-10']);
  });
});

describe('monthBounds', () => {
  it('ends the current month today and others on their last day', () => {
    expect(monthBounds('2026-10', '2026-10-15')).toEqual({
      month: '2026-10',
      from: '2026-10-01',
      to: '2026-10-15',
    });
    expect(monthBounds('2026-02', '2026-10-15')).toEqual({
      month: '2026-02',
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(monthBounds('2028-02', '2028-10-15').to).toBe('2028-02-29');
  });
});

describe('workersOnSite', () => {
  it('uses recorded attendance (distinct workers) when there is any', () => {
    expect(workersOnSite(['a', 'b', 'a'], ['x', 'y', 'z'])).toEqual({
      count: 2,
      source: 'ATTENDANCE',
    });
  });
  it("falls back to today's plan", () => {
    expect(workersOnSite([], ['x', 'y', 'x'])).toEqual({ count: 2, source: 'PLAN' });
    expect(workersOnSite([], [])).toEqual({ count: 0, source: 'PLAN' });
  });
});

describe('buildSeries', () => {
  it('sums spend per month exactly and buckets payments by month', () => {
    const s = buildSeries(
      ['2026-09', '2026-10'],
      new Map([
        ['2026-09', ['0.10', '0.20']],
        ['2026-10', []],
      ]),
      [
        { date: '2026-09-30', amount: '1000.005' },
        { date: '2026-10-01', amount: '250' },
        { date: '2026-08-31', amount: '999' },
      ],
    );
    expect(s).toEqual([
      { month: '2026-09', spent: '0.30', received: '1000.01' },
      { month: '2026-10', spent: '0.00', received: '250.00' },
    ]);
  });

  it('sumMoney is exact (no float drift)', () => {
    expect(sumMoney(['0.1', '0.2', '1250000.35'])).toBe('1250000.65');
  });
});

const project = (flags: ProjectHealthDto['flags']): ProjectHealthDto => ({
  projectId: 'p1',
  code: 'PRJ-2026-002',
  name: 'School',
  status: 'ONGOING',
  clientName: 'Society',
  timePct: '60',
  budgetPct: '40',
  physicalPct: '30',
  physicalSource: 'BOQ',
  budget: '100',
  actual: '40',
  estimated: false,
  currentEndDate: '2027-01-01',
  flags,
});

const note = (
  id: string,
  severity: NotificationDto['severity'],
  dueDate: string | null,
): NotificationDto => ({
  id,
  type: 'DOCUMENT_EXPIRY',
  severity,
  titleKey: 'documentExpires',
  params: {},
  entityType: 'DOCUMENT',
  entityId: id,
  dueDate,
  readAt: null,
  resolvedAt: null,
  createdAt: '2026-10-15T00:00:00.000Z',
});

describe('healthAttention', () => {
  it('turns each flag into an item (over budget = DANGER)', () => {
    const items = healthAttention(
      [project(['OVER_BUDGET', 'BEHIND_SCHEDULE']), project([])],
      'now',
    );
    expect(items.map((i) => [i.severity, i.titleKey, i.entityType])).toEqual([
      ['DANGER', 'overBudget', 'PROJECT'],
      ['WARNING', 'behindSchedule', 'PROJECT'],
    ]);
    expect(items[0]!.params.projectCode).toBe('PRJ-2026-002');
  });
});

describe('mergeAttention', () => {
  it('orders by severity, then due date, and caps the list', () => {
    const r = mergeAttention(
      [
        note('a', 'INFO', '2026-10-20'),
        note('b', 'WARNING', '2026-10-30'),
        note('c', 'WARNING', '2026-10-18'),
        note('d', 'DANGER', null),
      ],
      healthAttention([project(['COST_AHEAD_OF_PROGRESS'])], 'now'),
      3,
    );
    expect(r.items.map((i) => i.id)).toEqual(['d', 'c', 'b']);
    expect(r.total).toBe(5);
  });
});
