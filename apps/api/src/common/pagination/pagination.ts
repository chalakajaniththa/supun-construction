import type { Paginated, PaginationQuery } from '@sc/shared';

/** Prisma `skip` / `take` for a page. */
export function toSkipTake(q: Pick<PaginationQuery, 'page' | 'pageSize'>): {
  skip: number;
  take: number;
} {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export function paginated<T>(
  items: T[],
  total: number,
  q: Pick<PaginationQuery, 'page' | 'pageSize'>,
): Paginated<T> {
  return { items, total, page: q.page, pageSize: q.pageSize };
}
