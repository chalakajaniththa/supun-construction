import { z } from 'zod';
import type { BackupDestination, BackupStatus, BackupTrigger } from '../enums';
import { paginationQuerySchema } from './pagination';

/**
 * Step 6 — backups. The backup container (docker/backup) writes `backup_runs` and `backup_agent`
 * with plain SQL; the API only reads them and queues "Backup now" requests.
 */

/** Hours after the last successful backup when the status turns orange / red. */
export const BACKUP_WARN_HOURS = 36;
export const BACKUP_DANGER_HOURS = 72;
/** The backup container writes a heartbeat every poll (15 s); older than this = not running. */
export const BACKUP_AGENT_OFFLINE_MINUTES = 5;
/** A RUNNING row older than this is a crashed run, not a running one. */
export const BACKUP_RUNNING_MAX_HOURS = 6;

/** Colour of the top-bar dot: OK = green, WARNING = orange, DANGER = red. */
export const BACKUP_STATES = ['OK', 'WARNING', 'DANGER'] as const;
export type BackupState = (typeof BACKUP_STATES)[number];

/** Why the status has its colour (i18n `backup.reasons.<REASON>`). */
export const BACKUP_REASONS = [
  'OK',
  'OLD',
  'LOCAL_ONLY',
  'AGENT_OFFLINE',
  'TOO_OLD',
  'FAILED',
  'NEVER',
] as const;
export type BackupReason = (typeof BACKUP_REASONS)[number];

export interface BackupRunDto {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: BackupStatus;
  trigger: BackupTrigger;
  /** Bytes of data backed up (database dump + files), as a string. */
  sizeBytes: string | null;
  destination: BackupDestination;
  message: string | null;
}

export interface BackupStatusDto {
  state: BackupState;
  reason: BackupReason;
  /** Latest run of any status. */
  lastRun: BackupRunDto | null;
  lastSuccess: BackupRunDto | null;
  /** Whole hours since the last success finished (null = never). */
  hoursSinceSuccess: number | null;
  /** A backup is running right now. */
  running: boolean;
  /** "Backup now" was pressed and the backup container has not picked it up yet. */
  pending: boolean;
  /** The backup container is alive (heartbeat within BACKUP_AGENT_OFFLINE_MINUTES). */
  agentOnline: boolean;
  agentSeenAt: string | null;
  /** Google Drive is set up (rclone.conf has a [gdrive] remote); null = unknown (no heartbeat yet). */
  gdriveConfigured: boolean | null;
  /** Cron expression of the nightly backup, e.g. "0 23 * * *". */
  schedule: string | null;
}

export const backupRunsQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true });
export type BackupRunsQuery = z.infer<typeof backupRunsQuerySchema>;

/**
 * POST /admin/reset-data — wipes every project, worker, machine, record and document.
 * SAMPLE loads the sample data again; EMPTY starts empty for real use (and the sample data is not
 * loaded again on the next start). The owner must type RESET and their login password.
 */
export const RESET_CONFIRM_WORD = 'RESET';
export const RESET_MODES = ['SAMPLE', 'EMPTY'] as const;
export type ResetMode = (typeof RESET_MODES)[number];
export const resetDataSchema = z.object({
  mode: z.enum(RESET_MODES),
  confirm: z.literal(RESET_CONFIRM_WORD, { error: 'TYPE_RESET' }),
  password: z.string({ error: 'REQUIRED' }).min(1, { error: 'REQUIRED' }).max(200),
});
export type ResetDataInput = z.infer<typeof resetDataSchema>;

/** The Setting row that remembers "started empty" (internal, not one of SETTING_KEYS). */
export const DATA_MODE_SETTING_KEY = 'dataMode';

// ── Google Drive (Settings → Backup → Connect Google Drive) ──────────────────────────────────

/**
 * The sign-in runs inside the backup container (rclone). IDLE = nothing going on; STARTING = the
 * container is preparing the sign-in; WAITING = the owner must open `authUrl` and allow access;
 * TESTING = signed in, checking that Drive works; DONE = connected; FAILED = see `message`.
 */
export const GDRIVE_LINK_STATES = [
  'IDLE',
  'STARTING',
  'WAITING',
  'TESTING',
  'DONE',
  'FAILED',
] as const;
export type GdriveLinkState = (typeof GDRIVE_LINK_STATES)[number];
export const GDRIVE_LINK_ACTIONS = ['CONNECT', 'CANCEL', 'DISCONNECT'] as const;
export type GdriveLinkAction = (typeof GDRIVE_LINK_ACTIONS)[number];
/** A sign-in that is not finished after this many minutes is given up. */
export const GDRIVE_LINK_TIMEOUT_MINUTES = 10;

export interface GdriveLinkDto {
  state: GdriveLinkState;
  /** The action the backup container has not picked up yet. */
  pendingAction: GdriveLinkAction | null;
  /** Open this in the browser (only on the computer that runs the system) while WAITING. */
  authUrl: string | null;
  /** Why it failed (English, from rclone), when FAILED. */
  message: string | null;
  /** Drive is connected (from the backup container's heartbeat); null = unknown. */
  configured: boolean | null;
  agentOnline: boolean;
  updatedAt: string;
}
