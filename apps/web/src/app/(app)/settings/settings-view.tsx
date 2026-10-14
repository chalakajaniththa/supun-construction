'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/hooks/use-settings';
import { useErrorMessage } from '@/hooks/use-error-message';
import { BillingForm, CompanyForm, PayrollForm, RemindersForm } from './settings-forms';
import { ChangePasswordForm } from './change-password-form';
import { SETTINGS_TABS, type SettingsTab } from './settings-tabs';

export function SettingsView({ initialTab }: { initialTab: SettingsTab }) {
  const t = useTranslations('settings');
  const errorMessage = useErrorMessage();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const { data, isLoading, error } = useSettings();

  // Follow ?tab= when it changes (e.g. "Change password" in the user menu while already here).
  const [lastInitialTab, setLastInitialTab] = useState(initialTab);
  if (lastInitialTab !== initialTab) {
    setLastInitialTab(initialTab);
    setTab(initialTab);
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)} className="gap-4">
      <TabsList className="h-auto flex-wrap justify-start">
        {SETTINGS_TABS.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className="px-3 py-1.5 text-[0.95rem]"
            data-testid={`tab-${key}`}
          >
            {t(`tabs.${key}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {errorMessage(error)}
          </CardContent>
        </Card>
      ) : isLoading || !data ? (
        tab === 'password' ? (
          <ChangePasswordForm />
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 py-6">
              <Skeleton className="h-6 w-60" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        )
      ) : (
        <>
          <TabsContent value="company">
            <CompanyForm value={data.company} />
          </TabsContent>
          <TabsContent value="payroll">
            <PayrollForm value={data.payroll} />
          </TabsContent>
          <TabsContent value="reminders">
            <RemindersForm value={data.reminders} />
          </TabsContent>
          <TabsContent value="billing">
            <BillingForm value={data.billing} />
          </TabsContent>
          <TabsContent value="password">
            <ChangePasswordForm />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
