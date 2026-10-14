'use client';

import { Bell, Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BrandMark, useCompanyName } from './brand';
import { DefaultPasswordBanner } from './default-password-banner';
import { LanguageToggle } from './language-toggle';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

/** App frame: fixed sidebar on large screens (≥1024px), a slide-in sheet below that. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  const companyName = useCompanyName();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <BrandMark />
          <span
            className="line-clamp-2 text-[0.95rem] leading-tight font-semibold"
            title={companyName}
          >
            {companyName}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon-lg"
                className="lg:hidden"
                aria-label={t('openMenu')}
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="border-b border-sidebar-border">
                <SheetTitle className="flex items-center gap-3 text-sidebar-foreground">
                  <BrandMark />
                  <span className="truncate">{companyName}</span>
                </SheetTitle>
                <SheetDescription className="sr-only">{t('menu')}</SheetDescription>
              </SheetHeader>
              <div className="py-2">
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <p className="min-w-0 truncate text-lg font-semibold" data-testid="company-name">
            {companyName}
          </p>

          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={t('notifications')}
                  data-testid="bell"
                >
                  <Bell className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('notificationsSoon')}</TooltipContent>
            </Tooltip>
            <UserMenu />
          </div>
        </header>
        <DefaultPasswordBanner />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
