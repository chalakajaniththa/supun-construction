import { daysUntil } from '../../reminders/calc/rules.js';
import { rs, type BuildContext, type ReportDoc } from '../model.js';
import { enumLabel, named } from './common.js';

export interface ExpiryReportInput {
  days: number;
  documents: {
    title: string;
    category: string;
    ownerType: string;
    ownerName: string | null;
    ownerCode: string | null;
    expiryDate: string;
    fileName: string | null;
  }[];
  bonds: {
    type: string;
    referenceNo: string;
    bank: string;
    amount: string;
    expiryDate: string;
    project: { code: string; name: string };
  }[];
}

/** R10 — documents and bonds expiring in the next N days (already expired ones first). */
export function buildExpiry(input: ExpiryReportInput, { t, today }: BuildContext): ReportDoc {
  const left = (d: string) => {
    const n = daysUntil(today, d);
    return n < 0
      ? t('reports.expiry.expiredAgo', { days: -n })
      : t('reports.expiry.daysLeft', { days: n });
  };
  return {
    title: t('reports.list.expiry.name'),
    filters: [
      {
        label: t('reports.expiry.window'),
        value: t('reports.expiry.nextDays', { days: input.days }),
      },
    ],
    landscape: false,
    filename: `expiry_${today}_${input.days}d`,
    sections: [
      {
        kind: 'table',
        title: t('reports.expiry.documents'),
        sheet: t('reports.expiry.documents'),
        columns: [
          { key: 'expiry', label: t('reports.expiry.expiry'), type: 'date' },
          { key: 'left', label: t('reports.expiry.left'), type: 'text' },
          { key: 'category', label: t('reports.common.category'), type: 'text' },
          { key: 'title', label: t('reports.expiry.document'), type: 'text' },
          { key: 'owner', label: t('reports.expiry.owner'), type: 'text' },
        ],
        rows: input.documents.map((d) => ({
          expiry: d.expiryDate,
          left: left(d.expiryDate),
          category: enumLabel(t, 'documentCategory', d.category),
          title: d.title,
          owner:
            d.ownerType === 'COMPANY'
              ? t('notifications.company')
              : `${enumLabel(t, 'documentOwnerType', d.ownerType)}: ${named(d.ownerName, d.ownerCode)}`,
        })),
      },
      {
        kind: 'table',
        title: t('reports.expiry.bonds'),
        sheet: t('reports.expiry.bonds'),
        columns: [
          { key: 'expiry', label: t('reports.expiry.expiry'), type: 'date' },
          { key: 'left', label: t('reports.expiry.left'), type: 'text' },
          { key: 'type', label: t('reports.common.type'), type: 'text' },
          { key: 'reference', label: t('reports.common.reference'), type: 'text' },
          { key: 'bank', label: t('reports.expiry.bank'), type: 'text' },
          { key: 'project', label: t('reports.common.project'), type: 'text' },
          { key: 'amount', label: rs(t, t('reports.common.amount')), type: 'money' },
        ],
        rows: input.bonds.map((b) => ({
          expiry: b.expiryDate,
          left: left(b.expiryDate),
          type: enumLabel(t, 'bondType', b.type),
          reference: b.referenceNo,
          bank: b.bank,
          project: named(b.project.name, b.project.code),
          amount: b.amount,
        })),
      },
    ],
  };
}
