'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DetailTabs } from '@/components/detail-page';
import { TabsContent } from '@/components/ui/tabs';
import { MaterialsManager } from './materials-manager';
import { PurchasesList } from './purchases-list';
import { IssuesList, StoreStock } from './store-view';

export const PURCHASE_TABS = ['purchases', 'store', 'issues', 'materials'] as const;
export type PurchaseTab = (typeof PURCHASE_TABS)[number];

/** Purchases & Store: purchases, store stock, issues to projects and the materials catalog. */
export function PurchasesView({ initialTab }: { initialTab: PurchaseTab }) {
  const t = useTranslations('purchases');
  const [tab, setTab] = useState<PurchaseTab>(initialTab);
  return (
    <DetailTabs tabs={PURCHASE_TABS} value={tab} onChange={setTab} label={(k) => t(`tabs.${k}`)}>
      <TabsContent value="purchases">
        <PurchasesList />
      </TabsContent>
      <TabsContent value="store">
        <StoreStock />
      </TabsContent>
      <TabsContent value="issues">
        <IssuesList />
      </TabsContent>
      <TabsContent value="materials">
        <MaterialsManager />
      </TabsContent>
    </DetailTabs>
  );
}
