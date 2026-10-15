'use client';

import type { DocumentCategory, DocumentDto, DocumentOwnerType } from '@sc/shared';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useListState } from '@/hooks/use-list-state';
import { useList } from '@/hooks/use-resource';
import { DocumentTable } from './document-table';
import { UploadDocumentDialog } from './upload-dialog';

/**
 * Documents of one owner (a project, asset, worker, supplier, client or the company): list,
 * upload, new version, history, preview and download. Used on every detail page.
 */
export function DocumentPanel({
  ownerType,
  ownerId,
  isVehicle,
  category,
}: {
  ownerType: DocumentOwnerType;
  ownerId?: string | null;
  isVehicle?: boolean;
  /** Only this category (e.g. bond copies on the Bonds tab); also the upload default. */
  category?: DocumentCategory;
}) {
  const t = useTranslations('documents');
  const [uploadOpen, setUploadOpen] = useState(false);
  const list = useListState({});
  const { data, isLoading } = useList<DocumentDto>('documents', {
    ...list.params,
    ownerType,
    ownerId: ownerId ?? undefined,
    category,
  });
  const uploadButton = (
    <Button
      size="lg"
      className="h-11 text-base"
      onClick={() => setUploadOpen(true)}
      data-testid="upload-document"
    >
      <Plus aria-hidden />
      {t('actions.upload')}
    </Button>
  );

  return (
    <section data-testid="document-panel">
      <DocumentTable
        data={data?.items}
        total={data?.total}
        page={list.page}
        onPageChange={list.setPage}
        search={list.search}
        onSearchChange={list.setSearch}
        isLoading={isLoading}
        toolbar={uploadButton}
        emptyMessage={list.search ? undefined : <EmptyState message={t('empty')} />}
      />
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        ownerType={ownerType}
        ownerId={ownerId}
        isVehicle={isVehicle}
        defaultCategory={category}
      />
    </section>
  );
}
