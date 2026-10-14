'use client';

import { previewKind } from '@sc/shared';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { documentFileUrl } from '@/lib/upload';

export interface PreviewTarget {
  documentId: string;
  versionId: string;
  title: string;
  fileName: string;
  mimeType: string;
}

/** Shows a PDF (iframe) or an image; other files only get a download button. */
export function PreviewDialog({
  target,
  onClose,
}: {
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  const t = useTranslations('documents');
  const kind = target ? previewKind(target.mimeType) : null;
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90dvh] max-w-[min(96vw,1100px)] flex-col gap-3 sm:max-w-[min(96vw,1100px)]">
        <DialogHeader>
          <DialogTitle className="truncate pr-8 text-xl">{target?.title}</DialogTitle>
          <DialogDescription className="truncate">{target?.fileName}</DialogDescription>
        </DialogHeader>
        {target ? (
          <div
            className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/40"
            data-testid="preview"
          >
            {kind === 'pdf' ? (
              <iframe
                title={target.title}
                src={documentFileUrl(target.documentId, target.versionId, true)}
                className="size-full min-h-[60dvh]"
              />
            ) : kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={documentFileUrl(target.documentId, target.versionId, true)}
                alt={target.title}
                className="mx-auto max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <p>{t('noPreview')}</p>
              </div>
            )}
          </div>
        ) : null}
        {target ? (
          <div className="flex justify-end">
            <Button asChild size="lg" className="h-11 text-base">
              <a href={documentFileUrl(target.documentId, target.versionId)} download>
                <Download aria-hidden />
                {t('actions.download')}
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
