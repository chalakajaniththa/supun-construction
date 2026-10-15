import { describe, expect, it } from 'vitest';
import { notificationHref } from './notifications';

describe('notificationHref', () => {
  it.each([
    [
      { entityType: 'DOCUMENT', entityId: 'd', params: { ownerType: 'ASSET', ownerId: 'a1' } },
      '/assets/a1?tab=documents',
    ],
    [
      { entityType: 'DOCUMENT', entityId: 'd', params: { ownerType: 'WORKER', ownerId: 'w1' } },
      '/workers/w1?tab=documents',
    ],
    [
      { entityType: 'DOCUMENT', entityId: 'd', params: { ownerType: 'COMPANY', ownerId: null } },
      '/documents',
    ],
    [{ entityType: 'BOND', entityId: 'b', params: { projectId: 'p1' } }, '/projects/p1?tab=bonds'],
    [{ entityType: 'ASSET', entityId: 'a2', params: {} }, '/assets/a2?tab=maintenance'],
    [{ entityType: 'PROJECT', entityId: 'p2', params: {} }, '/projects/p2'],
  ] as const)('%o → %s', (n, href) => {
    expect(notificationHref(n as never)).toBe(href);
  });
});
