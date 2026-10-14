'use client';

import { useEffect, useState } from 'react';

/** A value that only follows `value` after it stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Page / search / filter state for a server-driven list. Changing a filter goes back to page 1. */
export function useListState<F extends Record<string, string | undefined>>(initialFilters: F) {
  const [page, setPage] = useState(1);
  const [search, setSearchValue] = useState('');
  const [filters, setFilters] = useState<F>(initialFilters);
  const debouncedSearch = useDebounced(search.trim());

  return {
    page,
    setPage,
    search,
    setSearch: (v: string) => {
      setSearchValue(v);
      setPage(1);
    },
    filters,
    setFilter: <K extends keyof F>(key: K, value: F[K]) => {
      setFilters((f) => ({ ...f, [key]: value }));
      setPage(1);
    },
    /** Query params for useList(). */
    params: { page, pageSize: 20, search: debouncedSearch || undefined, ...filters },
  };
}
