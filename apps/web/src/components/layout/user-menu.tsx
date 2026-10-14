'use client';

import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMe } from '@/hooks/use-me';
import { api } from '@/lib/api-client';

export function UserMenu() {
  const t = useTranslations();
  const { data: me } = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await api('/auth/logout', { method: 'POST', skipAuthRedirect: true });
    } catch {
      // ignore — the cookie is cleared server-side anyway
    }
    qc.clear();
    toast.success(t('auth.loggedOut'));
    router.replace('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="lg" data-testid="user-menu" aria-label={t('common.userMenu')}>
          <UserRound className="size-5" aria-hidden />
          <span className="hidden sm:inline">{me?.username ?? '…'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>{me?.username}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=password" data-testid="menu-change-password">
            <KeyRound aria-hidden />
            {t('common.changePassword')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()} disabled={busy} data-testid="logout">
          <LogOut aria-hidden />
          {busy ? t('common.loggingOut') : t('common.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
