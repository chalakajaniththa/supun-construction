'use client';

import type { DashboardSeriesPoint } from '@sc/shared';
import { useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/format';

/** Validated pair (dataviz validator: CVD ΔE 23, contrast ≥ 3:1 on white). */
const SPENT = '#c2620f';
const RECEIVED = '#2a5da8';

const shortMonth = (m: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(
    new Date(`${m}-01T00:00:00Z`),
  );
const compact = (v: number) =>
  new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** Spent vs received, last 6 months — one small grouped bar chart (one axis, money). */
export function SpendChart({ series }: { series: DashboardSeriesPoint[] }) {
  const t = useTranslations('dashboard');
  // Recharts needs numbers for geometry; the tooltip and table show the exact strings.
  const data = series.map((p) => ({
    month: shortMonth(p.month),
    spent: Number(p.spent),
    received: Number(p.received),
    spentText: formatMoney(p.spent),
    receivedText: formatMoney(p.received),
  }));
  return (
    <figure className="m-0" data-testid="spend-chart">
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="22%"
          >
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 13 }}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickFormatter={compact}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              formatter={(_v, name, item) => [
                name === 'spent' ? item.payload.spentText : item.payload.receivedText,
                name === 'spent' ? t('spent') : t('received'),
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="circle"
              formatter={(v) => (
                <span className="text-sm text-foreground">
                  {v === 'spent' ? t('spent') : t('received')}
                </span>
              )}
            />
            <Bar dataKey="spent" fill={SPENT} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="received" fill={RECEIVED} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t('chartTitle')}</caption>
        <thead>
          <tr>
            <th />
            <th>{t('spent')}</th>
            <th>{t('received')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th>{d.month}</th>
              <td>{d.spentText}</td>
              <td>{d.receivedText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
