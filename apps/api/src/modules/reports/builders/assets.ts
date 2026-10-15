import { sum } from '../../../common/money/money.js';
import { rs, total, totalQty, type BuildContext, type ReportDoc } from '../model.js';
import { enumLabel, named, periodFilter } from './common.js';

export interface AssetUsageRow {
  date: string;
  projectCode: string | null;
  projectName: string | null;
  hoursUsed: string;
  fuelLitres: string | null;
  fuelCost: string | null;
  /** internal machine cost (CostingService rule: hours × hourly rate, else a day rate) */
  machineCost: string;
}

export interface AssetUtilisationInput {
  from: string;
  to: string;
  assets: { code: string; name: string; category: string; logs: AssetUsageRow[] }[];
  maintenance: {
    assetCode: string;
    assetName: string;
    date: string;
    type: string;
    description: string;
    meterReading: string | null;
    cost: string;
    supplier: string | null;
  }[];
  /** only one asset was asked for */
  single: boolean;
}

/** R6 — hours, fuel and cost per machine and project, plus maintenance in the period. */
export function buildAssetUtilisation(
  input: AssetUtilisationInput,
  { t }: BuildContext,
): ReportDoc {
  const maintenanceOf = (code: string) => input.maintenance.filter((m) => m.assetCode === code);
  const summary = input.assets.map((a) => {
    const fuel = total(a.logs.map((l) => l.fuelCost));
    const machine = total(a.logs.map((l) => l.machineCost));
    const repairs = total(maintenanceOf(a.code).map((m) => m.cost));
    return {
      code: a.code,
      name: a.name,
      category: enumLabel(t, 'assetCategory', a.category),
      days: new Set(a.logs.map((l) => l.date)).size,
      hours: totalQty(a.logs.map((l) => l.hoursUsed)),
      litres: totalQty(a.logs.map((l) => l.fuelLitres)),
      fuel,
      machine,
      repairs,
      total: sum([fuel, machine, repairs]).toFixed(2),
    };
  });
  const byProject = input.assets.flatMap((a) => {
    const groups = new Map<string, AssetUsageRow[]>();
    for (const l of a.logs) {
      const key = l.projectCode ?? '';
      groups.set(key, [...(groups.get(key) ?? []), l]);
    }
    return [...groups.entries()].map(([, logs]) => ({
      asset: named(a.name, a.code),
      project: logs[0]!.projectCode
        ? named(logs[0]!.projectName, logs[0]!.projectCode)
        : t('reports.common.noProject'),
      days: new Set(logs.map((l) => l.date)).size,
      hours: totalQty(logs.map((l) => l.hoursUsed)),
      litres: totalQty(logs.map((l) => l.fuelLitres)),
      fuel: total(logs.map((l) => l.fuelCost)),
      machine: total(logs.map((l) => l.machineCost)),
      total: sum(logs.flatMap((l) => [l.fuelCost, l.machineCost])).toFixed(2),
    }));
  });
  const sumKey = <T extends Record<string, unknown>>(rows: T[], k: keyof T) =>
    total(rows.map((r) => r[k] as string));
  return {
    title: t('reports.list.asset-utilisation.name'),
    subtitle:
      input.single && input.assets[0]
        ? named(input.assets[0].name, input.assets[0].code)
        : undefined,
    filters: [periodFilter(t, input.from, input.to)],
    landscape: false,
    filename: `asset-utilisation_${input.from}_${input.to}${input.single && input.assets[0] ? `_${input.assets[0].code}` : ''}`,
    sections: [
      {
        kind: 'table',
        title: t('reports.assets.summary'),
        sheet: t('reports.assets.summary'),
        columns: [
          { key: 'code', label: t('reports.common.code'), type: 'text' },
          { key: 'name', label: t('reports.common.name'), type: 'text' },
          { key: 'days', label: t('reports.assets.days'), type: 'int' },
          { key: 'hours', label: t('reports.assets.hours'), type: 'qty' },
          { key: 'litres', label: t('reports.assets.litres'), type: 'qty' },
          { key: 'fuel', label: rs(t, t('reports.assets.fuel')), type: 'money' },
          { key: 'machine', label: rs(t, t('reports.assets.machineCost')), type: 'money' },
          { key: 'repairs', label: rs(t, t('reports.assets.repairs')), type: 'money' },
          { key: 'total', label: rs(t, t('reports.common.total')), type: 'money' },
        ],
        rows: summary,
        totals: {
          name: t('reports.common.total'),
          days: summary.reduce((a, r) => a + r.days, 0),
          hours: totalQty(summary.map((r) => r.hours)),
          litres: totalQty(summary.map((r) => r.litres)),
          fuel: sumKey(summary, 'fuel'),
          machine: sumKey(summary, 'machine'),
          repairs: sumKey(summary, 'repairs'),
          total: sumKey(summary, 'total'),
        },
      },
      {
        kind: 'table',
        title: t('reports.assets.byProject'),
        sheet: t('reports.assets.byProject'),
        columns: [
          { key: 'asset', label: t('reports.common.asset'), type: 'text' },
          { key: 'project', label: t('reports.common.project'), type: 'text' },
          { key: 'days', label: t('reports.assets.days'), type: 'int' },
          { key: 'hours', label: t('reports.assets.hours'), type: 'qty' },
          { key: 'litres', label: t('reports.assets.litres'), type: 'qty' },
          { key: 'fuel', label: rs(t, t('reports.assets.fuel')), type: 'money' },
          { key: 'machine', label: rs(t, t('reports.assets.machineCost')), type: 'money' },
          { key: 'total', label: rs(t, t('reports.common.total')), type: 'money' },
        ],
        rows: byProject,
        totals: {
          asset: t('reports.common.total'),
          hours: totalQty(byProject.map((r) => r.hours)),
          litres: totalQty(byProject.map((r) => r.litres)),
          fuel: sumKey(byProject, 'fuel'),
          machine: sumKey(byProject, 'machine'),
          total: sumKey(byProject, 'total'),
        },
      },
      {
        kind: 'table',
        title: t('reports.assets.maintenance'),
        sheet: t('reports.assets.maintenance'),
        columns: [
          { key: 'date', label: t('reports.common.date'), type: 'date' },
          { key: 'asset', label: t('reports.common.asset'), type: 'text' },
          { key: 'type', label: t('reports.common.type'), type: 'text' },
          { key: 'description', label: t('reports.common.description'), type: 'text' },
          { key: 'meter', label: t('reports.assets.meter'), type: 'qty' },
          { key: 'supplier', label: t('reports.common.supplier'), type: 'text' },
          { key: 'cost', label: rs(t, t('reports.common.amount')), type: 'money' },
        ],
        rows: input.maintenance.map((m) => ({
          date: m.date,
          asset: named(m.assetName, m.assetCode),
          type: enumLabel(t, 'maintenanceType', m.type),
          description: m.description,
          meter: m.meterReading,
          supplier: m.supplier,
          cost: m.cost,
        })),
        totals: {
          asset: t('reports.common.total'),
          cost: total(input.maintenance.map((m) => m.cost)),
        },
      },
    ],
  };
}
