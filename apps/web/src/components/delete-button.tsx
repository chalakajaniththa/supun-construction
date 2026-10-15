'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/hooks/use-error-message';

/** "Delete" button with an "Are you sure?" dialog. Records are soft-deleted (kept in history). */
export function DeleteButton({
  description,
  onDelete,
  onDeleted,
  label,
  variant = 'outline',
  testId = 'delete-button',
  iconOnly = false,
}: {
  description: string;
  onDelete: () => Promise<unknown>;
  onDeleted?: () => void;
  label?: string;
  variant?: 'outline' | 'ghost';
  testId?: string;
  /** Only the bin icon (for narrow table rows); the label becomes the accessible name. */
  iconOnly?: boolean;
}) {
  const t = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? 'icon-lg' : 'lg'}
        className="h-11 text-base text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        data-testid={testId}
        aria-label={iconOnly ? (label ?? t('delete')) : undefined}
      >
        <Trash2 aria-hidden />
        {iconOnly ? null : (label ?? t('delete'))}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        description={description}
        confirmLabel={t('delete')}
        destructive
        pending={pending}
        onConfirm={async () => {
          setPending(true);
          try {
            await onDelete();
            toast.success(t('deleted'));
            setOpen(false);
            onDeleted?.();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setPending(false);
          }
        }}
      />
    </>
  );
}
