/** TanStack Query keys, in one place so invalidation stays consistent. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  settings: ['settings'] as const,
  audit: (params: Record<string, unknown>) => ['audit', params] as const,
};
