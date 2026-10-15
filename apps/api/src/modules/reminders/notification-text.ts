import { type NotificationDto, notificationValues } from '@sc/shared';
import type { Translator } from '../../common/i18n/i18n.service.js';

/** The plain sentence of a notification ("Insurance of JCB 1 (AST-001) expires in 5 days"). */
export function notificationSentence(
  n: Pick<NotificationDto, 'titleKey' | 'params' | 'dueDate'>,
  t: Translator,
  today: string,
): string {
  const values = notificationValues(n, today, {
    enumLabel: (name, value) => t(`enums.${name}.${value}`),
    company: t('notifications.company'),
    unit: (meterType) => t(`notifications.units.${meterType}`),
  });
  return t(`notifications.titles.${n.titleKey}`, values);
}
