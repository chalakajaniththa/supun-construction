'use client';

import { RESET_CONFIRM_WORD } from '@sc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useErrorMessage } from '@/hooks/use-error-message';
import { api } from '@/lib/api-client';

/** Settings → Sample data: wipe all business data and load the sample data again. */
export function ResetSampleData() {
  const t = useTranslations('sampleData');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const matches = typed.trim() === RESET_CONFIRM_WORD;

  const reset = async () => {
    setPending(true);
    try {
      await api('/admin/reset-sample-data', {
        method: 'POST',
        body: { confirm: typed.trim() },
      });
      await qc.invalidateQueries();
      toast.success(t('done'));
      setOpen(false);
      setTyped('');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="border-destructive/30" data-testid="reset-sample-data">
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-[0.95rem]">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="list-disc pl-5 text-[0.95rem]">
          <li>{t('removes')}</li>
          <li>{t('keeps')}</li>
          <li>{t('backupFirst')}</li>
        </ul>
        <div>
          <Button
            variant="destructive"
            size="lg"
            className="h-11 text-base"
            onClick={() => setOpen(true)}
            data-testid="reset-open"
          >
            <RotateCcw aria-hidden />
            {t('button')}
          </Button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
            <DialogDescription>{t('confirmText')}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (matches && !pending) void reset();
            }}
          >
            <Label htmlFor="reset-confirm">{t('typeLabel', { word: RESET_CONFIRM_WORD })}</Label>
            <Input
              id="reset-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              disabled={pending}
              data-testid="reset-confirm"
            />
            {pending ? <p className="text-sm text-muted-foreground">{t('working')}</p> : null}
            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                {tc('cancel')}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!matches || pending}
                data-testid="reset-submit"
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {t('confirmButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
