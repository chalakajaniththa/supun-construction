'use client';

import type { WorkerDto } from '@sc/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DeleteButton } from '@/components/delete-button';
import {
  BackButton,
  ComingSoonPanel,
  DetailState,
  DetailTabs,
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
import { formatDate } from '@/lib/format';
import { AdvancesPanel } from './advances-panel';
import { AttendanceCalendar } from './attendance-calendar';
import { RateHistory } from './rate-history';
import { WorkerForm } from './worker-form';
import { useRateText } from './workers-list';

const TABS = ['profile', 'rates', 'attendance', 'advances', 'payslips', 'documents'] as const;
type Tab = (typeof TABS)[number];

export function WorkerDetail({ id }: { id: string }) {
  const t = useTranslations('workers');
  const tc = useTranslations('common');
  const enumLabel = useEnumLabel();
  const rateText = useRateText();
  const router = useRouter();
  const { data: w, error } = useDetail<WorkerDto>('workers', id);
  const remove = useRemove('workers');
  const [tab, setTab] = useState<Tab>('profile');

  if (!w) return <DetailState error={error} backHref="/workers" />;

  return (
    <>
      <PageHeader
        title={w.fullName}
        description={[w.code, w.nameSinhala, enumLabel('WorkerSkill', w.skill)]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <BackButton href="/workers" label={t('backToList')} />
            <DeleteButton
              description={t('deleteConfirm', { name: w.fullName })}
              onDelete={() => remove.mutateAsync(w.id)}
              onDeleted={() => router.push('/workers')}
            />
            <EditButton href={`/workers/${w.id}/edit`} />
          </>
        }
      />
      <DetailTabs tabs={TABS} value={tab} onChange={setTab} label={(k) => t(`tabs.${k}`)}>
        <TabsContent value="profile">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center gap-3">
              <CardTitle className="text-lg">{t('sections.personal')}</CardTitle>
              {w.active ? (
                <StatusChip tone="success">{tc('status.active')}</StatusChip>
              ) : (
                <StatusChip tone="neutral">{tc('status.inactive')}</StatusChip>
              )}
            </CardHeader>
            <CardContent>
              <InfoList
                items={[
                  { label: t('fields.code'), value: w.code },
                  { label: t('fields.type'), value: enumLabel('WorkerType', w.type) },
                  { label: t('fields.currentRate'), value: rateText(w) },
                  { label: t('fields.nic'), value: w.nic },
                  { label: t('fields.phone'), value: w.phone },
                  {
                    label: t('fields.dateOfBirth'),
                    value: w.dateOfBirth ? formatDate(w.dateOfBirth) : null,
                  },
                  { label: t('fields.joinedDate'), value: formatDate(w.joinedDate) },
                  {
                    label: t('fields.leftDate'),
                    value: w.leftDate ? formatDate(w.leftDate) : null,
                  },
                  { label: t('fields.emergencyContact'), value: w.emergencyContact },
                  { label: t('fields.epfNo'), value: w.epfNo },
                  { label: t('fields.bankName'), value: w.bankName },
                  { label: t('fields.bankAccountNo'), value: w.bankAccountNo },
                  { label: t('fields.address'), value: w.address, wide: true },
                  { label: t('fields.notes'), value: w.notes, wide: true },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rates">
          <RateHistory worker={w} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceCalendar workerId={w.id} />
        </TabsContent>
        <TabsContent value="advances">
          <AdvancesPanel worker={w} />
        </TabsContent>
        <TabsContent value="payslips">
          <ComingSoonPanel />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentPanel ownerType="WORKER" ownerId={w.id} />
        </TabsContent>
      </DetailTabs>
    </>
  );
}

export function WorkerEdit({ id }: { id: string }) {
  const t = useTranslations('workers');
  const { data: w, error } = useDetail<WorkerDto>('workers', id);
  if (!w) return <DetailState error={error} backHref="/workers" />;
  return (
    <>
      <PageHeader title={t('editTitle')} description={`${w.code} · ${w.fullName}`} />
      <WorkerForm worker={w} />
    </>
  );
}
