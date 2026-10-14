/** TanStack Query keys, in one place so invalidation stays consistent. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  settings: ['settings'] as const,
  audit: (params: Record<string, unknown>) => ['audit', params] as const,
  /** Every query of a resource ("clients", "projects", …) starts with its name. */
  resource: (resource: string) => [resource] as const,
  list: (resource: string, params: Record<string, unknown>) => [resource, 'list', params] as const,
  detail: (resource: string, id: string) => [resource, 'detail', id] as const,
  sub: (resource: string, id: string, sub: string) => [resource, 'detail', id, sub] as const,
};
