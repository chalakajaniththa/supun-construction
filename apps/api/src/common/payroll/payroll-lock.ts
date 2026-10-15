import { HttpStatus } from '@nestjs/common';
import { AppException } from '../errors/app-exception.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** { year, month } of a "YYYY-MM-DD" day. */
export function yearMonthOf(day: string): { year: number; month: number } {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

/** The "YYYY-MM" months (of the given days) whose payroll is FINALIZED. */
export async function lockedMonths(db: Db, days: readonly string[]): Promise<Set<string>> {
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];
  if (!months.length) return new Set();
  const runs = await db.payrollRun.findMany({
    where: {
      status: 'FINALIZED',
      OR: months.map((m) => yearMonthOf(`${m}-01`)),
    },
    select: { year: true, month: true },
  });
  return new Set(runs.map((r) => `${r.year}-${String(r.month).padStart(2, '0')}`));
}

/** 409 PAYROLL_LOCKED when any of the days falls in a month whose payroll is finalized. */
export async function assertNotLocked(db: Db, days: readonly string[]): Promise<void> {
  const locked = await lockedMonths(db, days);
  if (locked.size) {
    throw new AppException(
      HttpStatus.CONFLICT,
      'PAYROLL_LOCKED',
      'Salaries for this month are finalized, so attendance cannot be changed.',
      { months: [...locked].sort() },
    );
  }
}
