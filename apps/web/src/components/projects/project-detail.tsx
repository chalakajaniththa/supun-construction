'use client';

import type { ProjectDetailDto } from '@sc/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DeleteButton } from '@/components/delete-button';
import {
  BackButton,
  DetailState,
  DetailTabs,
  useTabParam,
  EditButton,
} from '@/components/detail-page';
import { DocumentPanel } from '@/components/documents/document-panel';
import { useEnumLabel } from '@/components/forms/enum-select';
import { InfoList } from '@/components/info-list';
import { PageHeader } from '@/components/page-header';
import { StatusChip } from '@/components/status-chip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { useDetail, useRemove } from '@/hooks/use-resource';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { BudgetEditor } from './budget-editor';
import { ProjectBills } from './project-bills';
import { ProjectBonds } from './project-bonds';
import { ProjectBoq } from './project-boq';
import { ProjectCosts } from './project-costs';
import { ProjectHealthPanel } from './project-health';
import { ProjectVariations } from './project-variations';
import { ProjectTeam } from './project-team';
import { ProjectForm } from './project-form';

const TABS = [
  'overview',
  'boq',
  'bills',
  'variations',
  'bonds',
  'costs',
  'team',
  'documents',
] as const;
type Tab = (typeof TABS)[number];

export function ProjectDetail({ id }: { id: string }) {
  const t = useTranslations('projects');
  const enumLabel = useEnumLabel();
  const router = useRouter();
  const { data: p, error } = useDetail<ProjectDetailDto>('projects', id);
  const remove = useRemove('projects', { also: ['clients'] });
  const [tab, setTab] = useTabParam<Tab>(TABS, 'overview');

  if (!p) return <DetailState error={error} backHref="/projects" />;

  return (
    <>
      <PageHeader
        title={p.name}
        description={`${p.code} · ${p.client.name}`}
        actions={
          <>
            <BackButton href="/projects" label={t('backToList')} />
            <DeleteButton
              description={t('deleteConfirm', { name: p.name })}
              onDelete={() => remove.mutateAsync(p.id)}
              onDeleted={() => router.push('/projects')}
            />
            <EditButton href={`/projects/${p.id}/edit`} />
          </>
        }
      />
      <DetailTabs tabs={TABS} value={tab} onChange={setTab} label={(k) => t(`tabs.${k}`)}>
        <TabsContent value="overview" className="flex flex-col gap-5">
          <ProjectHealthPanel project={p} />
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center gap-3">
              <CardTitle className="text-lg">{t('sections.basic')}</CardTitle>
              <StatusChip status={p.status}>{enumLabel('ProjectStatus', p.status)}</StatusChip>
            </CardHeader>
            <CardContent>
              <InfoList
                items={[
                  { label: t('fields.code'), value: p.code },
                  { label: t('fields.type'), value: enumLabel('ProjectType', p.type) },
                  { label: t('fields.source'), value: enumLabel('ProjectSource', p.source) },
                  { label: t('fields.client'), value: p.client.name },
                  { label: t('fields.location'), value: p.location },
                  {
                    label: t('fields.supervisor'),
                    value: p.siteSupervisor
                      ? `${p.siteSupervisor.fullName} (${p.siteSupervisor.code})`
                      : null,
                  },
                  { label: t('fields.description'), value: p.description, wide: true },
                ]}
              />
            </CardContent>
          </Card>
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('sections.contract')}</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoList
                  items={[
                    { label: t('fields.contractValue'), value: formatMoney(p.contractValue) },
                    { label: t('fields.totalBudget'), value: formatMoney(p.totalBudget) },
                    { label: t('fields.contractNo'), value: p.contractNo },
                    { label: t('fields.tenderNo'), value: p.tenderNo },
                    { label: t('fields.retentionPct'), value: formatPercent(p.retentionPct, 2) },
                    {
                      label: t('fields.retentionCapPct'),
                      value: formatPercent(p.retentionCapPct, 2),
                    },
                    { label: t('fields.advanceAmount'), value: formatMoney(p.advanceAmount) },
                    {
                      label: t('fields.advanceRecoveryPct'),
                      value: formatPercent(p.advanceRecoveryPct, 2),
                    },
                    { label: t('fields.dlpMonths'), value: t('months', { n: p.dlpMonths }) },
                    {
                      label: t('fields.progressPct'),
                      value: p.progressPct ? formatPercent(p.progressPct) : null,
                    },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('sections.dates')}</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoList
                  items={[
                    { label: t('fields.startDate'), value: formatDate(p.startDate) },
                    { label: t('fields.plannedEndDate'), value: formatDate(p.plannedEndDate) },
                    {
                      label: t('fields.revisedEndDate'),
                      value: p.revisedEndDate ? formatDate(p.revisedEndDate) : null,
                    },
                    {
                      label: t('fields.actualEndDate'),
                      value: p.actualEndDate ? formatDate(p.actualEndDate) : null,
                    },
                    { label: t('fields.notes'), value: p.notes, wide: true },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
          <BudgetEditor projectId={p.id} lines={p.budgetLines} />
        </TabsContent>
        <TabsContent value="costs">
          <ProjectCosts projectId={p.id} projectName={p.name} />
        </TabsContent>
        <TabsContent value="team">
          <ProjectTeam project={p} />
        </TabsContent>
        <TabsContent value="boq">
          <ProjectBoq projectId={p.id} />
        </TabsContent>
        <TabsContent value="bills">
          <ProjectBills project={p} />
        </TabsContent>
        <TabsContent value="variations">
          <ProjectVariations project={p} />
        </TabsContent>
        <TabsContent value="bonds">
          <ProjectBonds projectId={p.id} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentPanel ownerType="PROJECT" ownerId={p.id} />
        </TabsContent>
      </DetailTabs>
    </>
  );
}

export function ProjectEdit({ id }: { id: string }) {
  const t = useTranslations('projects');
  const { data: p, error } = useDetail<ProjectDetailDto>('projects', id);
  if (!p) return <DetailState error={error} backHref="/projects" />;
  return (
    <>
      <PageHeader title={t('editTitle')} description={`${p.code} · ${p.name}`} />
      <ProjectForm project={p} />
    </>
  );
}
