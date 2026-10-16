'use client';

import type { BackupStatusDto } from '@sc/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

const IDLE_MS = 60_000;
const BUSY_MS = 3_000;

/** GET /backup/status — every minute, every 3 s while a backup is waiting or running. */
export function useBackupStatus(opts: { fast?: boolean } = {}) {
  return useQuery({
    queryKey: ['backup', 'status'],
    queryFn: ({ signal }) => api<BackupStatusDto>('/backup/status', { signal }),
    refetchInterval: (q) =>
      opts.fast || q.state.data?.running || q.state.data?.pending ? BUSY_MS : IDLE_MS,
  });
}
