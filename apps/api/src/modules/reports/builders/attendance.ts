import type { AttendanceStatus } from '@sc/shared';
import { sum } from '../../../common/money/money.js';
import { totalQty, type BuildContext, type Cell, type Column, type ReportDoc } from '../model.js';
import { monthFilter, named } from './common.js';

export interface AttendanceReportInput {
  month: string;
  project: { code: string; name: string } | null;
  workers: {
    code: string;
    name: string;
    records: { date: string; status: AttendanceStatus; otHours: string }[];
  }[];
}

const FRACTION: Record<AttendanceStatus, string> = {
  PRESENT: '1',
  HALF_DAY: '0.5',
  ABSENT: '0',
  LEAVE: '0',
};

/** Days of a "YYYY-MM" month: ["2026-10-01", …]. */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** R5 — a month grid: one row per worker, a column per day (P / H / A / L), totals at the end. */
export function buildAttendance(input: AttendanceReportInput, { t }: BuildContext): ReportDoc {
  const days = daysOfMonth(input.month);
  const code = (s: AttendanceStatus) => t(`reports.attendance.codes.${s}`);
  const columns: Column[] = [
    { key: 'code', label: t('reports.common.code'), type: 'text' },
    { key: 'name', label: t('reports.common.name'), type: 'text' },
    ...days.map((d) => ({
      key: d,
      label: String(Number(d.slice(8))),
      type: 'text' as const,
      width: 3,
    })),
    { key: 'worked', label: t('reports.attendance.worked'), type: 'qty' },
    { key: 'absent', label: t('reports.attendance.absent'), type: 'int' },
    { key: 'leave', label: t('reports.attendance.leave'), type: 'int' },
    { key: 'ot', label: t('reports.attendance.ot'), type: 'qty' },
  ];
  const rows = input.workers.map((w) => {
    const row: Record<string, Cell> = { code: w.code, name: w.name };
    for (const r of w.records) row[r.date] = code(r.status);
    row.worked = sum(w.records.map((r) => FRACTION[r.status])).toString();
    row.absent = w.records.filter((r) => r.status === 'ABSENT').length;
    row.leave = w.records.filter((r) => r.status === 'LEAVE').length;
    row.ot = sum(w.records.map((r) => r.otHours))
      .toDecimalPlaces(3)
      .toString();
    return row;
  });
  const totals: Record<string, Cell> = { name: t('reports.common.total') };
  for (const d of days) {
    const present = sum(
      input.workers.flatMap((w) =>
        w.records.filter((r) => r.date === d).map((r) => FRACTION[r.status]),
      ),
    );
    totals[d] = present.isZero() ? null : present.toString();
  }
  totals.worked = totalQty(rows.map((r) => r.worked as string));
  totals.absent = rows.reduce((a, r) => a + Number(r.absent), 0);
  totals.leave = rows.reduce((a, r) => a + Number(r.leave), 0);
  totals.ot = totalQty(rows.map((r) => r.ot as string));
  const legend = (['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE'] as const)
    .map((s) => `${code(s)} = ${t(`enums.attendanceStatus.${s}`)}`)
    .join(' · ');
  return {
    title: t('reports.list.attendance.name'),
    subtitle: monthFilter(t, input.month).value,
    filters: [
      {
        label: t('reports.common.project'),
        value: input.project
          ? named(input.project.name, input.project.code)
          : t('reports.common.allProjects'),
      },
    ],
    landscape: true,
    filename: `attendance_${input.month}${input.project ? `_${input.project.code}` : ''}`,
    sections: [
      {
        kind: 'table',
        sheet: t('reports.attendance.sheet'),
        note: legend,
        dense: true,
        columns,
        rows,
        totals,
      },
    ],
  };
}
