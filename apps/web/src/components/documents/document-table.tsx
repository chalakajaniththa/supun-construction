'use client';

import { type DocumentDto, previewKind } from '@sc/shared';
import { Download, Eye, History, Upload } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  type DataTableColumn,
  DataTable,
  type DataTableProps,
} from '@/components/data-table/data-table';
import { useEnumLabel } from '@/components/forms/enum-select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/format';
import { documentFileUrl } from '@/lib/upload';
import { ExpiryBadge } from './expiry-badge';
import { HistorySheet } from './history-sheet';
import { type PreviewTarget, PreviewDialog } from './preview-dialog';
import { NewVersionDialog } from './upload-dialog';

/** Where a document's owner lives in the app. */
export function ownerHref(doc: Pick<DocumentDto, 'ownerType' | 'ownerId'>): string | null {
  switch (doc.ownerType) {
    case 'PROJECT':
      return `/projects/${doc.ownerId}`;
    case 'ASSET':
      return `/assets/${doc.ownerId}`;
    case 'WORKER':
      return `/workers/${doc.ownerId}`;
    case 'SUPPLIER':
      return `/suppliers/${doc.ownerId}`;
    case 'CLIENT':
      return '/projects/clients';
    default:
      return null;
  }
}

function IconAction({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Documents table with preview / download / new version / history. Used by the DocumentPanel
 * (one owner) and the Documents page (all owners, `showOwner`).
 */
export function DocumentTable({
  showOwner = false,
  ...tableProps
}: Omit<DataTableProps<DocumentDto>, 'columns'> & { showOwner?: boolean }) {
  const t = useTranslations('documents');
  const enumLabel = useEnumLabel();
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [versionFor, setVersionFor] = useState<{ id: string; title: string } | null>(null);

  const columns: DataTableColumn<DocumentDto>[] = [
    {
      id: 'title',
      header: t('fields.title'),
      cell: ({ row }) => (
        <div className="min-w-0">
          <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={() => setHistoryId(row.original.id)}
            data-testid="document-title"
          >
            {row.original.title}
          </button>
          <p className="max-w-52 truncate text-sm text-muted-foreground">
            {row.original.currentVersion?.fileName}
          </p>
        </div>
      ),
    },
    ...(showOwner
      ? [
          {
            id: 'owner',
            header: t('fields.owner'),
            cell: ({ row }) => {
              const d = row.original;
              const href = ownerHref(d);
              const name =
                d.ownerType === 'COMPANY'
                  ? enumLabel('DocumentOwnerType', 'COMPANY')
                  : (d.ownerName ?? '—');
              return (
                <div className="max-w-56 min-w-40">
                  {href ? (
                    <Link href={href} className="line-clamp-2 hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                  <p className="truncate text-sm text-muted-foreground">
                    {enumLabel('DocumentOwnerType', d.ownerType)}
                    {d.ownerCode ? ` · ${d.ownerCode}` : ''}
                  </p>
                </div>
              );
            },
          } satisfies DataTableColumn<DocumentDto>,
        ]
      : []),
    {
      id: 'category',
      header: t('fields.category'),
      cell: ({ row }) => enumLabel('DocumentCategory', row.original.category),
    },
    {
      id: 'version',
      header: t('fields.version'),
      cell: ({ row }) => (
        <span data-testid="document-version">
          {t('versionNo', { n: row.original.currentVersion?.versionNo ?? 0 })}
        </span>
      ),
    },
    // The list across all owners has the extra "Belongs to" column; it leaves out the upload date
    // (still in the version history) so the actions fit at 1280px.
    ...(showOwner
      ? []
      : [
          {
            id: 'uploaded',
            header: t('fields.uploaded'),
            cell: ({ row }) => (
              <span className="whitespace-nowrap">
                {formatDate(row.original.currentVersion?.uploadedAt)}
              </span>
            ),
          } satisfies DataTableColumn<DocumentDto>,
        ]),
    {
      id: 'expiry',
      header: t('fields.expiry'),
      cell: ({ row }) => <ExpiryBadge expiry={row.original.currentVersion?.expiryDate} wrap />,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('fields.actions')}</span>,
      cell: ({ row }) => {
        const d = row.original;
        const v = d.currentVersion;
        if (!v) return null;
        return (
          <div className="flex items-center justify-end gap-1">
            {previewKind(v.mimeType) ? (
              <IconAction label={t('actions.preview')}>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={t('actions.preview')}
                  onClick={() =>
                    setPreview({
                      documentId: d.id,
                      versionId: v.id,
                      title: d.title,
                      fileName: v.fileName,
                      mimeType: v.mimeType,
                    })
                  }
                >
                  <Eye aria-hidden />
                </Button>
              </IconAction>
            ) : null}
            {!showOwner ? (
              <>
                <IconAction label={t('actions.download')}>
                  <Button asChild variant="ghost" size="icon-lg" aria-label={t('actions.download')}>
                    <a href={documentFileUrl(d.id, v.id)} download>
                      <Download aria-hidden />
                    </a>
                  </Button>
                </IconAction>
                <IconAction label={t('actions.newVersion')}>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    aria-label={t('actions.newVersion')}
                    onClick={() => setVersionFor({ id: d.id, title: d.title })}
                    data-testid="new-version-button"
                  >
                    <Upload aria-hidden />
                  </Button>
                </IconAction>
              </>
            ) : null}
            <IconAction label={t('actions.history')}>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={t('actions.history')}
                onClick={() => setHistoryId(d.id)}
                data-testid="history-button"
              >
                <History aria-hidden />
              </Button>
            </IconAction>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable columns={columns} getRowId={(d) => d.id} {...tableProps} />
      <PreviewDialog target={preview} onClose={() => setPreview(null)} />
      <HistorySheet
        documentId={historyId}
        onClose={() => setHistoryId(null)}
        onPreview={setPreview}
        onNewVersion={(doc) => setVersionFor(doc)}
      />
      <NewVersionDialog
        open={Boolean(versionFor)}
        onOpenChange={(o) => !o && setVersionFor(null)}
        document={versionFor}
      />
    </>
  );
}
