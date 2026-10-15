'use client';

import type { PayslipDto } from '@sc/shared';
import { useTranslations } from 'next-intl';
import { useEnumLabel } from '@/components/forms/enum-select';
import { StatusChip } from '@/components/status-chip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApi } from '@/hooks/use-resource';
import { toDec } from '@/lib/decimal';
import { formatMoney, formatMonth, formatQty } from '@/lib/format';

/** Worker detail → Payslips: one line per payroll month (PDF payslips come with the reports). */
export function PayslipsPanel({ workerId }: { workerId: string }) {
  const t = useTranslations('payroll');
  const enumLabel = useEnumLabel();
  const { data } = useApi<PayslipDto[]>('payroll', `/workers/${workerId}/payslips`);
  const right = 'text-right whitespace-normal';
  const cell = 'text-right whitespace-nowrap tabular-nums';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('payslips.title')}</CardTitle>
        <p className="text-muted-foreground">{t('payslips.help')}</p>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <p className="py-6 text-center text-muted-foreground">{t('payslips.empty')}</p>
        ) : (
          <Table data-testid="payslips-table">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-normal">{t('payslips.month')}</TableHead>
                <TableHead className={right}>{t('cols.days')}</TableHead>
                <TableHead className={right}>{t('cols.ot')}</TableHead>
                <TableHead className={right}>{t('cols.gross')}</TableHead>
                <TableHead className={right}>{t('payslips.deductions')}</TableHead>
                <TableHead className={right}>{t('cols.net')}</TableHead>
                <TableHead className="whitespace-normal">{t('payslips.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => {
                const deductions = toDec(p.epfEmployee)
                  .plus(toDec(p.advanceDeduction))
                  .plus(toDec(p.otherDeductions))
                  .toFixed(2);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatMonth(`${p.run.year}-${String(p.run.month).padStart(2, '0')}`)}
                    </TableCell>
                    <TableCell className={cell}>{formatQty(p.daysWorked)}</TableCell>
                    <TableCell className={cell}>{formatQty(p.otHours)}</TableCell>
                    <TableCell className={cell}>{formatMoney(p.grossPay)}</TableCell>
                    <TableCell className={cell}>{formatMoney(deductions)}</TableCell>
                    <TableCell className={`${cell} font-semibold`}>
                      {formatMoney(p.netPay)}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={p.run.status}>
                        {enumLabel('PayrollStatus', p.run.status)}
                      </StatusChip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
