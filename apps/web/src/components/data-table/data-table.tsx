'use client';

import { type ColumnDef, type RowData, tableFeatures, useTable } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Core-only table (no client-side sorting/filtering): the API pages and searches. */
export const dataTableFeatures = tableFeatures({});
export type DataTableFeatures = typeof dataTableFeatures;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumn<T extends RowData> = ColumnDef<DataTableFeatures, T, any>;

export interface DataTableProps<T extends RowData> {
  columns: DataTableColumn<T>[];
  data: T[] | undefined;
  /** Total rows on the server (for "Showing 1–20 of 57"). */
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  search?: string;
  onSearchChange?: (search: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  getRowId?: (row: T) => string;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
}

const EMPTY: never[] = [];

/** Table with search, server pagination, empty state and loading skeleton. */
export function DataTable<T extends RowData>({
  columns,
  data,
  total,
  page = 1,
  pageSize = 20,
  onPageChange,
  search,
  onSearchChange,
  isLoading,
  emptyMessage,
  getRowId,
  onRowClick,
  toolbar,
}: DataTableProps<T>) {
  const t = useTranslations('common');
  const rows = data ?? (EMPTY as T[]);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId: getRowId ? (row: T) => getRowId(row) : undefined,
  });

  const count = total ?? rows.length;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(count, page * pageSize);

  return (
    <div className="flex flex-col gap-3">
      {onSearchChange || toolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {onSearchChange ? (
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('search')}
                aria-label={t('search')}
                className="h-10 pl-9"
              />
            </div>
          ) : null}
          {toolbar ? <div className="ml-auto flex items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="bg-muted/50 hover:bg-muted/50">
                {group.headers.map((header) => (
                  <TableHead key={header.id} className="h-11 text-sm font-semibold">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} data-testid="table-skeleton">
                  {columns.map((_c, j) => (
                    <TableCell key={j} className="py-3">
                      <Skeleton className="h-5 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-muted-foreground"
                >
                  {emptyMessage ?? t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn('text-[0.95rem]', onRowClick && 'cursor-pointer')}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && count > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{t('pagination.summary', { from, to, total: count })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft aria-hidden />
              {t('pagination.previous')}
            </Button>
            <span className="px-1">{t('pagination.page', { page, pages })}</span>
            <Button
              variant="outline"
              size="lg"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pages}
            >
              {t('pagination.next')}
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
