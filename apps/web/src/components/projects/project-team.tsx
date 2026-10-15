'use client';

import { type AllocationDto, type AllocationKind, shiftDay } from '@sc/shared';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AllocationTable } from '@/components/assets/asset-ops';
import { AssignDialog } from '@/components/schedule/allocation-dialogs';
import { Button } from '@/components/ui/button';
import { useApi } from '@/hooks/use-resource';
import { todayInColombo } from '@/lib/format';

/** Project → Team & Machines: bookings from today for two weeks, with "Assign". */
export function ProjectTeam({ project }: { project: { id: string; name: string } }) {
  const t = useTranslations('projects.team');
  const today = todayInColombo();
  const range = { from: today, to: shiftDay(today, 14), projectId: project.id };
  const workers = useApi<AllocationDto[]>('allocations', '/allocations', {
    kind: 'worker',
    ...range,
  });
  const assets = useApi<AllocationDto[]>('allocations', '/allocations', {
    kind: 'asset',
    ...range,
  });
  const [assign, setAssign] = useState<AllocationKind | null>(null);
  const button = (kind: AllocationKind) => (
    <Button
      size="lg"
      className="h-11 text-base"
      onClick={() => setAssign(kind)}
      data-testid={`assign-${kind}`}
    >
      <Users aria-hidden />
      {kind === 'worker' ? t('assignWorkers') : t('assignMachines')}
    </Button>
  );
  return (
    <div className="flex flex-col gap-5">
      <AllocationTable
        title={t('workers')}
        rows={workers.data}
        kind="worker"
        showProject={false}
        actions={button('worker')}
        help={t('help')}
      />
      <AllocationTable
        title={t('machines')}
        rows={assets.data}
        kind="asset"
        showProject={false}
        actions={button('asset')}
      />
      <AssignDialog
        open={assign !== null}
        onOpenChange={(o) => !o && setAssign(null)}
        kind={assign ?? 'worker'}
        defaultProject={project}
        defaultFrom={today}
        defaultTo={shiftDay(today, 6)}
      />
    </div>
  );
}
