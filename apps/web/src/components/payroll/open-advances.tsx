'use client';

import type { AdvanceListDto } from '@sc/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
import { formatDate, formatMoney } from '@/lib/format';

/** Payroll (placeholder until Step 4): the open salary advances that payroll will recover. */
export function OpenAdvances() {
  const t = useTranslations('payroll');
  const ta = useTranslations('advances');
  const { data } = useApi<AdvanceListDto>('advances', '/advances', {
    status: 'OPEN',
    pageSize: 100,
  });
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-lg">{t('openAdvances')}</CardTitle>
        {data ? (
          <p>
            {t('totalToRecover')}:{' '}
            <span className="text-lg font-semibold tabular-nums" data-testid="advances-total">
              {formatMoney(data.totalBalance)}
            </span>
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {!data?.items.length ? (
          <p className="py-6 text-center text-muted-foreground">{t('noAdvances')}</p>
        ) : (
          <Table data-testid="open-advances">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-normal">{t('worker')}</TableHead>
                <TableHead className="whitespace-normal">{ta('fields.date')}</TableHead>
                <TableHead className="whitespace-normal">{ta('fields.reason')}</TableHead>
                <TableHead className="text-right whitespace-normal">
                  {ta('fields.amount')}
                </TableHead>
                <TableHead className="text-right whitespace-normal">
                  {ta('fields.recoveryPerMonth')}
                </TableHead>
                <TableHead className="text-right whitespace-normal">
                  {ta('fields.balance')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/workers/${a.workerId}`} className="font-medium hover:underline">
                      {a.worker.fullName}
                    </Link>
                    <p className="text-sm text-muted-foreground">{a.worker.code}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(a.date)}</TableCell>
                  <TableCell className="whitespace-normal">{a.reason ?? '—'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(a.amount)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {a.recoveryPerMonth ? formatMoney(a.recoveryPerMonth) : ta('inFull')}
                  </TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatMoney(a.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
