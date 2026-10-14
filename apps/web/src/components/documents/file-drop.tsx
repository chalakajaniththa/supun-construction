'use client';

import { UPLOAD_ACCEPT, mimeTypeFor } from '@sc/shared';
import { FileUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { formatFileSize } from '@/lib/upload';
import { cn } from '@/lib/utils';

/** Drag-and-drop area that also opens the file picker on click. Checks the type and size. */
export function FileDrop({
  file,
  onFile,
  maxMb,
  error,
}: {
  file: File | null;
  onFile: (file: File | null, problem?: 'UNSUPPORTED_FILE_TYPE' | 'FILE_TOO_LARGE') => void;
  maxMb: number;
  error?: string;
}) {
  const t = useTranslations('documents.upload');
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!mimeTypeFor(f.name)) onFile(null, 'UNSUPPORTED_FILE_TYPE');
    else if (f.size > maxMb * 1024 * 1024) onFile(null, 'FILE_TOO_LARGE');
    else onFile(f);
  };

  return (
    <div>
      <button
        type="button"
        data-testid="file-drop"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          over ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
          error && 'border-destructive',
        )}
      >
        <FileUp className="size-8 text-muted-foreground" aria-hidden />
        {file ? (
          <span className="font-medium break-all">
            {file.name} <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
          </span>
        ) : (
          <span className="font-medium">{t('dropHere')}</span>
        )}
        <span className="text-sm text-muted-foreground">{t('allowed', { mb: maxMb })}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        data-testid="file-input"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
