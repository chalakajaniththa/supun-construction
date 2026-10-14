import { describe, expect, it } from 'vitest';
import { paginationQuerySchema } from '@sc/shared';
import { paginated, toSkipTake } from './pagination.js';

describe('pagination', () => {
  it('computes skip/take', () => {
    expect(toSkipTake({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it('parses query strings with defaults and limits', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, search: undefined });
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '50', search: ' abc ' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'abc',
    });
    expect(paginationQuerySchema.safeParse({ pageSize: '1000' }).success).toBe(false);
  });

  it('builds the response shape', () => {
    expect(paginated(['a'], 1, { page: 1, pageSize: 20 })).toEqual({
      items: ['a'],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });
});
