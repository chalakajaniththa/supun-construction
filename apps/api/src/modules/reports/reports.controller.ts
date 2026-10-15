import { Controller, Get, HttpStatus, Param, Query, Req, Res } from '@nestjs/common';
import {
  REPORT_IDS,
  REPORT_PARAM_SCHEMAS,
  REPORTS,
  type ReportId,
  reportBaseQuerySchema,
} from '@sc/shared';
import type { Request, Response } from 'express';
import { AppException } from '../../common/errors/app-exception.js';
import { I18nService } from '../../common/i18n/i18n.service.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { contentDisposition } from '../documents/multipart.js';
import { ReportsService } from './reports.service.js';

const isReportId = (id: string): id is ReportId => (REPORT_IDS as readonly string[]).includes(id);

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** The report catalogue (ids, formats, filters). */
  @Get()
  list() {
    return REPORTS;
  }

  /** GET /reports/:id?format=pdf|xlsx&locale=en|si&…filters → file download. */
  @Get(':reportId')
  async download(
    @Param('reportId') reportId: string,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!isReportId(reportId)) {
      throw new AppException(HttpStatus.NOT_FOUND, 'REPORT_NOT_FOUND', 'Unknown report.');
    }
    const base = new ZodValidationPipe(reportBaseQuerySchema).transform(query);
    const params = new ZodValidationPipe(REPORT_PARAM_SCHEMAS[reportId]).transform(query) as Record<
      string,
      unknown
    >;
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const locale = I18nService.pickLocale(base.locale, cookies?.NEXT_LOCALE);
    const file = await this.reports.render(reportId, params, base.format, locale);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('Content-Disposition', contentDisposition(file.fileName, false));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(file.buffer);
  }
}
