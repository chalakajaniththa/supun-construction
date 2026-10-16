import type { BackupRunDto } from '@sc/shared';
import { describe, expect, it } from 'vitest';
import { backupAttention, backupHealth, isRunning } from './backup-health.js';

const NOW = new Date('2026-10-16T10:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

let seq = 0;
function run(over: Partial<BackupRunDto> & { ago: number }): BackupRunDto {
  const { ago, ...rest } = over;
  return {
    id: `run-${++seq}`,
    startedAt: hoursAgo(ago),
    finishedAt: hoursAgo(ago - 0.1),
    status: 'SUCCESS',
    trigger: 'SCHEDULED',
    sizeBytes: '1000',
    destination: 'LOCAL',
    message: null,
    ...rest,
  };
}

const online = { lastSeenAt: hoursAgo(0.01), gdriveConfigured: false };

function health(
  recent: BackupRunDto[],
  opts: { agent?: typeof online | null; pending?: number; lastSuccess?: BackupRunDto | null } = {},
) {
  const lastSuccess =
    opts.lastSuccess !== undefined
      ? opts.lastSuccess
      : (recent.find((r) => r.status === 'SUCCESS') ?? null);
  return backupHealth({
    recent,
    lastSuccess,
    agent: opts.agent === undefined ? online : opts.agent,
    pendingRequests: opts.pending ?? 0,
    now: NOW,
  });
}

describe('backupHealth', () => {
  it.each([
    // [label, hours since the last success, expected reason, expected state]
    ['fresh', 1, 'OK', 'OK'],
    ['just under 36 h', 35.9, 'OK', 'OK'],
    ['36 h', 36.05, 'OLD', 'WARNING'],
    ['71 h', 71, 'OLD', 'WARNING'],
    ['72 h', 72.05, 'TOO_OLD', 'DANGER'],
    ['a week', 168, 'TOO_OLD', 'DANGER'],
  ] as const)('age: %s', (_label, ago, reason, state) => {
    const h = health([run({ ago: ago + 0.1 })]);
    expect(h.reason).toBe(reason);
    expect(h.state).toBe(state);
  });

  it('counts whole hours since the success finished', () => {
    expect(health([run({ ago: 5.1 })]).hoursSinceSuccess).toBe(5);
    expect(health([]).hoursSinceSuccess).toBeNull();
  });

  it('is red when nothing ever succeeded', () => {
    expect(health([])).toMatchObject({ reason: 'NEVER', state: 'DANGER' });
    expect(health([run({ ago: 2, status: 'FAILED' })])).toMatchObject({
      reason: 'FAILED',
      state: 'DANGER',
    });
  });

  it('is red when the latest finished run failed, even after an older success', () => {
    const h = health([run({ ago: 1, status: 'FAILED' }), run({ ago: 5 })]);
    expect(h).toMatchObject({ reason: 'FAILED', state: 'DANGER' });
  });

  it('a later success clears an older failure', () => {
    const h = health([run({ ago: 1 }), run({ ago: 30, status: 'FAILED' })]);
    expect(h.reason).toBe('OK');
  });

  it('ignores a running backup when judging, but reports it', () => {
    const h = health([
      run({ ago: 0.05, status: 'RUNNING', finishedAt: null }),
      run({ ago: 3, status: 'FAILED' }),
    ]);
    expect(h.running).toBe(true);
    expect(h.reason).toBe('FAILED');
  });

  it('treats an old RUNNING row as a crashed (failed) run', () => {
    const h = health([run({ ago: 7, status: 'RUNNING', finishedAt: null }), run({ ago: 30 })]);
    expect(h.running).toBe(false);
    expect(h.reason).toBe('FAILED');
  });

  it('local-only is orange only when Google Drive is set up', () => {
    expect(health([run({ ago: 1, destination: 'LOCAL' })]).reason).toBe('OK');
    const withDrive = { ...online, gdriveConfigured: true };
    expect(health([run({ ago: 1, destination: 'LOCAL' })], { agent: withDrive })).toMatchObject({
      reason: 'LOCAL_ONLY',
      state: 'WARNING',
    });
    expect(health([run({ ago: 1, destination: 'BOTH' })], { agent: withDrive }).reason).toBe('OK');
  });

  it('warns when the backup container is not running', () => {
    expect(health([run({ ago: 1 })], { agent: null })).toMatchObject({
      reason: 'AGENT_OFFLINE',
      state: 'WARNING',
      agentOnline: false,
    });
    const stale = { lastSeenAt: hoursAgo(0.1), gdriveConfigured: false };
    expect(health([run({ ago: 1 })], { agent: stale }).agentOnline).toBe(false);
    // A worse problem wins.
    expect(health([], { agent: null }).reason).toBe('NEVER');
  });

  it('reports pending "Backup now" requests', () => {
    expect(health([run({ ago: 1 })], { pending: 1 }).pending).toBe(true);
    expect(health([run({ ago: 1 })]).pending).toBe(false);
  });

  it('uses a success older than the recent list', () => {
    const old = run({ ago: 40 });
    expect(health([], { lastSuccess: old }).reason).toBe('OLD');
  });
});

describe('isRunning', () => {
  it('is only true for young RUNNING rows', () => {
    expect(isRunning({ status: 'RUNNING', startedAt: hoursAgo(5.9) }, NOW)).toBe(true);
    expect(isRunning({ status: 'RUNNING', startedAt: hoursAgo(6.1) }, NOW)).toBe(false);
    expect(isRunning({ status: 'SUCCESS', startedAt: hoursAgo(0) }, NOW)).toBe(false);
  });
});

describe('backupAttention', () => {
  it('is empty when green', () => {
    expect(backupAttention({ state: 'OK', reason: 'OK' }, '2026-10-16', NOW.toISOString())).toBe(
      null,
    );
  });

  it('maps reasons to sentences and severities', () => {
    const failed = backupAttention(
      { state: 'DANGER', reason: 'FAILED' },
      '2026-10-10',
      NOW.toISOString(),
    );
    expect(failed).toMatchObject({
      id: 'backup:FAILED',
      type: 'BACKUP',
      severity: 'DANGER',
      titleKey: 'backupFailed',
      entityType: 'BACKUP',
      dueDate: null,
    });
    const old = backupAttention({ state: 'WARNING', reason: 'OLD' }, '2026-10-14', 'x');
    expect(old).toMatchObject({
      severity: 'WARNING',
      titleKey: 'backupOld',
      dueDate: '2026-10-14',
    });
    expect(
      backupAttention({ state: 'WARNING', reason: 'AGENT_OFFLINE' }, null, 'x')?.titleKey,
    ).toBe('backupAgentOffline');
  });
});
