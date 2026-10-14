import { Inbox } from 'lucide-react';

/** Friendly empty state for lists, with an optional action (usually "Add …"). */
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6" data-testid="empty-state">
      <Inbox className="size-10 text-muted-foreground/60" aria-hidden />
      <p>{message}</p>
      {action}
    </div>
  );
}
