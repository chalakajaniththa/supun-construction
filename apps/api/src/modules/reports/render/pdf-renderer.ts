import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable, Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { AppException } from '../../../common/errors/app-exception.js';
import type { Translator } from '../../../common/i18n/i18n.service.js';
import type { Env } from '../../../config/env.js';
import { type CellType, type ReportCompany, type ReportDoc, cellLabel } from '../model.js';

/** src/reports/templates (copied to dist/reports/templates by the Nest CLI). */
export function templatesDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reports', 'templates');
}

const FONTS = [
  { family: 'Noto Sans', weight: 400, file: 'NotoSans-Regular.ttf' },
  { family: 'Noto Sans', weight: 700, file: 'NotoSans-Bold.ttf' },
  { family: 'Noto Sans Sinhala', weight: 400, file: 'NotoSansSinhala-Regular.ttf' },
  { family: 'Noto Sans Sinhala', weight: 700, file: 'NotoSansSinhala-Bold.ttf' },
];

const align = (type: CellType) =>
  type === 'money' || type === 'qty' || type === 'int' || type === 'pct'
    ? 'r'
    : type === 'date'
      ? 'd'
      : '';

/** Formats every cell and turns sections into what layout.hbs expects. */
export function toViewModel(
  doc: ReportDoc,
  company: ReportCompany,
  t: Translator,
  generatedAt: string,
) {
  return {
    lang: t.locale,
    title: doc.title,
    subtitle: doc.subtitle,
    landscape: doc.landscape,
    filters: doc.filters,
    company,
    cidaLabel: t('reports.common.cidaGrade'),
    generatedLabel: t('reports.common.generated'),
    generatedAt,
    emptyLabel: t('reports.common.empty'),
    sections: doc.sections.map((s) =>
      s.kind === 'table'
        ? {
            isTable: true,
            title: s.title,
            note: s.note,
            dense: s.dense,
            pageBreakBefore: s.pageBreakBefore,
            columns: s.columns.map((c) => ({ label: c.label, align: align(c.type) })),
            rows: s.rows.map((r) =>
              s.columns.map((c) => ({
                text: cellLabel(r[c.key] ?? null, c.type),
                align: align(c.type),
              })),
            ),
            totals: s.totals
              ? s.columns.map((c) => ({
                  text: cellLabel(s.totals![c.key] ?? null, c.type),
                  align: align(c.type),
                }))
              : null,
          }
        : {
            isKeyValue: true,
            title: s.title,
            note: s.note,
            pageBreakBefore: s.pageBreakBefore,
            items: s.items.map((i) => ({
              label: i.label,
              value:
                i.type === 'money' && i.value !== null && i.value !== ''
                  ? `${t('common.rupees')} ${cellLabel(i.value, 'money')}`
                  : cellLabel(i.value, i.type),
              strong: i.strong,
            })),
          },
    ),
  };
}

/** HTML (Handlebars) → PDF (Gotenberg, Chromium). Fonts are embedded so Sinhala renders. */
@Injectable()
export class PdfRenderer {
  private readonly logger = new Logger(PdfRenderer.name);
  private readonly layout: Handlebars.TemplateDelegate;
  private readonly footer: string;
  private readonly fontsCss: string;
  private readonly gotenberg: string;

  constructor(config: ConfigService<Env, true>) {
    const dir = templatesDir();
    this.layout = Handlebars.compile(readFileSync(join(dir, 'layout.hbs'), 'utf8'), {
      strict: false,
    });
    this.footer = readFileSync(join(dir, 'footer.hbs'), 'utf8');
    this.fontsCss = FONTS.map((f) => {
      const b64 = readFileSync(join(dir, 'fonts', f.file)).toString('base64');
      return `@font-face { font-family: '${f.family}'; font-weight: ${f.weight}; font-style: normal; src: url(data:font/ttf;base64,${b64}) format('truetype'); }`;
    }).join('\n');
    this.gotenberg = config.get('GOTENBERG_URL', { infer: true }).replace(/\/+$/, '');
  }

  html(doc: ReportDoc, company: ReportCompany, t: Translator, generatedAt: string): string {
    return this.layout({ ...toViewModel(doc, company, t, generatedAt), fontsCss: this.fontsCss });
  }

  async render(
    doc: ReportDoc,
    company: ReportCompany,
    t: Translator,
    generatedAt: string,
  ): Promise<Buffer> {
    const form = new FormData();
    form.append(
      'files',
      new Blob([this.html(doc, company, t, generatedAt)], { type: 'text/html' }),
      'index.html',
    );
    form.append('files', new Blob([this.footer], { type: 'text/html' }), 'footer.html');
    // A4 in inches; Gotenberg swaps width/height for landscape.
    form.append('paperWidth', '8.27');
    form.append('paperHeight', '11.69');
    form.append('marginTop', '0.45');
    form.append('marginBottom', '0.55');
    form.append('marginLeft', '0.45');
    form.append('marginRight', '0.45');
    form.append('landscape', String(doc.landscape));
    form.append('printBackground', 'true');
    let res: Response;
    try {
      res = await fetch(`${this.gotenberg}/forms/chromium/convert/html`, {
        method: 'POST',
        body: form,
      });
    } catch (err) {
      this.logger.error(`Gotenberg not reachable: ${String(err)}`);
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        'PDF_FAILED',
        'The PDF service is not available.',
      );
    }
    if (!res.ok) {
      this.logger.error(`Gotenberg ${res.status}: ${(await res.text()).slice(0, 500)}`);
      throw new AppException(HttpStatus.BAD_GATEWAY, 'PDF_FAILED', 'The PDF could not be made.');
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
