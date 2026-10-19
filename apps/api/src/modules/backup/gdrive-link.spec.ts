import { describe, expect, it } from 'vitest';
import type { BackupAgent } from '../../generated/prisma/client.js';
import { toGdriveLinkDto } from './backup.service.js';

const NOW = new Date('2026-10-19T10:00:00Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
const agent = (seenMinAgo: number, gdrive = false) =>
  ({ id: 1, lastSeenAt: ago(seenMinAgo), gdriveConfigured: gdrive }) as BackupAgent;
const link = (state: string, updatedMinAgo = 0, extra: object = {}) => ({
  action: null,
  state,
  authUrl: 'http://127.0.0.1:53682/auth?state=x',
  message: 'boom',
  updatedAt: ago(updatedMinAgo),
  ...extra,
});

describe('toGdriveLinkDto', () => {
  it('is IDLE without a row, and reports the container', () => {
    expect(toGdriveLinkDto(null, null, NOW)).toMatchObject({
      state: 'IDLE',
      configured: null,
      agentOnline: false,
      authUrl: null,
    });
    expect(toGdriveLinkDto(null, agent(1, true), NOW)).toMatchObject({
      configured: true,
      agentOnline: true,
    });
  });

  it('shows the sign-in link only while waiting', () => {
    expect(toGdriveLinkDto(link('WAITING'), agent(0), NOW).authUrl).toContain('/auth');
    expect(toGdriveLinkDto(link('DONE'), agent(0), NOW).authUrl).toBeNull();
  });

  it('shows the message only when it failed', () => {
    expect(toGdriveLinkDto(link('FAILED'), agent(0), NOW).message).toBe('boom');
    expect(toGdriveLinkDto(link('DONE'), agent(0), NOW).message).toBeNull();
  });

  it('forgets a sign-in the container can no longer finish', () => {
    expect(toGdriveLinkDto(link('WAITING', 30), agent(0), NOW).state).toBe('IDLE');
    expect(toGdriveLinkDto(link('STARTING'), agent(20), NOW).state).toBe('IDLE');
    expect(toGdriveLinkDto(link('STARTING', 1), agent(0), NOW).state).toBe('STARTING');
  });

  it('passes a known pending action and ignores junk', () => {
    expect(
      toGdriveLinkDto(link('STARTING', 0, { action: 'CONNECT' }), agent(0), NOW).pendingAction,
    ).toBe('CONNECT');
    expect(toGdriveLinkDto(link('weird', 0, { action: 'x' }), agent(0), NOW)).toMatchObject({
      state: 'IDLE',
      pendingAction: null,
    });
  });
});
