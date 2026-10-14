import { cn } from '@/lib/utils';

/** A two-column "label: value" list for detail pages. Empty values show "—". */
export function InfoList({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode; wide?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {items.map((item) => (
        <div key={item.label} className={cn('min-w-0', item.wide && 'sm:col-span-2 xl:col-span-3')}>
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 text-[0.95rem] break-words whitespace-pre-line">
            {item.value === null || item.value === undefined || item.value === ''
              ? '—'
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
