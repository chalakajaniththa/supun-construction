import type { CertificateDto, FinanceSummaryDto } from '@sc/shared';
import { dec } from '../../../common/money/money.js';
import { dateLabel, type BuildContext, type ReportDoc } from '../model.js';
import { enumLabel, named } from './common.js';

export interface IpcReportInput {
  project: {
    code: string;
    name: string;
    clientName: string | null;
    contractNo: string | null;
    contractValue: string;
    source: string;
  };
  certificate: CertificateDto;
  finance: FinanceSummaryDto;
}

const neg = (v: string) => (dec(v).isZero() ? '0.00' : dec(v).neg().toFixed(2));

/** R9 — an IPC / progress bill printout with every step of the calculation. */
export function buildIpc(
  { project, certificate: c, finance }: IpcReportInput,
  { t }: BuildContext,
): ReportDoc {
  const calc = c.calculation;
  const government = project.source === 'GOVERNMENT_TENDER';
  return {
    title: government ? t('reports.ipc.titleIpc') : t('reports.ipc.titleBill'),
    subtitle: `${c.code} — ${named(project.name, project.code)}`,
    filters: [
      ...(project.clientName
        ? [{ label: t('reports.common.client'), value: project.clientName }]
        : []),
      ...(project.contractNo
        ? [{ label: t('reports.ipc.contractNo'), value: project.contractNo }]
        : []),
      {
        label: t('reports.ipc.period'),
        value: `${dateLabel(c.periodFrom)} – ${dateLabel(c.periodTo)}`,
      },
      { label: t('reports.common.status'), value: enumLabel(t, 'certificateStatus', c.status) },
    ],
    landscape: false,
    filename: `ipc_${c.code}`,
    sections: [
      {
        kind: 'keyValue',
        title: t('reports.ipc.calculation'),
        items: [
          { label: t('reports.ipc.cumulative'), value: c.cumulativeWorkDone, type: 'money' },
          { label: t('reports.ipc.previous'), value: neg(c.previousCertified), type: 'money' },
          { label: t('reports.ipc.gross'), value: c.grossThisBill, type: 'money', strong: true },
          {
            label: t('reports.ipc.retention', { pct: dec(calc.retentionPct).toString() }),
            value: neg(c.retentionDeducted),
            type: 'money',
          },
          {
            label: t('reports.ipc.advance', { pct: dec(calc.advanceRecoveryPct).toString() }),
            value: neg(c.advanceRecovered),
            type: 'money',
          },
          {
            label: c.otherDeductionsNote
              ? `${t('reports.ipc.other')} (${c.otherDeductionsNote})`
              : t('reports.ipc.other'),
            value: neg(c.otherDeductions),
            type: 'money',
          },
          { label: t('reports.ipc.net'), value: c.netPayable, type: 'money', strong: true },
        ],
      },
      {
        kind: 'keyValue',
        title: t('reports.ipc.contract'),
        items: [
          {
            label: t('reports.ipc.contractValue'),
            value: finance.effectiveContractValue,
            type: 'money',
          },
          { label: t('reports.ipc.measured'), value: calc.measuredWorkDone, type: 'money' },
          { label: t('reports.ipc.retentionCap'), value: calc.retentionCap, type: 'money' },
          { label: t('reports.ipc.retentionHeld'), value: finance.retentionHeld, type: 'money' },
          { label: t('reports.ipc.advanceBalance'), value: finance.advanceBalance, type: 'money' },
          { label: t('reports.ipc.paid'), value: c.paid, type: 'money' },
          ...(c.submittedDate
            ? [{ label: t('reports.ipc.submitted'), value: c.submittedDate, type: 'date' as const }]
            : []),
          ...(c.certifiedDate
            ? [{ label: t('reports.ipc.certified'), value: c.certifiedDate, type: 'date' as const }]
            : []),
        ],
      },
      {
        kind: 'keyValue',
        title: t('reports.ipc.signatures'),
        items: [
          { label: t('reports.ipc.contractor'), value: '______________________', type: 'text' },
          { label: t('reports.ipc.engineer'), value: '______________________', type: 'text' },
        ],
      },
    ],
  };
}
