'use client';

import type { DocumentDto } from '@sc/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DetailTabs } from '@/components/detail-page';
import { EnumFilter } from '@/components/forms/enum-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { useListState } from '@/hooks/use-list-state';
import { useList } from '@/hooks/use-resource';
import { DocumentPanel } from './document-panel';
import { DocumentTable } from './document-table';
import { UploadDocumentDialog } from './upload-dialog';

const TABS = ['company', 'all'] as const;
export type DocumentsTab = (typeof TABS)[number];
const EXPIRING = ['7', '30', '90'] as const;

/** Every document, any owner: search by title / file / owner, filter by owner type, category, expiry. */
function AllDocuments({ initialExpiring }: { initialExpiring?: string }) {
  const t = useTranslations('documents');
  const list = useListState({
    ownerType: undefined as string | undefined,
    category: undefined as string | undefined,
    expiring: initialExpiring as string | undefined,
  });
  const { data, isLoading } = useList<DocumentDto>('documents', list.params);
  return (
    <DocumentTable
      showOwner
      data={data?.items}
      total={data?.total}
      page={list.page}
      onPageChange={list.setPage}
      search={list.search}
      onSearchChange={list.setSearch}
      isLoading={isLoading}
      toolbar={
        <>
          <EnumFilter
            enumName="DocumentOwnerType"
            value={list.filters.ownerType}
            onChange={(v) => list.setFilter('ownerType', v || undefined)}
            allLabel={t('allOwners')}
          />
          <EnumFilter
            enumName="DocumentCategory"
            value={list.filters.category}
            onChange={(v) => list.setFilter('category', v || undefined)}
            allLabel={t('allCategories')}
          />
          <div className="w-60" data-testid="filter-expiring">
            <Select
              value={list.filters.expiring ?? 'any'}
              onValueChange={(v) => list.setFilter('expiring', v === 'any' ? undefined : v)}
            >
              <SelectTrigger
                aria-label={t('expiringFilter')}
                className="h-10 w-full text-base data-[size=default]:h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('expiringAny')}</SelectItem>
                {EXPIRING.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t('expiringWithin', { days: Number(d) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      }
    />
  );
}

export function DocumentsView({
  initialTab,
  openUpload,
  initialExpiring,
}: {
  initialTab: DocumentsTab;
  openUpload: boolean;
  initialExpiring?: string;
}) {
  const t = useTranslations('documents');
  const [tab, setTab] = useState<DocumentsTab>(initialTab);
  const [uploadOpen, setUploadOpen] = useState(openUpload);
  return (
    <>
      <DetailTabs tabs={TABS} value={tab} onChange={setTab} label={(k) => t(`tabs.${k}`)}>
        <TabsContent value="company">
          <p className="mb-3 text-muted-foreground">{t('companyHint')}</p>
          <DocumentPanel ownerType="COMPANY" />
        </TabsContent>
        <TabsContent value="all">
          <AllDocuments initialExpiring={initialExpiring} />
        </TabsContent>
      </DetailTabs>
      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} ownerType="COMPANY" />
    </>
  );
}
