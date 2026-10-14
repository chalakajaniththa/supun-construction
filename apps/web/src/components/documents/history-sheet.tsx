'use client';

import type { DocumentDetailDto, DocumentVersionDto } from '@sc/shared';
import { useMutation } from '@tanstack/react-query';
import { Download, Eye, History, RotateCcw, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DeleteButton } from '@/components/delete-button';
import { useEnumLabel } from '@/components/forms/enum-select';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useDetail, useInvalidate } from '@/hooks/use-resource';
import { api } from '@/lib/api-client';
import { formatDate, formatDateTime } from '@/lib/format';
import { documentFileUrl, formatFileSize } from '@/lib/upload';
import { ExpiryBadge } from './expiry-badge';
import type { PreviewTarget } from './preview-dialog';

/** All versions of a document, newest first, with preview / download / restore. */
export function HistorySheet({
  documentId,
  onClose,
  onPreview,
  onNewVersion,
}: {
  documentId: string | null;
  onClose: () => void;
  onPreview: (target: PreviewTarget) => void;
  onNewVersion: (doc: { id: string; title: string }) => void;
}) {
  const t = useTranslations('documents');
  const enumLabel = useEnumLabel();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidate();
  const { data: doc, isLoading } = useDetail<DocumentDetailDto>(
    'documents',
    documentId ?? undefined,
  );
  const [restoreTarget, setRestoreTarget] = useState<DocumentVersionDto | null>(null);
  const restore = useMutation({
    mutationFn: (v: DocumentVersionDto) =>
      api<DocumentDetailDto>(`/documents/${v.documentId}/versions/${v.id}/restore`, {
        method: 'POST',
      }),
    onSuccess: () => invalidate('documents', 'assets'),
  });

  return (
    <Sheet open={Boolean(documentId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl" data-testid="history-sheet">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <History className="size-5" aria-hidden />
            {t('history.title')}
          </SheetTitle>
          <SheetDescription className="text-[0.95rem]">
            {doc ? `${doc.title} · ${enumLabel('DocumentCategory', doc.category)}` : ''}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading || !doc ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <ol className="flex flex-col gap-3" data-testid="version-list">
              {doc.versions.map((v) => {
                const current = v.id === doc.currentVersionId;
                return (
                  <li key={v.id} className="rounded-xl border p-3" data-testid="version-item">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold">
                        {t('versionNo', { n: v.versionNo })}
                      </span>
                      {current ? <StatusChip tone="info">{t('history.current')}</StatusChip> : null}
                      {v.restoredFromVersionNo ? (
                        <StatusChip tone="neutral">
                          {t('history.restoredFrom', { n: v.restoredFromVersionNo })}
                        </StatusChip>
                      ) : null}
                      <span className="ml-auto">
                        <ExpiryBadge expiry={v.expiryDate} />
                      </span>
                    </div>
                    <p className="mt-1 text-sm break-all text-muted-foreground">
                      {v.fileName} · {formatFileSize(v.sizeBytes)} ·{' '}
                      {t('history.uploaded', { date: formatDateTime(v.uploadedAt) })}
                    </p>
                    {v.issueDate ? (
                      <p className="text-sm text-muted-foreground">
                        {t('history.issued', { date: formatDate(v.issueDate) })}
                      </p>
                    ) : null}
                    {v.note ? <p className="mt-1 text-[0.95rem]">{v.note}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() =>
                          onPreview({
                            documentId: doc.id,
                            versionId: v.id,
                            title: `${doc.title} – ${t('versionNo', { n: v.versionNo })}`,
                            fileName: v.fileName,
                            mimeType: v.mimeType,
                          })
                        }
                      >
                        <Eye aria-hidden />
                        {t('actions.preview')}
                      </Button>
                      <Button asChild variant="outline" size="lg">
                        <a href={documentFileUrl(doc.id, v.id)} download>
                          <Download aria-hidden />
                          {t('actions.download')}
                        </a>
                      </Button>
                      {!current ? (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => setRestoreTarget(v)}
                          data-testid="restore-button"
                        >
                          <RotateCcw aria-hidden />
                          {t('actions.restore')}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {doc ? (
          <div className="flex flex-wrap justify-between gap-2 border-t p-4">
            <DeleteButton
              description={t('deleteConfirm', { title: doc.title })}
              onDelete={async () => {
                await api(`/documents/${doc.id}`, { method: 'DELETE' });
                await invalidate('documents', 'assets');
              }}
              onDeleted={onClose}
              testId="delete-document"
            />
            <Button
              size="lg"
              className="h-11 text-base"
              onClick={() => onNewVersion({ id: doc.id, title: doc.title })}
            >
              <Upload aria-hidden />
              {t('actions.newVersion')}
            </Button>
          </div>
        ) : null}
        <ConfirmDialog
          open={Boolean(restoreTarget)}
          onOpenChange={(o) => !o && setRestoreTarget(null)}
          title={t('history.restoreTitle', { n: restoreTarget?.versionNo ?? 0 })}
          description={t('history.restoreText')}
          confirmLabel={t('actions.restore')}
          pending={restore.isPending}
          onConfirm={async () => {
            if (!restoreTarget) return;
            try {
              await restore.mutateAsync(restoreTarget);
              toast.success(t('history.restored'));
              setRestoreTarget(null);
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
