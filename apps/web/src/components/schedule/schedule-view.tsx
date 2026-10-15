'use client';

import {
  type AllocationDto,
  type AllocationKind,
  type AssetDto,
  type Paginated,
  type WorkerDto,
  colomboDay,
  colomboTime,
  mondayOf,
  shiftDay,
} from '@sc/shared';
import { ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EnumFilter, useEnumLabel } from '@/components/forms/enum-select';
import { PageHeader } from '@/components/page-header';
import { Segmented } from '@/components/segmented';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounced } from '@/hooks/use-list-state';
import { useApi } from '@/hooks/use-resource';
import { formatDate, formatWeekday, todayInColombo } from '@/lib/format';
import { projectColor } from '@/lib/project-colors';
import { cn } from '@/lib/utils';
import { AllocationDialog, AssignDialog } from './allocation-dialogs';

interface Row {
  id: string;
  code: string;
  name: string;
  hint: string;
}

/** Week view of the plan: rows = workers or machines, columns = days, blocks = bookings. */
export function ScheduleView() {
  const t = useTranslations('schedule');
  const tc = useTranslations('common');
  const enumLabel = useEnumLabel();
  const today = todayInColombo();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const [kind, setKind] = useState<AllocationKind>('worker');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | undefined>();
  const debounced = useDebounced(search.trim());
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));

  const workers = useApi<Paginated<WorkerDto>>(
    'workers',
    '/workers',
    { active: true, pageSize: 100, search: debounced || undefined, skill: filter },
    { enabled: kind === 'worker' },
  );
  const assets = useApi<Paginated<AssetDto>>(
    'assets',
    '/assets',
    { pageSize: 100, search: debounced || undefined, category: filter },
    { enabled: kind === 'asset' },
  );
  const allocations = useApi<AllocationDto[]>('allocations', '/allocations', {
    kind,
    from: days[0],
    to: days[6],
  });

  const rows: Row[] =
    kind === 'worker'
      ? (workers.data?.items ?? []).map((w) => ({
          id: w.id,
          code: w.code,
          name: w.fullName,
          hint: enumLabel('WorkerSkill', w.skill),
        }))
      : (assets.data?.items ?? [])
          .filter((a) => a.status !== 'DISPOSED')
          .map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            hint: [a.registrationNo, enumLabel('AssetCategory', a.category)]
              .filter(Boolean)
              .join(' · '),
          }));
  const byCell = new Map<string, AllocationDto[]>();
  const projects = new Map<string, AllocationDto['project']>();
  for (const a of allocations.data ?? []) {
    const rid = (kind === 'worker' ? a.workerId : a.assetId) ?? '';
    const key = `${rid}|${colomboDay(a.startAt)}`;
    byCell.set(key, [...(byCell.get(key) ?? []), a]);
    projects.set(a.projectId, a.project);
  }
  const loading = (kind === 'worker' ? workers : assets).isLoading || allocations.isLoading;

  const [cell, setCell] = useState<{
    resource: Row | null;
    date: string;
    allocation: AllocationDto | null;
  } | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  // "Assign" starts today when this week is shown, else on the Monday shown.
  const assignFrom = monday <= today && today <= days[6]! ? today : monday;

  const switchKind = (k: AllocationKind) => {
    setKind(k);
    setFilter(undefined);
    setSearch('');
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button
            size="lg"
            className="h-11 text-base"
            onClick={() => setAssignOpen(true)}
            data-testid="assign-open"
          >
            <Users aria-hidden />
            {kind === 'worker' ? t('assignTeam') : t('assignMachines')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={t('previousWeek')}
            onClick={() => setMonday(shiftDay(monday, -7))}
            data-testid="week-prev"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 text-base"
            onClick={() => setMonday(mondayOf(today))}
          >
            {t('thisWeek')}
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={t('nextWeek')}
            onClick={() => setMonday(shiftDay(monday, 7))}
            data-testid="week-next"
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <p className="min-w-56 text-lg font-semibold" data-testid="week-label">
          {formatDate(days[0])} – {formatDate(days[6])}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            label={t('show')}
            value={kind}
            onChange={switchKind}
            testId="kind-toggle"
            options={[
              { value: 'worker', label: t('workers') },
              { value: 'asset', label: t('machines') },
            ]}
          />
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tc('search')}
            aria-label={tc('search')}
            className="h-10 pl-9"
          />
        </div>
        {kind === 'worker' ? (
          <EnumFilter
            key="skill"
            enumName="WorkerSkill"
            value={filter}
            onChange={(v) => setFilter(v || undefined)}
            allLabel={t('allSkills')}
          />
        ) : (
          <EnumFilter
            key="category"
            enumName="AssetCategory"
            value={filter}
            onChange={(v) => setFilter(v || undefined)}
            allLabel={t('allCategories')}
          />
        )}
      </div>

      <Card className="py-0">
        <CardContent className="overflow-x-auto p-0">
          <table
            className="w-full min-w-[900px] table-fixed border-collapse"
            data-testid="schedule-grid"
          >
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="w-44 px-3 py-2 text-left text-sm font-medium text-muted-foreground">
                  {kind === 'worker' ? t('workers') : t('machines')}
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={cn(
                      'px-2 py-2 text-left text-sm font-medium',
                      d === today && 'bg-primary/10 text-primary',
                    )}
                  >
                    {formatWeekday(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={8} className="p-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {tc('noResults')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b align-top last:border-b-0"
                    data-testid={`row-${r.code}`}
                  >
                    <td className="px-3 py-2">
                      <p className="truncate font-medium" title={r.name}>
                        {r.name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {r.code} · {r.hint}
                      </p>
                    </td>
                    {days.map((d) => {
                      const blocks = byCell.get(`${r.id}|${d}`) ?? [];
                      return (
                        <td
                          key={d}
                          className={cn('group border-l p-1', d === today && 'bg-primary/5')}
                          data-testid={`cell-${r.code}-${d}`}
                        >
                          <div className="flex min-h-14 flex-col gap-1">
                            {blocks.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => setCell({ resource: r, date: d, allocation: a })}
                                className={cn(
                                  'rounded-md border-l-4 px-1.5 py-1 text-left text-xs leading-tight shadow-xs hover:brightness-95',
                                  projectColor(a.projectId),
                                )}
                                title={`${a.project.name} ${colomboTime(a.startAt)}–${colomboTime(a.endAt)}`}
                                data-testid="allocation-block"
                              >
                                <span className="line-clamp-2 font-semibold break-words">
                                  {a.project.name}
                                </span>
                                <span className="block tabular-nums">
                                  {colomboTime(a.startAt)}–{colomboTime(a.endAt)}
                                </span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setCell({ resource: r, date: d, allocation: null })}
                              className="flex min-h-6 flex-1 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100"
                              aria-label={t('addFor', { name: r.name, date: formatDate(d) })}
                              data-testid="cell-add"
                            >
                              <Plus className="size-4" aria-hidden />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {projects.size ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="schedule-legend">
          <span className="text-sm text-muted-foreground">{t('legend')}:</span>
          {[...projects.values()].map((p) => (
            <span
              key={p.id}
              className={cn('rounded-md border-l-4 px-2 py-0.5 text-sm', projectColor(p.id))}
            >
              {p.name}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">{t('help')}</p>

      <AllocationDialog
        open={cell !== null}
        onOpenChange={(o) => !o && setCell(null)}
        kind={kind}
        resource={cell?.resource ?? null}
        date={cell?.date ?? today}
        allocation={cell?.allocation ?? null}
      />
      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        kind={kind}
        defaultFrom={assignFrom}
        defaultTo={days[5]! >= assignFrom ? days[5] : assignFrom}
      />
    </>
  );
}
