import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { todayInColombo } from '../../common/dates/dates.js';
import { I18nService } from '../../common/i18n/i18n.service.js';
import type { Env } from '../../config/env.js';
import { SettingsService } from '../settings/settings.service.js';
import { notificationSentence } from './notification-text.js';
import { NotificationsService } from './notifications.service.js';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Optional daily e-mail with the open reminders, sent to the company e-mail (Settings → Company)
 * after the 06:00 scan. Off unless SMTP_HOST is set; skipped silently without an address or when
 * nothing is open.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly i18n: I18nService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.get('SMTP_HOST', { infer: true }));
  }

  async sendDaily(): Promise<boolean> {
    if (!this.enabled) return false;
    const company = await this.settings.get('company');
    if (!company.email) return false;
    const { items, total } = await this.notifications.topOpen(50);
    if (!items.length) return false;
    const t = this.i18n.translator('en');
    const today = todayInColombo();
    const lines = items.map(
      (n) =>
        `${t(`enums.notificationSeverity.${n.severity}`)}: ${notificationSentence(n, t, today)}`,
    );
    const subject = t('notifications.digest.subject', { count: total, company: company.name });
    const intro = t('notifications.digest.intro', { count: total });
    const transport = createTransport({
      host: this.config.get('SMTP_HOST', { infer: true }),
      port: this.config.get('SMTP_PORT', { infer: true }),
      secure: this.config.get('SMTP_SECURE', { infer: true }),
      auth: this.config.get('SMTP_USER', { infer: true })
        ? {
            user: this.config.get('SMTP_USER', { infer: true })!,
            pass: this.config.get('SMTP_PASS', { infer: true }) ?? '',
          }
        : undefined,
    });
    await transport.sendMail({
      from: this.config.get('SMTP_FROM', { infer: true }) || company.email,
      to: company.email,
      subject,
      text: [intro, '', ...lines.map((l) => `• ${l}`)].join('\n'),
      html: `<p>${escapeHtml(intro)}</p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`,
    });
    this.logger.log(`Reminder e-mail sent to ${company.email} (${items.length} items)`);
    return true;
  }
}
