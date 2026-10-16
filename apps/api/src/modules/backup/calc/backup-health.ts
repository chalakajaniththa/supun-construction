import {
  BACKUP_AGENT_OFFLINE_MINUTES,
  BACKUP_DANGER_HOURS,
  BACKUP_RUNNING_MAX_HOURS,
  BACKUP_WARN_HOURS,
  type BackupReason,
  type BackupRunDto,
  type BackupState,
  type NotificationDto,
  type NotificationTitleKey,
} from '@sc/shared';

const HOUR = 3_600_000;

export interface BackupHealthInput {
  /** Latest runs, newest first (a handful is enough). */
  recent: readonly BackupRunDto[];
  /** Latest SUCCESS run (may be older than `recent`). */
  lastSuccess: BackupRunDto | null;
  agent: { lastSeenAt: string; gdriveConfigured: boolean } | null;
  pendingRequests: number;
  now: Date;
}

export interface BackupHealth {
  state: BackupState;
  reason: BackupReason;
  running: boolean;
  pending: boolean;
  agentOnline: boolean;
  hoursSinceSuccess: number | null;
}

/** A RUNNING row is only "running" while it is young; older ones are crashed runs. */
export function isRunning(run: Pick<BackupRunDto, 'status' | 'startedAt'>, now: Date): boolean {
  return (
    run.status === 'RUNNING' &&
    now.getTime() - new Date(run.startedAt).getTime() < BACKUP_RUNNING_MAX_HOURS * HOUR
  );
}

const STATE: Record<BackupReason, BackupState> = {
  OK: 'OK',
  OLD: 'WARNING',
  LOCAL_ONLY: 'WARNING',
  AGENT_OFFLINE: 'WARNING',
  TOO_OLD: 'DANGER',
  FAILED: 'DANGER',
  NEVER: 'DANGER',
};

/**
 * The backup traffic light (Step 6):
 * red — the latest finished run failed, no success ever, or the last success is older than 72 h;
 * orange — older than 36 h, Google Drive is set up but the last backup only reached this computer,
 * or the backup container is not running; green otherwise. A local-only backup is green while
 * Google Drive is not set up (Settings shows "connect Google Drive" separately).
 */
export function backupHealth(input: BackupHealthInput): BackupHealth {
  const { now, lastSuccess, agent } = input;
  const running = input.recent.some((r) => isRunning(r, now));
  const lastFinished = input.recent.find((r) => !isRunning(r, now)) ?? null;
  const agentOnline =
    agent !== null &&
    now.getTime() - new Date(agent.lastSeenAt).getTime() < BACKUP_AGENT_OFFLINE_MINUTES * 60_000;
  const successAt = lastSuccess ? new Date(lastSuccess.finishedAt ?? lastSuccess.startedAt) : null;
  const hoursSinceSuccess = successAt
    ? Math.max(0, Math.floor((now.getTime() - successAt.getTime()) / HOUR))
    : null;

  // FAILED, or a RUNNING row too old to be alive (the computer was switched off mid-backup).
  const failedLast = lastFinished !== null && lastFinished.status !== 'SUCCESS';

  let reason: BackupReason;
  if (!lastSuccess) reason = failedLast ? 'FAILED' : 'NEVER';
  else if (failedLast) reason = 'FAILED';
  else if (hoursSinceSuccess! >= BACKUP_DANGER_HOURS) reason = 'TOO_OLD';
  else if (hoursSinceSuccess! >= BACKUP_WARN_HOURS) reason = 'OLD';
  else if (agent?.gdriveConfigured && lastSuccess.destination === 'LOCAL') reason = 'LOCAL_ONLY';
  else if (!agentOnline) reason = 'AGENT_OFFLINE';
  else reason = 'OK';

  return {
    state: STATE[reason],
    reason,
    running,
    pending: input.pendingRequests > 0,
    agentOnline,
    hoursSinceSuccess,
  };
}

const TITLE: Record<Exclude<BackupReason, 'OK'>, NotificationTitleKey> = {
  FAILED: 'backupFailed',
  NEVER: 'backupNever',
  TOO_OLD: 'backupTooOld',
  OLD: 'backupOld',
  LOCAL_ONLY: 'backupLocalOnly',
  AGENT_OFFLINE: 'backupAgentOffline',
};

/** The dashboard "Needs attention" item for a backup problem (none when green). */
export function backupAttention(
  health: Pick<BackupHealth, 'state' | 'reason'>,
  lastSuccessDay: string | null,
  now: string,
): NotificationDto | null {
  if (health.reason === 'OK' || health.state === 'OK') return null;
  const withAge = health.reason === 'OLD' || health.reason === 'TOO_OLD';
  return {
    id: `backup:${health.reason}`,
    type: 'BACKUP',
    severity: health.state === 'DANGER' ? 'DANGER' : 'WARNING',
    titleKey: TITLE[health.reason],
    params: {},
    entityType: 'BACKUP',
    entityId: null,
    dueDate: withAge ? lastSuccessDay : null,
    readAt: null,
    resolvedAt: null,
    createdAt: now,
  };
}
