'use client';

import {
  type AllocationConflict,
  type AllocationDto,
  type AllocationKind,
  type AvailabilityDto,
  DEFAULT_WORK_END,
  DEFAULT_WORK_START,
  type ProjectDto,
  type WorkerDto,
  colomboDay,
  colomboTime,
} from '@sc/shared';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EntityPicker } from '@/components/entity-picker';
import { DateInput } from '@/components/forms/date-input';
import { FormField } from '@/components/forms/form-field';
import { TimeInput } from '@/components/forms/time-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useErrorMessage, useValidationMessage } from '@/hooks/use-error-message';
import { useApi, useInvalidate } from '@/hooks/use-resource';
import { ApiError, api } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ConflictDialog, overlapConflicts } from './conflict-dialog';

export const projectItem = (p: ProjectDto) => ({ id: p.id, label: p.name, hint: p.code });
export const workerItem = (w: WorkerDto) => ({ id: w.id, label: w.fullName, hint: w.code });

/** First field error of a 400 as { path, message }, for showing next to the right input. */
function fieldError(err: unknown): { path: string; message: string } | null {
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return null;
  const d = (err.details as { path?: string; message?: string }[])[0];
  return d?.path && d.message ? { path: d.path, message: d.message } : null;
}

/** One booking for one worker / machine: create (empty cell) or edit (click a block). */
export function AllocationDialog({
  open,
  onOpenChange,
  kind,
  resource,
  date,
  allocation,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AllocationKind;
  resource: { id: string; name: string } | null;
  date: string;
  allocation: AllocationDto | null;
  defaultProjectId?: string;
}) {
  const t = useTranslations('schedule');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const validation = useValidationMessage();
  const invalidate = useInvalidate();
  const init = () => ({
    projectId: allocation?.projectId ?? defaultProjectId ?? '',
    projectLabel: allocation?.project.name,
    date: allocation ? colomboDay(allocation.startAt) : date,
    startTime: allocation ? colomboTime(allocation.startAt) : DEFAULT_WORK_START,
    endTime: allocation ? colomboTime(allocation.endAt) : DEFAULT_WORK_END,
    notes: allocation?.notes ?? '',
    operatorWorkerId: allocation?.operatorWorkerId ?? '',
    operatorLabel: allocation?.operator?.fullName,
  });
  const [form, setForm] = useState(init);
  const [key, setKey] = useState({ open, allocation, date, resource });
  // Re-initialise when the dialog opens for another cell / block ("adjust state during render").
  if (
    key.open !== open ||
    key.allocation !== allocation ||
    key.date !== date ||
    key.resource !== resource
  ) {
    setKey({ open, allocation, date, resource });
    setForm(init());
  }
  const [error, setError] = useState<{ path: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<AllocationConflict[] | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const set = (patch: Partial<ReturnType<typeof init>>) => setForm((f) => ({ ...f, ...patch }));
  const errFor = (path: string) => (error?.path === path ? validation(error.message) : undefined);

  const save = async () => {
    setError(null);
    if (!form.projectId) {
      setError({ path: 'projectId', message: 'REQUIRED' });
      return;
    }
    if (form.endTime <= form.startTime) {
      setError({ path: 'endTime', message: 'END_TIME_BEFORE_START' });
      return;
    }
    setSaving(true);
    try {
      if (allocation) {
        await api(`/allocations/${allocation.id}`, {
          method: 'PATCH',
          body: {
            projectId: form.projectId,
            date: form.date,
            startTime: form.startTime,
            endTime: form.endTime,
            notes: form.notes,
            ...(kind === 'asset' ? { operatorWorkerId: form.operatorWorkerId } : {}),
          },
        });
      } else if (resource) {
        await api(`/allocations/${kind}s`, {
          method: 'POST',
          body: {
            [kind === 'worker' ? 'workerIds' : 'assetIds']: [resource.id],
            projectId: form.projectId,
            fromDate: form.date,
            startTime: form.startTime,
            endTime: form.endTime,
            notes: form.notes,
            ...(kind === 'asset' ? { operatorWorkerId: form.operatorWorkerId } : {}),
          },
        });
      }
      await invalidate('allocations', 'daily-entry');
      toast.success(t('saved'));
      onOpenChange(false);
    } catch (err) {
      const c = overlapConflicts(err);
      if (c) setConflicts(c);
      else {
        const fe = fieldError(err);
        if (fe) setError(fe);
        else toast.error(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const cancelBooking = async () => {
    if (!allocation) return;
    try {
      await api(`/allocations/${allocation.id}/cancel`, { method: 'POST' });
      await invalidate('allocations', 'daily-entry');
      toast.success(t('cancelled'));
      setConfirmCancel(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" data-testid="allocation-dialog">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {allocation ? t('editTitle') : t('addTitle')}
            </DialogTitle>
            <DialogDescription className="text-base">
              {resource?.name ?? allocation?.worker?.fullName ?? allocation?.asset?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="alloc-project"
              label={t('fields.project')}
              error={errFor('projectId') ? { message: error?.message } : undefined}
              className="sm:col-span-2"
            >
              <EntityPicker<ProjectDto>
                id="alloc-project"
                resource="projects"
                value={form.projectId}
                selectedLabel={form.projectLabel}
                onChange={(id, row) => set({ projectId: id, projectLabel: row?.name })}
                toItem={projectItem}
                invalid={Boolean(errFor('projectId'))}
              />
            </FormField>
            <FormField id="alloc-date" label={t('fields.date')} className="sm:col-span-2">
              <DateInput
                id="alloc-date"
                value={form.date}
                onChange={(v) => set({ date: v })}
                className="h-11 text-base"
              />
            </FormField>
            <FormField id="alloc-start" label={t('fields.startTime')}>
              <TimeInput
                id="alloc-start"
                value={form.startTime}
                onChange={(v) => set({ startTime: v })}
              />
            </FormField>
            <FormField
              id="alloc-end"
              label={t('fields.endTime')}
              error={errFor('endTime') ? { message: error?.message } : undefined}
            >
              <TimeInput
                id="alloc-end"
                value={form.endTime}
                onChange={(v) => set({ endTime: v })}
                invalid={Boolean(errFor('endTime'))}
              />
            </FormField>
            {kind === 'asset' ? (
              <FormField id="alloc-operator" label={t('fields.operator')} className="sm:col-span-2">
                <EntityPicker<WorkerDto>
                  id="alloc-operator"
                  resource="workers"
                  params={{ active: true }}
                  value={form.operatorWorkerId}
                  selectedLabel={form.operatorLabel}
                  onChange={(id, row) =>
                    set({ operatorWorkerId: id, operatorLabel: row?.fullName })
                  }
                  toItem={workerItem}
                  allowClear
                />
              </FormField>
            ) : null}
            <FormField id="alloc-notes" label={t('fields.notes')} className="sm:col-span-2">
              <Input
                id="alloc-notes"
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
                className="h-11 text-base"
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {allocation ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 text-base text-destructive hover:text-destructive"
                onClick={() => setConfirmCancel(true)}
                data-testid="allocation-cancel"
              >
                {t('cancelBooking')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 text-base"
                onClick={() => onOpenChange(false)}
              >
                {tc('close')}
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-11 min-w-28 text-base"
                disabled={saving}
                onClick={save}
                data-testid="allocation-save"
              >
                {saving ? tc('saving') : tc('save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        description={t('cancelConfirm')}
        confirmLabel={t('cancelBooking')}
        destructive
        onConfirm={cancelBooking}
      />
      <ConflictDialog conflicts={conflicts} onOpenChange={(o) => !o && setConflicts(null)} />
    </>
  );
}

/** "Assign team" / "Assign machines": many workers or machines, one project, a date range. */
export function AssignDialog({
  open,
  onOpenChange,
  kind,
  defaultProject,
  defaultFrom,
  defaultTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AllocationKind;
  defaultProject?: { id: string; name: string };
  defaultFrom: string;
  defaultTo?: string;
}) {
  const t = useTranslations('schedule');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const validation = useValidationMessage();
  const invalidate = useInvalidate();
  const init = () => ({
    projectId: defaultProject?.id ?? '',
    projectLabel: defaultProject?.name,
    fromDate: defaultFrom,
    toDate: defaultTo ?? defaultFrom,
    startTime: DEFAULT_WORK_START,
    endTime: DEFAULT_WORK_END,
    skipSundays: true,
    notes: '',
    operatorWorkerId: '',
    operatorLabel: undefined as string | undefined,
    selected: [] as string[],
  });
  const [form, setForm] = useState(init);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setForm(init());
  }
  const [search, setSearch] = useState('');
  const [error, setError] = useState<{ path: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<AllocationConflict[] | null>(null);
  const set = (patch: Partial<ReturnType<typeof init>>) => setForm((f) => ({ ...f, ...patch }));
  const errFor = (path: string) => (error?.path === path ? validation(error.message) : undefined);

  const validWindow =
    Boolean(form.fromDate) &&
    Boolean(form.toDate) &&
    form.toDate >= form.fromDate &&
    form.endTime > form.startTime;
  const { data: availability, isFetching } = useApi<AvailabilityDto>(
    'allocations',
    '/allocations/availability',
    {
      kind,
      fromDate: form.fromDate,
      toDate: form.toDate,
      startTime: form.startTime,
      endTime: form.endTime,
      skipSundays: form.skipSundays,
    },
    { enabled: open && validWindow },
  );
  const rows = [
    ...(availability?.free ?? []).map((r) => ({ ...r, projects: [] as string[] })),
    ...(availability?.busy ?? []),
  ]
    .filter((r) => {
      const q = search.trim().toLowerCase();
      return !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const toggle = (id: string) =>
    set({
      selected: form.selected.includes(id)
        ? form.selected.filter((s) => s !== id)
        : [...form.selected, id],
    });

  const save = async () => {
    setError(null);
    if (!form.projectId) return setError({ path: 'projectId', message: 'REQUIRED' });
    if (!form.selected.length) return setError({ path: 'selected', message: 'PICK_SOMEONE' });
    if (form.toDate < form.fromDate)
      return setError({ path: 'toDate', message: 'END_BEFORE_START' });
    if (form.endTime <= form.startTime)
      return setError({ path: 'endTime', message: 'END_TIME_BEFORE_START' });
    setSaving(true);
    try {
      const created = await api<unknown[]>(`/allocations/${kind}s`, {
        method: 'POST',
        body: {
          [kind === 'worker' ? 'workerIds' : 'assetIds']: form.selected,
          projectId: form.projectId,
          fromDate: form.fromDate,
          toDate: form.toDate,
          startTime: form.startTime,
          endTime: form.endTime,
          skipSundays: form.skipSundays,
          notes: form.notes,
          ...(kind === 'asset' ? { operatorWorkerId: form.operatorWorkerId } : {}),
        },
      });
      await invalidate('allocations', 'daily-entry');
      toast.success(t('assigned', { n: created.length }));
      onOpenChange(false);
    } catch (err) {
      const c = overlapConflicts(err);
      if (c) setConflicts(c);
      else {
        const fe = fieldError(err);
        if (fe) setError(fe);
        else toast.error(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const title = kind === 'worker' ? t('assignTeam') : t('assignMachines');
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl" data-testid="assign-dialog">
          <DialogHeader>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <DialogDescription className="text-base">
              {kind === 'worker' ? t('assignTeamHelp') : t('assignMachinesHelp')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid content-start gap-4">
              <FormField
                id="assign-project"
                label={t('fields.project')}
                error={errFor('projectId') ? { message: error?.message } : undefined}
              >
                <EntityPicker<ProjectDto>
                  id="assign-project"
                  resource="projects"
                  value={form.projectId}
                  selectedLabel={form.projectLabel}
                  onChange={(id, row) => set({ projectId: id, projectLabel: row?.name })}
                  toItem={projectItem}
                  invalid={Boolean(errFor('projectId'))}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField id="assign-from" label={t('fields.fromDate')}>
                  <DateInput
                    id="assign-from"
                    value={form.fromDate}
                    onChange={(v) =>
                      set({ fromDate: v, toDate: v > form.toDate ? v : form.toDate })
                    }
                    className="h-11 text-base"
                  />
                </FormField>
                <FormField
                  id="assign-to"
                  label={t('fields.toDate')}
                  error={errFor('toDate') ? { message: error?.message } : undefined}
                >
                  <DateInput
                    id="assign-to"
                    value={form.toDate}
                    onChange={(v) => set({ toDate: v })}
                    className="h-11 text-base"
                  />
                </FormField>
                <FormField id="assign-start" label={t('fields.startTime')}>
                  <TimeInput
                    id="assign-start"
                    value={form.startTime}
                    onChange={(v) => set({ startTime: v })}
                  />
                </FormField>
                <FormField
                  id="assign-end"
                  label={t('fields.endTime')}
                  error={errFor('endTime') ? { message: error?.message } : undefined}
                >
                  <TimeInput
                    id="assign-end"
                    value={form.endTime}
                    onChange={(v) => set({ endTime: v })}
                  />
                </FormField>
              </div>
              <label className="flex items-center gap-3 rounded-lg border p-3">
                <Switch
                  checked={form.skipSundays}
                  onCheckedChange={(v) => set({ skipSundays: v })}
                  aria-label={t('fields.skipSundays')}
                />
                <span className="text-[0.95rem]">{t('fields.skipSundays')}</span>
              </label>
              {kind === 'asset' ? (
                <FormField id="assign-operator" label={t('fields.operator')}>
                  <EntityPicker<WorkerDto>
                    id="assign-operator"
                    resource="workers"
                    params={{ active: true }}
                    value={form.operatorWorkerId}
                    selectedLabel={form.operatorLabel}
                    onChange={(id, row) =>
                      set({ operatorWorkerId: id, operatorLabel: row?.fullName })
                    }
                    toItem={workerItem}
                    allowClear
                  />
                </FormField>
              ) : null}
              <FormField id="assign-notes" label={t('fields.notes')}>
                <Input
                  id="assign-notes"
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  className="h-11 text-base"
                />
              </FormField>
            </div>
            <div className="flex min-h-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.95rem] font-medium">
                  {kind === 'worker' ? t('pickWorkers') : t('pickMachines')}
                </p>
                <span className="text-sm text-muted-foreground" data-testid="assign-count">
                  {t('selected', { n: form.selected.length })}
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tc('search')}
                  aria-label={tc('search')}
                  className="h-10 pl-9"
                />
              </div>
              <ul
                className={cn(
                  'max-h-80 overflow-y-auto rounded-lg border',
                  errFor('selected') && 'border-destructive',
                )}
                data-testid="assign-list"
              >
                {rows.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {isFetching ? tc('loading') : tc('noResults')}
                  </li>
                ) : (
                  rows.map((r) => {
                    const checked = form.selected.includes(r.id);
                    return (
                      <li key={r.id} className="border-b last:border-b-0">
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                          <input
                            type="checkbox"
                            className="size-5 accent-primary"
                            checked={checked}
                            onChange={() => toggle(r.id)}
                            aria-label={r.name}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{r.name}</span>
                            <span className="block text-sm text-muted-foreground">{r.code}</span>
                          </span>
                          {r.projects.length ? (
                            <span className="max-w-48 truncate rounded-full bg-warning/20 px-2 py-0.5 text-sm">
                              {t('busyAt', { projects: r.projects.join(', ') })}
                            </span>
                          ) : (
                            <span className="rounded-full bg-success/12 px-2 py-0.5 text-sm text-success">
                              {t('free')}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
              {errFor('selected') ? (
                <p className="text-sm text-destructive">{t('pickSomeone')}</p>
              ) : null}
              {validWindow ? (
                <p className="text-sm text-muted-foreground">
                  {t('window', {
                    from: formatDate(form.fromDate),
                    to: formatDate(form.toDate),
                    start: form.startTime,
                    end: form.endTime,
                  })}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => onOpenChange(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-11 min-w-32 text-base"
              disabled={saving}
              onClick={save}
              data-testid="assign-save"
            >
              {saving ? tc('saving') : t('assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConflictDialog conflicts={conflicts} onOpenChange={(o) => !o && setConflicts(null)} />
    </>
  );
}
