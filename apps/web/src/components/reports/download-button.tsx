'use client';

import type { ReportFormat, ReportId } from '@sc/shared';
import { FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/hooks/use-error-message';
import { downloadReport } from '@/lib/download';

type Params = Record<string, string | number | undefined | null>;

/** A "Download PDF / Excel" button for one report (used on Reports and on the pages it belongs to). */
export function ReportDownloadButton({
  reportId,
  format,
  params,
  label,
  disabled,
  missing,
  variant = 'outline',
  size = 'lg',
  iconOnly = false,
  testId,
}: {
  reportId: ReportId;
  format: ReportFormat;
  params: Params;
  label?: string;
  disabled?: boolean;
  /** Names of required filters still empty — shown instead of downloading. */
  missing?: string[];
  variant?: 'outline' | 'default' | 'ghost';
  size?: 'lg' | 'default' | 'sm';
  /** Just the icon (narrow tables); `label` becomes the accessible name. */
  iconOnly?: boolean;
  testId?: string;
}) {
  const t = useTranslations('reports');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const Icon = format === 'pdf' ? (iconOnly ? Printer : FileText) : FileSpreadsheet;

  const run = async () => {
    if (missing?.length) {
      toast.error(t('chooseFirst', { fields: missing.join(', ') }));
      return;
    }
    setBusy(true);
    try {
      const name = await downloadReport(reportId, format, params, locale);
      toast.success(t('downloaded', { file: name }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const text = label ?? (format === 'pdf' ? t('downloadPdf') : t('downloadExcel'));
  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={text}
        title={text}
        disabled={disabled || busy}
        onClick={() => void run()}
        data-testid={testId ?? `download-${reportId}-${format}`}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={size === 'lg' ? 'h-11 text-base' : undefined}
      disabled={disabled || busy}
      onClick={() => void run()}
      data-testid={testId ?? `download-${reportId}-${format}`}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
      {busy ? t('downloading') : text}
    </Button>
  );
}
