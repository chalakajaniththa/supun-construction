'use client';

import { RESET_CONFIRM_WORD, type ResetMode } from '@sc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { DatabaseZap, Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

/**
 * Settings → Reset data: wipe all business data and either start empty for real use or load the
 * sample data again. Needs the word RESET and the login password. Backups are never touched.
 */
export function ResetSampleData() {
  const t = useTranslations('sampleData');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<ResetMode | null>(null);
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const ready = typed.trim() === RESET_CONFIRM_WORD && password.length > 0;

  const close = () => {
    setMode(null);
    setTyped('');
    setPassword('');
  };

  const reset = async () => {
    if (!mode) return;
    setPending(true);
    try {
      await api('/admin/reset-data', {
        method: 'POST',
        body: { mode, confirm: typed.trim(), password },
      });
      await qc.invalidateQueries();
      toast.success(mode === 'EMPTY' ? t('doneEmpty') : t('done'));
      close();
      if (mode === 'EMPTY') router.push('/dashboard');
    } catch (e) {
      toast.error(errorMessage(e));
      setPassword('');
    } finally {
      setPending(false);
    }
  };

  const options: { mode: ResetMode; icon: typeof RotateCcw; testId: string }[] = [
    { mode: 'EMPTY', icon: DatabaseZap, testId: 'reset-empty-open' },
    { mode: 'SAMPLE', icon: RotateCcw, testId: 'reset-open' },
  ];

  return (
    <Card className="border-destructive/30" data-testid="reset-sample-data">
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-[0.95rem]">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          {options.map(({ mode: m, icon: Icon, testId }) => (
            <div key={m} className="flex flex-col gap-3 rounded-lg border p-4">
              <p className="flex items-center gap-2 text-lg font-semibold">
                <Icon className="size-5 text-destructive" aria-hidden />
                {m === 'EMPTY' ? t('emptyTitle') : t('sampleTitle')}
              </p>
              <p className="flex-1 text-[0.95rem] text-muted-foreground">
                {m === 'EMPTY' ? t('emptyText') : t('sampleText')}
              </p>
              <div>
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-11 text-base"
                  onClick={() => setMode(m)}
                  data-testid={testId}
                >
                  <Icon aria-hidden />
                  {m === 'EMPTY' ? t('emptyButton') : t('button')}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <ul className="list-disc pl-5 text-[0.95rem]">
          <li>{t('removes')}</li>
          <li>{t('keeps')}</li>
          <li>{t('backupFirst')}</li>
        </ul>
      </CardContent>

      <Dialog open={mode !== null} onOpenChange={(o) => !pending && !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'EMPTY' ? t('confirmEmptyTitle') : t('confirmTitle')}
            </DialogTitle>
            <DialogDescription>{t('confirmText')}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && !pending) void reset();
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
            <Label htmlFor="reset-password" className="mt-2">
              {t('passwordLabel')}
            </Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={pending}
              data-testid="reset-password"
            />
            <p className="text-sm text-muted-foreground">{t('passwordHint')}</p>
            {pending ? <p className="text-sm text-muted-foreground">{t('working')}</p> : null}
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={close} disabled={pending}>
                {tc('cancel')}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!ready || pending}
                data-testid="reset-submit"
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {mode === 'EMPTY' ? t('confirmEmptyButton') : t('confirmButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
