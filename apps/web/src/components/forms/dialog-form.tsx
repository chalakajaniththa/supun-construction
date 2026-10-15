'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { useErrorMessage } from '@/hooks/use-error-message';
import { ApiError } from '@/lib/api-client';

/** A small form dialog: plain state, server field errors shown next to the fields. */
export function useDialogForm<T extends Record<string, string>>(
  open: boolean,
  init: () => T,
  deps: unknown,
) {
  const [form, setForm] = useState<T>(init);
  const [key, setKey] = useState({ open, deps });
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (key.open !== open || key.deps !== deps) {
    setKey({ open, deps });
    setForm(init());
    setErrors({});
  }
  const errorMessage = useErrorMessage();
  const handle = (e: unknown) => {
    if (e instanceof ApiError && Array.isArray(e.details) && e.details.length) {
      const next: Record<string, string> = {};
      for (const d of e.details as { path: string; message: string }[]) next[d.path] = d.message;
      setErrors(next);
    } else toast.error(errorMessage(e));
  };
  const err = (k: string) => (errors[k] ? { message: errors[k] } : undefined);
  return { form, setForm, handle, err };
}

export function DialogButtons({
  onCancel,
  onSave,
  saving,
  testId,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  testId: string;
}) {
  const tc = useTranslations('common');
  return (
    <DialogFooter>
      <Button variant="outline" size="lg" className="h-11 text-base" onClick={onCancel}>
        {tc('cancel')}
      </Button>
      <Button
        size="lg"
        className="h-11 min-w-32 text-base"
        onClick={onSave}
        disabled={saving}
        data-testid={testId}
      >
        {saving ? tc('saving') : tc('save')}
      </Button>
    </DialogFooter>
  );
}
