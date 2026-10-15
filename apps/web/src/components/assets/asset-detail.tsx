'use client';

import type { AssetDto } from '@sc/shared';
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
import { ExpiryBadge } from '@/components/documents/expiry-badge';
import { useEnumLabel } from '@/components/forms/enum-select';
import { InfoList } from '@/components/info-list';
import { PageHeader } from '@/components/page-header';
import { StatusChip } from '@/components/status-chip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { useDetail, useRemove } from '@/hooks/use-resource';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import { AssetForm } from './asset-form';
import { AssetAllocationsPanel, MaintenancePanel, ServiceBadge, UsagePanel } from './asset-ops';

const TABS = ['info', 'usage', 'maintenance', 'allocations', 'documents'] as const;
type Tab = (typeof TABS)[number];

export function AssetDetail({ id }: { id: string }) {
  const t = useTranslations('assets');
  const tc = useTranslations('common');
  const enumLabel = useEnumLabel();
  const router = useRouter();
  const { data: a, error } = useDetail<AssetDto>('assets', id);
  const remove = useRemove('assets');
  const [tab, setTab] = useTabParam<Tab>(TABS, 'info');

  if (!a) return <DetailState error={error} backHref="/assets" />;
  const meterUnit = a.meterType === 'NONE' ? '' : ` ${enumLabel('MeterType', a.meterType)}`;

  return (
    <>
      <PageHeader
        title={a.name}
        description={[a.code, a.registrationNo, enumLabel('AssetCategory', a.category)]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <BackButton href="/assets" label={t('backToList')} />
            <DeleteButton
              description={t('deleteConfirm', { name: a.name })}
              onDelete={() => remove.mutateAsync(a.id)}
              onDeleted={() => router.push('/assets')}
            />
            <EditButton href={`/assets/${a.id}/edit`} />
          </>
        }
      />
      <DetailTabs tabs={TABS} value={tab} onChange={setTab} label={(k) => t(`tabs.${k}`)}>
        <TabsContent value="info" className="flex flex-col gap-5">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center gap-3">
              <CardTitle className="text-lg">{t('sections.basic')}</CardTitle>
              <StatusChip status={a.status}>{enumLabel('AssetStatus', a.status)}</StatusChip>
              <ServiceBadge asset={a} />
              {a.nextExpiry ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {t('fields.nextExpiry')}: <ExpiryBadge expiry={a.nextExpiry} />
                </span>
              ) : null}
            </CardHeader>
            <CardContent>
              <InfoList
                items={[
                  { label: t('fields.code'), value: a.code },
                  { label: t('fields.category'), value: enumLabel('AssetCategory', a.category) },
                  { label: t('fields.isVehicle'), value: a.isVehicle ? tc('yes') : tc('no') },
                  { label: t('fields.make'), value: a.make },
                  { label: t('fields.model'), value: a.model },
                  { label: t('fields.yearOfManufacture'), value: a.yearOfManufacture },
                  { label: t('fields.registrationNo'), value: a.registrationNo },
                  { label: t('fields.chassisNo'), value: a.chassisNo },
                  { label: t('fields.engineNo'), value: a.engineNo },
                  { label: t('fields.ownership'), value: enumLabel('AssetOwnership', a.ownership) },
                  {
                    label: t('fields.purchaseDate'),
                    value: a.purchaseDate ? formatDate(a.purchaseDate) : null,
                  },
                  {
                    label: t('fields.purchaseCost'),
                    value: a.purchaseCost ? formatMoney(a.purchaseCost) : null,
                  },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('sections.meter')}</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoList
                items={[
                  { label: t('fields.meterType'), value: enumLabel('MeterType', a.meterType) },
                  {
                    label: t('fields.currentMeter'),
                    value:
                      a.meterType === 'NONE' ? null : `${formatQty(a.currentMeter)}${meterUnit}`,
                  },
                  {
                    label: t('fields.serviceIntervalMeter'),
                    value: a.serviceIntervalMeter
                      ? `${formatQty(a.serviceIntervalMeter)}${meterUnit}`
                      : null,
                  },
                  {
                    label: t('fields.lastServiceMeter'),
                    value: a.lastServiceMeter
                      ? `${formatQty(a.lastServiceMeter)}${meterUnit}`
                      : null,
                  },
                  {
                    label: t('fields.internalRatePerHour'),
                    value: a.internalRatePerHour ? formatMoney(a.internalRatePerHour) : null,
                  },
                  {
                    label: t('fields.internalRatePerDay'),
                    value: a.internalRatePerDay ? formatMoney(a.internalRatePerDay) : null,
                  },
                  { label: t('fields.notes'), value: a.notes, wide: true },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="usage">
          <UsagePanel asset={a} />
        </TabsContent>
        <TabsContent value="maintenance">
          <MaintenancePanel asset={a} />
        </TabsContent>
        <TabsContent value="allocations">
          <AssetAllocationsPanel asset={a} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentPanel ownerType="ASSET" ownerId={a.id} isVehicle={a.isVehicle} />
        </TabsContent>
      </DetailTabs>
    </>
  );
}

export function AssetEdit({ id }: { id: string }) {
  const t = useTranslations('assets');
  const { data: a, error } = useDetail<AssetDto>('assets', id);
  if (!a) return <DetailState error={error} backHref="/assets" />;
  return (
    <>
      <PageHeader title={t('editTitle')} description={`${a.code} · ${a.name}`} />
      <AssetForm asset={a} />
    </>
  );
}
