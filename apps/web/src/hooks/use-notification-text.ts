'use client';

import { type NotificationDto, notificationValues } from '@sc/shared';
import { useTranslations } from 'next-intl';
import { todayInColombo } from '@/lib/format';

/** The plain sentence of a reminder, e.g. "Insurance of JCB 1 (AST-001) expires in 5 days". */
export function useNotificationText() {
  const t = useTranslations();
  const today = todayInColombo();
  return (n: Pick<NotificationDto, 'titleKey' | 'params' | 'dueDate'>) => {
    const values = notificationValues(n, today, {
      enumLabel: (name, value) => t(`enums.${name}.${value}` as 'enums.bondType.BID_BOND'),
      company: t('notifications.company'),
      unit: (meterType) => t(`notifications.units.${meterType}` as 'notifications.units.HOURS'),
    });
    return t(`notifications.titles.${n.titleKey}` as 'notifications.titles.overBudget', values);
  };
}
