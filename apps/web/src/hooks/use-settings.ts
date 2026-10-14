'use client';

import type { SettingKey, SettingsMap } from '@sc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: ({ signal }) => api<SettingsMap>('/settings', { signal }),
  });
}

export function useUpdateSetting<K extends SettingKey>(key: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SettingsMap[K]>) =>
      api<SettingsMap[K]>(`/settings/${key}`, { method: 'PATCH', body }),
    onSuccess: (value) => {
      qc.setQueryData<SettingsMap>(queryKeys.settings, (old) =>
        old ? { ...old, [key]: value } : old,
      );
    },
  });
}
