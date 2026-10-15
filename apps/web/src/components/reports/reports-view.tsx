'use client';

import {
  EXPENSE_CATEGORIES,
  REPORTS,
  type AssetDto,
  type CertificateDto,
  type ProjectDto,
  type ReportDefinition,
  type ReportFilter,
  type SupplierDto,
  type WorkerDto,
} from '@sc/shared';
import {
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  ChartColumn,
  FileClock,
  Landmark,
  ReceiptText,
  ScrollText,
  Tractor,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EntityPicker } from '@/components/entity-picker';
import { DateInput } from '@/components/forms/date-input';
import { EnumSelect } from '@/components/forms/enum-select';
import { FormField } from '@/components/forms/form-field';
import { MonthPicker, shiftMonth } from '@/components/forms/month-picker';
import { projectItem } from '@/components/schedule/allocation-dialogs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useApi } from '@/hooks/use-resource';
import { formatDate, todayInColombo } from '@/lib/format';
import { ReportDownloadButton } from './download-button';

const ICONS: Record<string, LucideIcon> = {
  'project-cost': ChartColumn,
  'payroll-sheet': Users,
  payslips: ReceiptText,
  'epf-etf': Landmark,
  attendance: CalendarCheck,
  'asset-utilisation': Tractor,
  expenses: ScrollText,
  'supplier-statement': Truck,
  ipc: BadgeCheck,
  expiry: FileClock,
  'business-summary': CalendarClock,
};

interface FilterState {
  projectId: string;
  month: string;
  from: string;
  to: string;
  workerId: string;
  assetId: string;
  supplierId: string;
  certificateId: string;
  days: string;
  category: string;
}

const initialFilters = (): FilterState => {
  const today = todayInColombo();
  return {
    projectId: '',
    // salary reports are usually printed for the month just finished
    month: shiftMonth(today.slice(0, 7), -1),
    from: '',
    to: '',
    workerId: '',
    assetId: '',
    supplierId: '',
    certificateId: '',
    days: '30',
    category: '',
  };
};

/** Report query parameters from the panel's filters. */
function paramsFor(def: ReportDefinition, f: FilterState) {
  const has = (x: ReportFilter) => def.filters.includes(x);
  return {
    projectId: has('project') ? f.projectId || undefined : undefined,
    month: has('month') ? f.month : undefined,
    from: has('dateRange') ? f.from || undefined : undefined,
    to: has('dateRange') ? f.to || undefined : undefined,
    workerId: has('worker') ? f.workerId || undefined : undefined,
    assetId: has('asset') ? f.assetId || undefined : undefined,
    supplierId: has('supplier') ? f.supplierId || undefined : undefined,
    certificateId: has('certificate') ? f.certificateId || undefined : undefined,
    days: has('daysAhead') ? f.days || '30' : undefined,
    category: has('expenseCategory') ? f.category || undefined : undefined,
  };
}

/** Reports whose empty date range means "this month" (the others: all time). */
const MONTH_DEFAULT = new Set<string>(['asset-utilisation', 'expenses']);

const VALUE_OF: Record<ReportFilter, keyof FilterState | null> = {
  project: 'projectId',
  month: 'month',
  dateRange: null,
  worker: 'workerId',
  asset: 'assetId',
  supplier: 'supplierId',
  certificate: 'certificateId',
  daysAhead: 'days',
  expenseCategory: 'category',
};

function CertificateSelect({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations('reports.filters');
  const { data } = useApi<CertificateDto[]>(
    'projects',
    `/projects/${projectId}/certificates`,
    undefined,
    {
      enabled: Boolean(projectId),
      keepPrevious: false,
    },
  );
  const bills = data ?? [];
  if (projectId && data && !bills.length)
    return <p className="text-muted-foreground">{t('noBills')}</p>;
  return (
    <Select value={value} onValueChange={onChange} disabled={!projectId}>
      <SelectTrigger
        id="f-certificate"
        className="h-11 w-full text-base"
        data-testid="filter-certificate"
      >
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {bills.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.code} · {formatDate(b.periodTo)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ReportPanel({
  def,
  filters,
  setFilter,
}: {
  def: ReportDefinition;
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(k: K, v: FilterState[K]) => void;
}) {
  const t = useTranslations('reports');
  const has = (x: ReportFilter) => def.filters.includes(x);
  const required = (x: ReportFilter) => def.required.includes(x);
  const missing = def.required
    .filter((x) => {
      const key = VALUE_OF[x];
      return key ? !filters[key] : false;
    })
    .map((x) => t(`filters.${x}` as 'filters.project'));
  const params = paramsFor(def, filters);

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      {has('project') ? (
        <FormField id="f-project" label={t('filters.project')}>
          <EntityPicker<ProjectDto>
            id="f-project"
            resource="projects"
            value={filters.projectId}
            onChange={(id) => {
              setFilter('projectId', id);
              setFilter('certificateId', '');
            }}
            toItem={projectItem}
            allowClear={!required('project')}
            placeholder={required('project') ? undefined : t('filters.allProjects')}
          />
        </FormField>
      ) : null}
      {has('certificate') ? (
        <FormField id="f-certificate" label={t('filters.certificate')}>
          <CertificateSelect
            projectId={filters.projectId}
            value={filters.certificateId}
            onChange={(v) => setFilter('certificateId', v)}
          />
        </FormField>
      ) : null}
      {has('month') ? (
        <FormField id="f-month" label={t('filters.month')}>
          <MonthPicker id="f-month" value={filters.month} onChange={(m) => setFilter('month', m)} />
        </FormField>
      ) : null}
      {has('dateRange') ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <FormField id="f-from" label={t('filters.from')}>
              <DateInput id="f-from" value={filters.from} onChange={(v) => setFilter('from', v)} />
            </FormField>
            <FormField id="f-to" label={t('filters.to')}>
              <DateInput id="f-to" value={filters.to} onChange={(v) => setFilter('to', v)} />
            </FormField>
          </div>
          <p className="text-sm text-muted-foreground">
            {MONTH_DEFAULT.has(def.id) ? t('filters.dateRangeHelp') : t('filters.dateRangeAllHelp')}
          </p>
        </div>
      ) : null}
      {has('worker') ? (
        <FormField id="f-worker" label={t('filters.worker')}>
          <EntityPicker<WorkerDto>
            id="f-worker"
            resource="workers"
            value={filters.workerId}
            onChange={(id) => setFilter('workerId', id)}
            toItem={(w) => ({ id: w.id, label: w.fullName, hint: w.code })}
            allowClear
            placeholder={t('filters.allWorkers')}
          />
        </FormField>
      ) : null}
      {has('asset') ? (
        <FormField id="f-asset" label={t('filters.asset')}>
          <EntityPicker<AssetDto>
            id="f-asset"
            resource="assets"
            value={filters.assetId}
            onChange={(id) => setFilter('assetId', id)}
            toItem={(a) => ({ id: a.id, label: a.name, hint: a.code })}
            allowClear
            placeholder={t('filters.allAssets')}
          />
        </FormField>
      ) : null}
      {has('supplier') ? (
        <FormField id="f-supplier" label={t('filters.supplier')}>
          <EntityPicker<SupplierDto>
            id="f-supplier"
            resource="suppliers"
            value={filters.supplierId}
            onChange={(id) => setFilter('supplierId', id)}
            toItem={(s) => ({ id: s.id, label: s.name, hint: s.code })}
            allowClear
            placeholder={t('filters.allSuppliers')}
          />
        </FormField>
      ) : null}
      {has('expenseCategory') ? (
        <FormField id="f-category" label={t('filters.expenseCategory')}>
          <EnumSelect
            id="f-category"
            enumName="ExpenseCategory"
            values={EXPENSE_CATEGORIES}
            value={filters.category}
            onChange={(v) => setFilter('category', v)}
            allLabel={t('filters.allCategories')}
            className="h-11"
          />
        </FormField>
      ) : null}
      {has('daysAhead') ? (
        <FormField id="f-days" label={t('filters.daysAhead')}>
          <Input
            id="f-days"
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            className="h-11 w-32"
            value={filters.days}
            onChange={(e) => setFilter('days', e.target.value)}
          />
        </FormField>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2">
        {def.formats.map((format) => (
          <ReportDownloadButton
            key={format}
            reportId={def.id}
            format={format}
            params={params}
            missing={missing}
            variant={format === 'pdf' ? 'default' : 'outline'}
          />
        ))}
      </div>
    </div>
  );
}

/** Reports: a grid of report cards → a side panel with the filters and the download buttons. */
export function ReportsView() {
  const t = useTranslations('reports');
  const [openId, setOpenId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const setFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));
  const def = REPORTS.find((r) => r.id === openId);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="report-cards">
        {REPORTS.map((r) => {
          const Icon = ICONS[r.id] ?? ScrollText;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpenId(r.id)}
              className="group rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              data-testid={`report-${r.id}`}
            >
              <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-primary/[0.03]">
                <CardContent className="flex items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg leading-snug font-semibold">
                      {t(`list.${r.id}.name`)}
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      {t(`list.${r.id}.description`)}
                    </span>
                    <span className="mt-2 block text-sm font-medium text-muted-foreground">
                      {r.formats.length === 1 ? t('pdfOnly') : 'PDF · Excel'}
                    </span>
                  </span>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Sheet open={Boolean(def)} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
          data-testid="report-panel"
        >
          {def ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{t(`list.${def.id}.name`)}</SheetTitle>
                <SheetDescription className="text-base">
                  {t(`list.${def.id}.description`)}
                </SheetDescription>
              </SheetHeader>
              <ReportPanel def={def} filters={filters} setFilter={setFilter} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
