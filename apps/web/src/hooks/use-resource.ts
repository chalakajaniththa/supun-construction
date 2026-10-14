'use client';

import type { Paginated } from '@sc/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

/** REST resources of the API (plural nouns). */
export type Resource =
  'clients' | 'projects' | 'workers' | 'assets' | 'suppliers' | 'materials' | 'documents';

export type ListParams = Record<string, string | number | boolean | undefined | null>;

/** GET /<resource>?… — keeps the previous page on screen while the next one loads. */
export function useList<T>(
  resource: Resource,
  params: ListParams,
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.list(resource, params),
    queryFn: ({ signal }) => api<Paginated<T>>(`/${resource}`, { query: params, signal }),
    placeholderData: keepPreviousData,
    enabled: opts.enabled,
  });
}

/** GET /<resource>/:id */
export function useDetail<T>(resource: Resource, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.detail(resource, id ?? ''),
    queryFn: ({ signal }) => api<T>(`/${resource}/${id}`, { signal }),
    enabled: Boolean(id),
  });
}

/** Invalidates everything cached for the given resources (lists and details). */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...resources: Resource[]) =>
    Promise.all(resources.map((r) => qc.invalidateQueries({ queryKey: queryKeys.resource(r) })));
}

/** POST / PATCH / PUT / DELETE on a resource; invalidates its queries (and `also`) on success. */
export function useResourceMutation<TBody, TResult>(
  resource: Resource,
  request: (body: TBody) => {
    path: string;
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
  },
  opts: { also?: Resource[] } = {},
) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: TBody) => {
      const r = request(body);
      return api<TResult>(r.path, { method: r.method, body: r.body });
    },
    onSuccess: () => invalidate(resource, ...(opts.also ?? [])),
  });
}

export function useCreate<TBody, TResult = unknown>(
  resource: Resource,
  opts?: { also?: Resource[] },
) {
  return useResourceMutation<TBody, TResult>(
    resource,
    (body) => ({ path: `/${resource}`, method: 'POST', body }),
    opts,
  );
}

export function useUpdate<TBody, TResult = unknown>(
  resource: Resource,
  id: string,
  opts?: { also?: Resource[] },
) {
  return useResourceMutation<TBody, TResult>(
    resource,
    (body) => ({ path: `/${resource}/${id}`, method: 'PATCH', body }),
    opts,
  );
}

export function useRemove(resource: Resource, opts?: { also?: Resource[] }) {
  return useResourceMutation<string, { id: string }>(
    resource,
    (id) => ({ path: `/${resource}/${id}`, method: 'DELETE' }),
    opts,
  );
}
