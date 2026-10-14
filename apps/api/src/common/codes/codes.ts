import { PG_UNIQUE_VIOLATION, constraintName, findPgCode } from '../errors/prisma-error.mapper.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Tables with a human `code` column (overview §4 conventions). */
export type CodedTable = 'Project' | 'Worker' | 'Asset' | 'Supplier';

/** "W-" + 7 → "W-0007" (more digits once the width is used up: "W-10000"). */
export function formatCode(prefix: string, n: number, width: number): string {
  return `${prefix}${String(n).padStart(width, '0')}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The next free code for a prefix, e.g. nextCode(prisma, 'Project', 'PRJ-2026-', 3) → "PRJ-2026-004".
 * Soft-deleted rows count too, so a code is never reused. A race between two creates is caught by
 * the unique index; callers retry (see withCodeRetry).
 */
export async function nextCode(
  prisma: Pick<PrismaService, '$queryRawUnsafe'>,
  table: CodedTable,
  prefix: string,
  width: number,
): Promise<string> {
  const pattern = `^${escapeRegex(prefix)}([0-9]+)$`;
  const rows = await prisma.$queryRawUnsafe<{ max: number | null }[]>(
    `SELECT MAX((substring("code" from $1))::int) AS max FROM "${table}" WHERE "code" ~ $1`,
    pattern,
  );
  return formatCode(prefix, (rows[0]?.max ?? 0) + 1, width);
}

function isUniqueCodeError(err: unknown): boolean {
  const e = err as { code?: string } | undefined;
  if (e?.code !== 'P2002' && findPgCode(err) !== PG_UNIQUE_VIOLATION) return false;
  return /(^|[,_])code($|[,_])/.test(constraintName(err) ?? '');
}

/** Runs `create(code)` and retries a few times when another request took the same code. */
export async function withCodeRetry<T>(
  makeCode: () => Promise<string>,
  create: (code: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  for (let i = 1; ; i++) {
    const code = await makeCode();
    try {
      return await create(code);
    } catch (err) {
      if (i >= attempts || !isUniqueCodeError(err)) throw err;
    }
  }
}
