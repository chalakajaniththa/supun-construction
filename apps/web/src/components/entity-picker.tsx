'use client';

import type { Paginated } from '@sc/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebounced } from '@/hooks/use-list-state';
import type { ListParams, Resource } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export interface PickerItem {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Searchable select over an API resource (clients, workers, …). Shows the first 20 matches.
 * `toItem` maps a row to its label.
 */
export function EntityPicker<T extends { id: string }>({
  resource,
  params,
  value,
  onChange,
  toItem,
  selectedLabel,
  id,
  invalid,
  allowClear = false,
  placeholder,
}: {
  resource: Resource;
  params?: ListParams;
  value: string | null | undefined;
  onChange: (id: string, row: T | null) => void;
  toItem: (row: T) => PickerItem;
  /** Label to show for the current value before the list has loaded. */
  selectedLabel?: string;
  id?: string;
  invalid?: boolean;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const query = { pageSize: 20, ...params, search: debounced || undefined };
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.list(resource, { picker: true, ...query }),
    queryFn: ({ signal }) => api<Paginated<T>>(`/${resource}`, { query, signal }),
    enabled: open || Boolean(value && !selectedLabel),
  });
  const rows = data?.items ?? [];
  const current = rows.find((r) => r.id === value);
  const label = current ? toItem(current).label : value ? selectedLabel : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className={cn(
              'h-11 w-full justify-between text-base font-normal',
              !label && 'text-muted-foreground',
            )}
          >
            <span className="truncate">{label ?? placeholder ?? t('choose')}</span>
            <ChevronsUpDown className="size-4 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        {allowClear && value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={t('clear')}
            onClick={() => onChange('', null)}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-2" align="start">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="h-10 pl-9"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto" role="listbox">
          {rows.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {isFetching ? t('loading') : t('noResults')}
            </li>
          ) : (
            rows.map((row) => {
              const item = toItem(row);
              const selected = row.id === value;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      onChange(row.id, row);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn('size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.hint ? (
                        <span className="block truncate text-sm text-muted-foreground">
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
