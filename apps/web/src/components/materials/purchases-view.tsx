'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ComingSoonPanel, DetailTabs } from '@/components/detail-page';
import { TabsContent } from '@/components/ui/tabs';
import { MaterialsManager } from './materials-manager';

const TABS = ['purchases', 'store', 'materials'] as const;
type Tab = (typeof TABS)[number];

/** Purchases & Store. Step 2 builds the materials catalog; purchases and the store come in Step 3. */
export function PurchasesView({ initialTab }: { initialTab: Tab }) {
  const t = useTranslations('purchases');
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <DetailTabs tabs={TABS} value={tab} onChange={setTab} label={(k) => t(`tabs.${k}`)}>
      <TabsContent value="purchases">
        <ComingSoonPanel />
      </TabsContent>
      <TabsContent value="store">
        <ComingSoonPanel />
      </TabsContent>
      <TabsContent value="materials">
        <MaterialsManager />
      </TabsContent>
    </DetailTabs>
  );
}
