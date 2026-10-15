'use client';

import { UPLOAD_ACCEPT, type DocumentDetailDto } from '@sc/shared';
import { Paperclip, ReceiptText, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/hooks/use-error-message';
import { buildUrl } from '@/lib/api-client';
import { uploadWithProgress } from '@/lib/upload';

/**
 * Attach a receipt photo / PDF to an expense: uploads it as a RECEIPT document of the project
 * (or a company document when there is no project) and hands back the document id.
 */
export function ReceiptButton({
  documentId,
  projectId,
  title,
  onChange,
  disabled,
  testId,
}: {
  documentId: string | null;
  projectId: string | null;
  title: string;
  onChange: (documentId: string | null) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const t = useTranslations('expenses');
  const errorMessage = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const upload = async (file: File) => {
    setProgress(0);
    try {
      const doc = await uploadWithProgress<DocumentDetailDto>(
        '/documents',
        {
          ownerType: projectId ? 'PROJECT' : 'COMPANY',
          ownerId: projectId ?? undefined,
          category: 'RECEIPT',
          title: t('receiptTitle', { description: title || t('receipt') }),
        },
        file,
        setProgress,
      );
      onChange(doc.id);
      toast.success(t('receiptAttached'));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  };

  if (documentId) {
    return (
      <span
        className="inline-flex items-center gap-1"
        data-testid={testId ? `${testId}-attached` : undefined}
      >
        <a
          href={buildUrl(`/documents/${documentId}/download`, { inline: 1 })}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary hover:underline"
        >
          <ReceiptText className="size-4" aria-hidden />
          {t('receipt')}
        </a>
        {!disabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('removeReceipt')}
            onClick={() => onChange(null)}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </span>
    );
  }
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={testId ? `${testId}-file` : undefined}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || progress !== null}
        onClick={() => input.current?.click()}
        data-testid={testId}
      >
        <Paperclip aria-hidden />
        {progress !== null ? `${Math.round(progress * 100)}%` : t('attachReceipt')}
      </Button>
    </>
  );
}
