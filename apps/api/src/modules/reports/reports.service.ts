import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  type CertificateDto,
  type ExpenseCategory,
  type FinanceSummaryDto,
  type PayrollRunDto,
  type ReportFormat,
  type ReportId,
  type ReportParams,
  type StatementDto,
  type SupplierBalanceDto,
  colomboTime,
  dayToDate,
  monthRange,
  reportDefinition,
  toDay,
} from '@sc/shared';
import { addDays, todayInColombo } from '../../common/dates/dates.js';
import { AppException } from '../../common/errors/app-exception.js';
import { I18nService, type Locale } from '../../common/i18n/i18n.service.js';
import { asDto } from '../../common/money/as-dto.js';
import { requireProject } from '../../common/projects/require-project.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { BillingService } from '../billing/billing.service.js';
import { BondsService } from '../bonds/bonds.service.js';
import { machineCost } from '../costing/calc/costing.js';
import { CostingService } from '../costing/costing.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { PayrollService } from '../payroll/payroll.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { SupplierAccountsService } from '../suppliers/supplier-accounts.service.js';
import { buildAssetUtilisation } from './builders/assets.js';
import { buildAttendance } from './builders/attendance.js';
import { buildBusinessSummary } from './builders/business-summary.js';
import { buildExpenses } from './builders/expenses.js';
import { buildExpiry } from './builders/expiry.js';
import { buildIpc } from './builders/ipc.js';
import { buildEpfEtf, buildPayrollSheet, buildPayslips } from './builders/payroll.js';
import { buildProjectCost, type ProjectCostInput } from './builders/project-cost.js';
import { buildSupplierBalances, buildSupplierStatement } from './builders/suppliers.js';
import {
  type BuildContext,
  type ReportCompany,
  type ReportDoc,
  dateLabel,
  total,
} from './model.js';
import { PdfRenderer } from './render/pdf-renderer.js';
import { renderXlsx } from './render/xlsx-renderer.js';

export interface RenderedReport {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

const CONTENT_TYPES: Record<ReportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Builds reports from the existing services (no calculation is repeated here). */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly pdf: PdfRenderer,
    private readonly costing: CostingService,
    private readonly payroll: PayrollService,
    private readonly billing: BillingService,
    private readonly bonds: BondsService,
    private readonly documents: DocumentsService,
    private readonly suppliers: SupplierAccountsService,
  ) {}

  async render(
    reportId: ReportId,
    params: Record<string, unknown>,
    format: ReportFormat,
    locale: Locale,
  ): Promise<RenderedReport> {
    const def = reportDefinition(reportId);
    if (!def) throw new AppException(HttpStatus.NOT_FOUND, 'REPORT_NOT_FOUND', 'Unknown report.');
    if (!def.formats.includes(format)) {
      throw AppException.badRequest(
        'REPORT_FORMAT_NOT_AVAILABLE',
        'This report has no such format.',
      );
    }
    const t = this.i18n.translator(locale);
    const today = todayInColombo();
    const ctx: BuildContext = { t, today };
    const doc = await this.build(reportId, params, ctx);
    const company = await this.company();
    const generatedAt = `${dateLabel(today)} ${colomboTime(new Date())}`;
    const buffer =
      format === 'pdf'
        ? await this.pdf.render(doc, company, t, generatedAt)
        : await renderXlsx(doc, company, t, generatedAt);
    return { buffer, contentType: CONTENT_TYPES[format], fileName: `${doc.filename}.${format}` };
  }

  /** The report as data (also used by the tests). */
  async build(
    reportId: ReportId,
    params: Record<string, unknown>,
    ctx: BuildContext,
  ): Promise<ReportDoc> {
    switch (reportId) {
      case 'project-cost':
        return buildProjectCost(
          await this.projectCostInput(params as ReportParams<'project-cost'>),
          ctx,
        );
      case 'payroll-sheet':
        return buildPayrollSheet(
          await this.payrollInput((params as ReportParams<'payroll-sheet'>).month),
          ctx,
        );
      case 'payslips': {
        const p = params as ReportParams<'payslips'>;
        return buildPayslips(await this.payrollInput(p.month), ctx, p.workerId);
      }
      case 'epf-etf':
        return buildEpfEtf(await this.payrollInput((params as ReportParams<'epf-etf'>).month), ctx);
      case 'attendance':
        return buildAttendance(
          await this.attendanceInput(params as ReportParams<'attendance'>),
          ctx,
        );
      case 'asset-utilisation':
        return buildAssetUtilisation(
          await this.assetInput(params as ReportParams<'asset-utilisation'>, ctx.today),
          ctx,
        );
      case 'expenses':
        return buildExpenses(
          await this.expensesInput(params as ReportParams<'expenses'>, ctx.today),
          ctx,
        );
      case 'supplier-statement': {
        const p = params as ReportParams<'supplier-statement'>;
        if (p.supplierId) {
          const s = await this.suppliers.statement(p.supplierId, { from: p.from, to: p.to });
          return buildSupplierStatement(asDto<StatementDto>(s), ctx);
        }
        return buildSupplierBalances(
          asDto<SupplierBalanceDto[]>(await this.suppliers.balances()),
          ctx,
        );
      }
      case 'ipc':
        return buildIpc(await this.ipcInput(params as ReportParams<'ipc'>), ctx);
      case 'expiry':
        return buildExpiry(
          await this.expiryInput((params as ReportParams<'expiry'>).days, ctx.today),
          ctx,
        );
      case 'business-summary':
        return buildBusinessSummary(
          await this.summaryInput((params as ReportParams<'business-summary'>).month, ctx.today),
          ctx,
        );
    }
  }

  // ── Header ──────────────────────────────────────────────────────────────

  private async company(): Promise<ReportCompany> {
    const c = await this.settings.get('company');
    return {
      name: c.name,
      address: c.address,
      phone: c.phone,
      email: c.email,
      cidaGrade: c.cidaGrade,
      logo: await this.logo(c.logoDocId ?? null),
    };
  }

  /** The company logo (a COMPANY document) as a data: URL, or null. */
  private async logo(docId: string | null): Promise<string | null> {
    if (!docId) return null;
    try {
      const doc = await this.prisma.document.findFirst({
        where: { id: docId, deletedAt: null },
        include: { currentVersion: true },
      });
      const v = doc?.currentVersion;
      if (!v || !/^image\/(png|jpeg|webp)$/.test(v.mimeType) || v.sizeBytes > 2_000_000)
        return null;
      const { stream } = await this.storage.getObjectStream(v.storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
      return `data:${v.mimeType};base64,${Buffer.concat(chunks).toString('base64')}`;
    } catch (err) {
      this.logger.warn(`Logo not loaded: ${String(err)}`);
      return null;
    }
  }

  // ── Data for each report ────────────────────────────────────────────────

  private async projectCostInput(p: ReportParams<'project-cost'>): Promise<ProjectCostInput> {
    await requireProject(this.prisma, p.projectId);
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: p.projectId },
      include: { client: { select: { name: true } } },
    });
    const costs = asDto<ProjectCostInput['costs']>(
      await this.costing.compute(project, p.from, p.to),
    );
    return {
      project: { code: project.code, name: project.name, clientName: project.client?.name ?? null },
      from: p.from,
      to: p.to,
      costs,
    };
  }

  private async payrollInput(month: string) {
    const year = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const runs = await this.payroll.list({ year, month: m });
    const summary = (runs as { id: string }[])[0];
    if (!summary) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'NO_PAYROLL_FOR_MONTH',
        'No salaries were calculated for this month.',
      );
    }
    const [run, settings] = await Promise.all([
      this.payroll.get(summary.id),
      this.settings.get('payroll'),
    ]);
    return { run: asDto<PayrollRunDto>(run), settings };
  }

  private async attendanceInput(p: ReportParams<'attendance'>) {
    const { from, to } = monthRange(p.month);
    const project = p.projectId ? await requireProject(this.prisma, p.projectId) : null;
    const rows = await this.prisma.attendance.findMany({
      where: {
        date: { gte: dayToDate(from), lte: dayToDate(to) },
        ...(p.projectId ? { projectId: p.projectId } : {}),
      },
      select: {
        date: true,
        status: true,
        otHours: true,
        worker: { select: { id: true, code: true, fullName: true } },
      },
      orderBy: [{ worker: { code: 'asc' } }, { date: 'asc' }],
    });
    const workers = new Map<
      string,
      {
        code: string;
        name: string;
        records: { date: string; status: (typeof rows)[number]['status']; otHours: string }[];
      }
    >();
    for (const r of rows) {
      let w = workers.get(r.worker.id);
      if (!w) {
        w = { code: r.worker.code, name: r.worker.fullName, records: [] };
        workers.set(r.worker.id, w);
      }
      w.records.push({ date: toDay(r.date), status: r.status, otHours: r.otHours.toString() });
    }
    return {
      month: p.month,
      project: project ? { code: project.code, name: project.name } : null,
      workers: [...workers.values()],
    };
  }

  private defaultRange(from: string | undefined, to: string | undefined, today: string) {
    const end = to ?? today;
    return { from: from ?? `${end.slice(0, 7)}-01`, to: end };
  }

  private async assetInput(p: ReportParams<'asset-utilisation'>, today: string) {
    const { from, to } = this.defaultRange(p.from, p.to, today);
    const date = { gte: dayToDate(from), lte: dayToDate(to) };
    const [assets, logs, maintenance] = await Promise.all([
      this.prisma.asset.findMany({
        where: p.assetId ? { id: p.assetId } : { deletedAt: null },
        orderBy: { code: 'asc' },
      }),
      this.prisma.assetUsageLog.findMany({
        where: { date, ...(p.assetId ? { assetId: p.assetId } : {}) },
        include: { project: { select: { code: true, name: true } } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.maintenanceRecord.findMany({
        where: { date, ...(p.assetId ? { assetId: p.assetId } : {}) },
        include: {
          asset: { select: { code: true, name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: [{ date: 'asc' }],
      }),
    ]);
    if (p.assetId && !assets.length) throw AppException.notFound('Machine not found.');
    const used = new Set([...logs.map((l) => l.assetId), ...maintenance.map((m) => m.assetId)]);
    return {
      from,
      to,
      single: Boolean(p.assetId),
      assets: assets
        .filter((a) => p.assetId || used.has(a.id))
        .map((a) => ({
          code: a.code,
          name: a.name,
          category: a.category,
          logs: logs
            .filter((l) => l.assetId === a.id)
            .map((l) => ({
              date: toDay(l.date),
              projectCode: l.project?.code ?? null,
              projectName: l.project?.name ?? null,
              hoursUsed: l.hoursUsed.toString(),
              fuelLitres: l.fuelLitres?.toString() ?? null,
              fuelCost: l.fuelCost?.toString() ?? null,
              machineCost: machineCost({
                hoursUsed: l.hoursUsed,
                ratePerHour: a.internalRatePerHour,
                ratePerDay: a.internalRatePerDay,
              }).amount.toFixed(2),
            })),
        })),
      maintenance: maintenance.map((m) => ({
        assetCode: m.asset.code,
        assetName: m.asset.name,
        date: toDay(m.date),
        type: m.type,
        description: m.description,
        meterReading: m.meterReading?.toString() ?? null,
        cost: m.cost.toString(),
        supplier: m.supplier?.name ?? null,
      })),
    };
  }

  private async expensesInput(p: ReportParams<'expenses'>, today: string) {
    const { from, to } = this.defaultRange(p.from, p.to, today);
    const project = p.projectId ? await requireProject(this.prisma, p.projectId) : null;
    const rows = await this.prisma.expense.findMany({
      where: {
        date: { gte: dayToDate(from), lte: dayToDate(to) },
        ...(p.projectId ? { projectId: p.projectId } : {}),
        ...(p.category ? { category: p.category } : {}),
      },
      include: {
        project: { select: { code: true, name: true } },
        asset: { select: { code: true, name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    return {
      from,
      to,
      project: project ? { code: project.code, name: project.name } : null,
      category: (p.category ?? null) as ExpenseCategory | null,
      expenses: rows.map((x) => ({
        date: toDay(x.date),
        category: x.category,
        description: x.description,
        amount: x.amount.toString(),
        paidBy: x.paidBy,
        project: x.project,
        asset: x.asset,
        supplier: x.supplier,
      })),
    };
  }

  private async ipcInput(p: ReportParams<'ipc'>) {
    const [certificate, finance, project] = await Promise.all([
      this.billing.get(p.projectId, p.certificateId),
      this.billing.summary(p.projectId),
      this.prisma.project.findUniqueOrThrow({
        where: { id: p.projectId },
        include: { client: { select: { name: true } } },
      }),
    ]);
    return {
      project: {
        code: project.code,
        name: project.name,
        clientName: project.client?.name ?? null,
        contractNo: project.contractNo,
        contractValue: project.contractValue.toString(),
        source: project.source,
      },
      certificate: asDto<CertificateDto>(certificate),
      finance: asDto<FinanceSummaryDto>(finance),
    };
  }

  private async expiryInput(days: number, today: string) {
    const [docs, bonds] = await Promise.all([
      this.documents.expiringUntil(addDays(today, days)),
      this.bonds.list({ expiringWithin: days }),
    ]);
    return {
      days,
      documents: docs
        .filter((d) => d.currentVersion?.expiryDate)
        .map((d) => ({
          title: d.title,
          category: d.category,
          ownerType: d.ownerType,
          ownerName: d.ownerName,
          ownerCode: d.ownerCode,
          expiryDate: toDay(d.currentVersion!.expiryDate),
          fileName: d.currentVersion!.fileName,
        })),
      bonds: bonds.map((b) => ({
        type: b.type,
        referenceNo: b.referenceNo,
        bank: b.bank,
        amount: b.amount.toFixed(2),
        expiryDate: toDay(b.expiryDate),
        project: { code: b.project.code, name: b.project.name },
      })),
    };
  }

  private async summaryInput(month: string, today: string) {
    const range = monthRange(month);
    const bounds = { month, from: range.from, to: range.to < today ? range.to : today };
    const date = { gte: dayToDate(bounds.from), lte: dayToDate(bounds.to) };
    const [projects, payments, loose] = await Promise.all([
      this.prisma.project.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' } }),
      this.prisma.clientPayment.findMany({
        where: { date },
        select: { projectId: true, kind: true, amount: true },
      }),
      this.prisma.expense.aggregate({ where: { projectId: null, date }, _sum: { amount: true } }),
    ]);
    const future = bounds.from > today;
    const rows = await Promise.all(
      projects.map(async (p) => {
        const [monthly, finance] = await Promise.all([
          future ? Promise.resolve(new Map()) : this.costing.monthlyActuals(p, [bounds]),
          this.billing.summaryOf(this.prisma, p),
        ]);
        const fin = asDto<FinanceSummaryDto>(finance);
        return {
          code: p.code,
          name: p.name,
          status: p.status,
          spent: monthly.get(month)?.total.actual.toFixed(2) ?? '0.00',
          received: total(
            payments.filter((x) => x.projectId === p.id).map((x) => x.amount.toString()),
          ),
          receivable: fin.receivable,
          retentionHeld: fin.retentionHeld,
        };
      }),
    );
    return {
      month,
      projects: rows,
      overheadExpenses: loose._sum.amount?.toFixed(2) ?? '0.00',
      payments: payments.map((x) => ({ kind: x.kind, amount: x.amount.toString() })),
    };
  }
}
