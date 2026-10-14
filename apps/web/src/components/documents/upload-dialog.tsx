'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEFAULT_MAX_UPLOAD_MB,
  type DocumentCategory,
  type DocumentDetailDto,
  type DocumentOwnerType,
  documentCreateSchema,
  documentVersionCreateSchema,
  isOnOrAfter,
  orderedDocumentCategories,
} from '@sc/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { DateField, SelectField, TextField, TextareaField } from '@/components/forms/fields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useInvalidate } from '@/hooks/use-resource';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { uploadWithProgress } from '@/lib/upload';
import { FileDrop } from './file-drop';

const newDocSchema = z
  .object({
    category: documentCreateSchema.shape.category,
    title: documentCreateSchema.shape.title,
    issueDate: documentVersionCreateSchema.shape.issueDate,
    expiryDate: documentVersionCreateSchema.shape.expiryDate,
    note: documentVersionCreateSchema.shape.note,
  })
  .superRefine((v, ctx) => {
    if (!isOnOrAfter(v.issueDate, v.expiryDate)) {
      ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'EXPIRY_BEFORE_ISSUE' });
    }
  });
type NewDocValues = z.input<typeof newDocSchema>;

const versionSchema = documentVersionCreateSchema;
type VersionValues = z.input<typeof versionSchema>;

/** File problems (client- or server-side) as a translated message. */
function useFileError() {
  const tErr = useTranslations('errors');
  return (code: string | null) =>
    code ? tErr(code as 'FILE_REQUIRED', { mb: DEFAULT_MAX_UPLOAD_MB }) : undefined;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
    >
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

/** "Upload document": file + category + title + dates + note → a new document (version 1). */
export function UploadDocumentDialog({
  open,
  onOpenChange,
  ownerType,
  ownerId,
  isVehicle,
  defaultCategory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerType: DocumentOwnerType;
  ownerId?: string | null;
  isVehicle?: boolean;
  defaultCategory?: DocumentCategory;
}) {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const fileError = useFileError();
  const invalidate = useInvalidate();
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const categories = orderedDocumentCategories(ownerType, { isVehicle });
  const empty: NewDocValues = {
    category: defaultCategory ?? '',
    title: '',
    issueDate: '',
    expiryDate: '',
    note: '',
  } as NewDocValues;
  const form = useForm<NewDocValues, unknown, z.output<typeof newDocSchema>>({
    resolver: zodResolver(newDocSchema),
    defaultValues: empty,
  });

  const close = (next: boolean) => {
    if (progress !== null) return;
    if (!next) {
      form.reset(empty);
      setFile(null);
      setFileProblem(null);
    }
    onOpenChange(next);
  };

  const submit = form.handleSubmit(async (values) => {
    if (!file) {
      setFileProblem('FILE_REQUIRED');
      return;
    }
    setProgress(0);
    try {
      await uploadWithProgress<DocumentDetailDto>(
        '/documents',
        {
          ownerType,
          ownerId: ownerId ?? undefined,
          ...values,
          issueDate: values.issueDate ?? '',
          expiryDate: values.expiryDate ?? '',
          note: values.note ?? '',
        },
        file,
        setProgress,
      );
      await invalidate('documents', 'assets');
      toast.success(t('upload.done'));
      setProgress(null);
      close(false);
    } catch (err) {
      setProgress(null);
      if (
        err instanceof ApiError &&
        ['UNSUPPORTED_FILE_TYPE', 'FILE_TOO_LARGE', 'FILE_REQUIRED'].includes(err.code)
      ) {
        setFileProblem(err.code);
      } else if (
        !applyServerErrors(err, form.setError, [
          'category',
          'title',
          'issueDate',
          'expiryDate',
          'note',
        ])
      ) {
        toast.error(errorMessage(err));
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('upload.title')}</DialogTitle>
          <DialogDescription>{t('upload.description')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-5 md:grid-cols-2"
          data-testid="upload-form"
        >
          <div className="md:col-span-2">
            <FileDrop
              file={file}
              maxMb={DEFAULT_MAX_UPLOAD_MB}
              error={fileError(fileProblem)}
              onFile={(f, problem) => {
                setFile(f);
                setFileProblem(problem ?? null);
                if (f && !form.getValues('title')) {
                  form.setValue('title', f.name.replace(/\.[^.]+$/, ''));
                }
              }}
            />
          </div>
          <SelectField
            control={form.control}
            name="category"
            label={t('fields.category')}
            enumName="DocumentCategory"
            values={categories}
            idPrefix="upload"
          />
          <TextField
            control={form.control}
            name="title"
            label={t('fields.title')}
            idPrefix="upload"
          />
          <DateField
            control={form.control}
            name="issueDate"
            label={t('fields.issueDate')}
            idPrefix="upload"
          />
          <DateField
            control={form.control}
            name="expiryDate"
            label={t('fields.expiryDate')}
            description={t('fields.expiryHint')}
            idPrefix="upload"
          />
          <TextareaField
            control={form.control}
            name="note"
            label={t('fields.note')}
            rows={2}
            className="md:col-span-2"
            idPrefix="upload"
          />
          {progress !== null ? (
            <div className="md:col-span-2">
              <p className="mb-1 text-sm text-muted-foreground">
                {t('upload.uploading', { pct: Math.round(progress * 100) })}
              </p>
              <ProgressBar value={progress} />
            </div>
          ) : null}
          <DialogFooter className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => close(false)}
              disabled={progress !== null}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-11 min-w-32 text-base"
              disabled={progress !== null}
              data-testid="upload-submit"
            >
              {progress !== null ? t('upload.uploadingShort') : t('upload.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Upload new version": the new file becomes current; older versions stay in the history. */
export function NewVersionDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: { id: string; title: string } | null;
}) {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const fileError = useFileError();
  const invalidate = useInvalidate();
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const empty: VersionValues = { issueDate: '', expiryDate: '', note: '' };
  const form = useForm<VersionValues, unknown, z.output<typeof versionSchema>>({
    resolver: zodResolver(versionSchema),
    defaultValues: empty,
  });

  const close = (next: boolean) => {
    if (progress !== null) return;
    if (!next) {
      form.reset(empty);
      setFile(null);
      setFileProblem(null);
    }
    onOpenChange(next);
  };

  const submit = form.handleSubmit(async (values) => {
    if (!document) return;
    if (!file) {
      setFileProblem('FILE_REQUIRED');
      return;
    }
    setProgress(0);
    try {
      await uploadWithProgress<DocumentDetailDto>(
        `/documents/${document.id}/versions`,
        {
          issueDate: values.issueDate ?? '',
          expiryDate: values.expiryDate ?? '',
          note: values.note ?? '',
        },
        file,
        setProgress,
      );
      await invalidate('documents', 'assets');
      toast.success(t('version.done'));
      setProgress(null);
      close(false);
    } catch (err) {
      setProgress(null);
      if (
        err instanceof ApiError &&
        ['UNSUPPORTED_FILE_TYPE', 'FILE_TOO_LARGE', 'FILE_REQUIRED'].includes(err.code)
      ) {
        setFileProblem(err.code);
      } else if (!applyServerErrors(err, form.setError, ['issueDate', 'expiryDate', 'note'])) {
        toast.error(errorMessage(err));
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('version.title')}</DialogTitle>
          <DialogDescription>
            {t('version.description', { title: document?.title ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-5 md:grid-cols-2"
          data-testid="version-form"
        >
          <div className="md:col-span-2">
            <FileDrop
              file={file}
              maxMb={DEFAULT_MAX_UPLOAD_MB}
              error={fileError(fileProblem)}
              onFile={(f, problem) => {
                setFile(f);
                setFileProblem(problem ?? null);
              }}
            />
          </div>
          <DateField
            control={form.control}
            name="issueDate"
            label={t('fields.issueDate')}
            idPrefix="version"
          />
          <DateField
            control={form.control}
            name="expiryDate"
            label={t('fields.expiryDate')}
            description={t('fields.expiryHint')}
            idPrefix="version"
          />
          <TextareaField
            control={form.control}
            name="note"
            label={t('fields.note')}
            rows={2}
            className="md:col-span-2"
            idPrefix="version"
          />
          {progress !== null ? (
            <div className="md:col-span-2">
              <p className="mb-1 text-sm text-muted-foreground">
                {t('upload.uploading', { pct: Math.round(progress * 100) })}
              </p>
              <ProgressBar value={progress} />
            </div>
          ) : null}
          <DialogFooter className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 text-base"
              onClick={() => close(false)}
              disabled={progress !== null}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-11 min-w-32 text-base"
              disabled={progress !== null}
              data-testid="version-submit"
            >
              {progress !== null ? t('upload.uploadingShort') : t('version.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
