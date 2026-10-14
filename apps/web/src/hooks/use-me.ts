'use client';

import type { MeResponse } from '@sc/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api<MeResponse>('/auth/me', { signal }),
    staleTime: 5 * 60_000,
  });
}
