'use client';

import type { DashboardDto, NotificationDto } from '@sc/shared';
import {
  Banknote,
  Building2,
  ChevronRight,
  ClipboardPen,
  FileUp,
  HardHat,
  Receipt,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { HealthFlags, ProgressTriple } from '@/components/progress-triple';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnumLabel } from '@/components/forms/enum-select';
import { useNotificationText } from '@/hooks/use-notification-text';
import { useApi } from '@/hooks/use-resource';
import { formatDate, formatMoney, formatMoneyWhole, formatMonth } from '@/lib/format';
import { SEVERITY_DOT, notificationHref } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { SpendChart } from './spend-chart';

function greetingKey(): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Asia/Colombo',
    }).format(new Date()),
  );
  return hour < 12 ? 'greetingMorning' : hour < 17 ? 'greetingAfternoon' : 'greetingEvening';
}

function Kpi({
  id,
  icon: Icon,
  label,
  value,
  note,
  href,
  title,
}: {
  id: string;
  icon: typeof Building2;
  label: string;
  value: string;
  note: string;
  href: string;
  /** Full value on hover (money KPIs show whole rupees). */
  title?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Card
        className="h-full transition-colors group-hover:border-primary/40"
        data-testid={`kpi-${id}`}
      >
        <CardContent className="flex flex-col gap-2">
          <p className="flex items-start gap-2 text-[0.95rem] leading-snug text-muted-foreground">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="pt-1">{label}</span>
          </p>
          <p
            className="text-2xl font-bold whitespace-nowrap tabular-nums"
            title={title}
            data-testid={`kpi-${id}-value`}
          >
            {value}
          </p>
          <p className="text-sm text-muted-foreground">{note}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function AttentionList({ items, total }: { items: NotificationDto[]; total: number }) {
  const t = useTranslations('dashboard');
  const tn = useTranslations('notifications');
  const text = useNotificationText();
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">{t('needsAttention')}</CardTitle>
        {total > 0 ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/notifications" data-testid="attention-see-all">
              {t('seeAll', { count: total })}
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="px-3">
        {items.length === 0 ? (
          <p className="px-3 text-muted-foreground">{t('nothingNeedsAttention')}</p>
        ) : (
          <ul className="flex flex-col" data-testid="attention-list">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={notificationHref(n)}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                  data-testid="attention-item"
                >
                  <span
                    className={cn('mt-2 size-2.5 shrink-0 rounded-full', SEVERITY_DOT[n.severity])}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 leading-snug">
                    {text(n)}
                    {n.dueDate ? (
                      <span className="block text-sm text-muted-foreground">
                        {tn('due', { date: formatDate(n.dueDate) })}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectsTable({ projects }: { projects: DashboardDto['projects'] }) {
  const t = useTranslations('dashboard');
  const enumLabel = useEnumLabel();
  if (!projects.length)
    return <p className="py-6 text-center text-muted-foreground">{t('noActiveProjects')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left" data-testid="dashboard-projects">
        <thead className="text-sm text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 font-medium">{t('projectCol')}</th>
            <th className="w-[36%] px-3 py-2 font-medium">{t('progressCol')}</th>
            <th className="px-3 py-2 font-medium">{t('statusCol')}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.projectId}
              className="border-b last:border-0 align-top"
              data-testid="dashboard-project"
            >
              <td className="px-3 py-3">
                <Link
                  href={`/projects/${p.projectId}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {p.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {p.code} · {p.clientName}
                </p>
              </td>
              <td className="px-3 py-3">
                <ProgressTriple
                  timePct={p.timePct}
                  budgetPct={p.budgetPct}
                  physicalPct={p.physicalPct}
                  compact
                />
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-col items-start gap-2">
                  <StatusChip status={p.status}>{enumLabel('ProjectStatus', p.status)}</StatusChip>
                  {p.flags.length ? <HealthFlags flags={p.flags} /> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The calm home page: 4 KPIs, what needs attention, active projects, one chart, quick actions. */
export function DashboardView() {
  const t = useTranslations('dashboard');
  const tNav = useTranslations('nav');
  const { data, isLoading, error, refetch } = useApi<DashboardDto>('dashboard', '/dashboard');

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <p>{t('loadError')}</p>
          <Button onClick={() => void refetch()}>{t('retry')}</Button>
        </CardContent>
      </Card>
    );
  }

  const quick = (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('quickActions')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button asChild size="lg" className="h-11 justify-start text-base">
          <Link href="/daily">
            <ClipboardPen aria-hidden />
            {tNav('daily')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 justify-start text-base">
          <Link href="/daily/expenses?add=1">
            <Receipt aria-hidden />
            {t('addExpense')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 justify-start text-base">
          <Link href="/documents?upload=1">
            <FileUp aria-hidden />
            {t('uploadDocument')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const k = data.kpis;
  const otherProjects = data.projects.filter((p) => p.status !== 'ONGOING').length;
  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-4 text-lg text-muted-foreground" data-testid="dashboard-greeting">
        {t(greetingKey())} {t('todayIs', { date: formatDate(data.today) })}
      </p>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('title')}>
        <Kpi
          id="activeProjects"
          icon={Building2}
          label={t('kpi.activeProjects')}
          value={String(k.activeProjects)}
          note={t('kpiNote.activeProjects', { count: otherProjects })}
          href="/projects"
        />
        <Kpi
          id="workersToday"
          icon={HardHat}
          label={t('kpi.workersToday')}
          value={String(k.workersOnSiteToday)}
          note={
            k.workersSource === 'ATTENDANCE'
              ? t('kpiNote.workersRecorded')
              : t('kpiNote.workersPlanned')
          }
          href="/daily"
        />
        <Kpi
          id="spentThisMonth"
          icon={Wallet}
          label={t('kpi.spentThisMonth')}
          value={formatMoneyWhole(k.spentThisMonth)}
          title={formatMoney(k.spentThisMonth)}
          note={t('kpiNote.spentThisMonth', { month: formatMonth(data.month) })}
          href="/reports"
        />
        <Kpi
          id="toReceive"
          icon={Banknote}
          label={t('kpi.toReceive')}
          value={formatMoneyWhole(k.moneyToReceive)}
          title={formatMoney(k.moneyToReceive)}
          note={t('kpiNote.toReceive')}
          href="/projects"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AttentionList items={data.attention} total={data.attentionTotal} />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('chartTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SpendChart series={data.series} />
            </CardContent>
          </Card>
          {quick}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('activeProjects')}</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <ProjectsTable projects={data.projects} />
        </CardContent>
      </Card>
    </div>
  );
}
