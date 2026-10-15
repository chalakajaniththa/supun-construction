import type { NotificationDto } from '@sc/shared';

/** Where a reminder leads: the page (and tab) of the thing it is about. */
export function notificationHref(
  n: Pick<NotificationDto, 'entityType' | 'entityId' | 'params'>,
): string {
  const p = n.params;
  switch (n.entityType) {
    case 'DOCUMENT': {
      const id = p.ownerId;
      switch (p.ownerType) {
        case 'ASSET':
          return `/assets/${id}?tab=documents`;
        case 'WORKER':
          return `/workers/${id}?tab=documents`;
        case 'PROJECT':
          return `/projects/${id}?tab=documents`;
        case 'SUPPLIER':
          return `/suppliers/${id}?tab=documents`;
        case 'CLIENT':
          return '/projects/clients';
        default:
          return '/documents';
      }
    }
    case 'BOND':
      return `/projects/${p.projectId}?tab=bonds`;
    case 'ASSET':
      return `/assets/${n.entityId}?tab=maintenance`;
    case 'PROJECT':
      return `/projects/${n.entityId}`;
    default:
      return '/notifications';
  }
}

export const SEVERITY_DOT: Record<NotificationDto['severity'], string> = {
  DANGER: 'bg-destructive',
  WARNING: 'bg-warning',
  INFO: 'bg-primary',
};
