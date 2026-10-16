#!/bin/bash
# Supun Construction — one backup run (called by run-backup, which holds the lock).
#   1. records a RUNNING row in backup_runs (and marks waiting "Backup now" requests as picked)
#   2. pg_dump -Fc → /work/db/supun.dump
#   3. mirrors the SeaweedFS bucket → /work/files (rclone sync)
#   4. restic backup /work → local repository (always)
#   5. restic backup /work → Google Drive (when rclone.conf has a [gdrive] remote)
#   6. restic forget (7 daily, 4 weekly, 12 monthly); prune on Sundays
#   7. SUCCESS / FAILED with size, destination and a short message
# Usage: backup.sh SCHEDULED|MANUAL
set -Eeuo pipefail
# shellcheck source=docker/backup/lib.sh
. /usr/local/lib/backup/lib.sh

TRIGGER="${1:-SCHEDULED}"
case "$TRIGGER" in SCHEDULED | MANUAL) ;; *)
  echo "usage: backup.sh SCHEDULED|MANUAL" >&2
  exit 2
  ;;
esac

LOG_FILE="$(mktemp /tmp/backup-log.XXXXXX)"
exec > >(tee -a "$LOG_FILE") 2>&1
RUN_ID=""
FINISHED=0

on_exit() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ -n "$RUN_ID" ] && [ "$FINISHED" -eq 0 ]; then
    local tail_msg
    tail_msg="$(grep -v '^\s*$' "$LOG_FILE" | tail -n 6 | cut -c1-300 | tr '\n' ' ' | sed 's/  */ /g')"
    log "backup FAILED (exit $rc)"
    q "UPDATE backup_runs SET status = 'FAILED', finished_at = now(), updated_at = now(),
         message = :'msg' WHERE id = :'id'" \
      -v id="$RUN_ID" -v msg="Failed: ${tail_msg:0:900}" >/dev/null || true
  fi
  rm -f "$LOG_FILE"
}
trap on_exit EXIT

RUN_ID="$(q "WITH picked AS (
    UPDATE backup_requests SET picked_at = now(), updated_at = now() WHERE picked_at IS NULL RETURNING id)
  INSERT INTO backup_runs (id, started_at, status, \"trigger\", destination, message, created_at, updated_at)
  VALUES (gen_random_uuid(), now(), 'RUNNING', :'trigger', 'LOCAL', 'Backing up…', now(), now())
  RETURNING id" -v trigger="$TRIGGER")"
log "backup started ($TRIGGER, run $RUN_ID)"

mkdir -p "$WORK_DIR/db" "$WORK_DIR/files"

# ── 1. database ─────────────────────────────────────────────────────────────
log "dumping the database…"
pg_dump -Fc --no-owner -f "$WORK_DIR/db/supun.dump.tmp"
mv "$WORK_DIR/db/supun.dump.tmp" "$WORK_DIR/db/supun.dump"

# ── 2. document files ───────────────────────────────────────────────────────
if rclone lsf --dirs-only store: 2>/dev/null | grep -qx "${S3_BUCKET}/"; then
  log "copying document files from storage…"
  rclone sync "store:${S3_BUCKET}" "$WORK_DIR/files" --stats-log-level NOTICE
else
  log "storage bucket ${S3_BUCKET} does not exist yet — no files to copy"
  find "$WORK_DIR/files" -mindepth 1 -delete
fi

SIZE_BYTES=$(($(du -sk "$WORK_DIR" | cut -f1) * 1024))
log "data to back up: $(human_size "$SIZE_BYTES")"

# ── 3. local repository (always) ────────────────────────────────────────────
mkdir -p "$(dirname "$LOCAL_REPO")"
ensure_repo "$LOCAL_REPO"
log "saving to this computer…"
LOCAL_SNAP="$(restic -r "$LOCAL_REPO" backup "$WORK_DIR" --host "$RESTIC_HOST" --tag "$TRIGGER" --json |
  jq -r 'select(.message_type == "summary") | .snapshot_id' | cut -c1-8)"
log "local snapshot $LOCAL_SNAP"

FORGET=(forget --host "$RESTIC_HOST" --keep-daily 7 --keep-weekly 4 --keep-monthly 12)
# Pruning rewrites data; only on Sundays (forget alone is quick).
[ "$(date +%u)" = "7" ] && FORGET+=(--prune)
restic -r "$LOCAL_REPO" "${FORGET[@]}" >/dev/null

DESTINATION="LOCAL"
MESSAGE="Saved on this computer (snapshot $LOCAL_SNAP)."

# ── 4. Google Drive (optional) ──────────────────────────────────────────────
if gdrive_configured; then
  log "saving to Google Drive…"
  REPO="$(gdrive_repo)"
  set +e
  GD_OUT="$( (
    set -e
    ensure_repo "$REPO"
    restic -r "$REPO" backup "$WORK_DIR" --host "$RESTIC_HOST" --tag "$TRIGGER" --json |
      jq -r 'select(.message_type == "summary") | .snapshot_id' | cut -c1-8
    restic -r "$REPO" "${FORGET[@]}" >/dev/null
  ) 2>&1)"
  GD_RC=$?
  set -e
  if [ "$GD_RC" -eq 0 ]; then
    GD_SNAP="$(printf '%s\n' "$GD_OUT" | tail -n 1)"
    DESTINATION="BOTH"
    MESSAGE="Saved on this computer ($LOCAL_SNAP) and on Google Drive ($GD_SNAP)."
    log "Google Drive snapshot $GD_SNAP"
  else
    printf '%s\n' "$GD_OUT"
    GD_TAIL="$(printf '%s\n' "$GD_OUT" | grep -v '^\s*$' | tail -n 3 | cut -c1-200 | tr '\n' ' ')"
    MESSAGE="Saved on this computer ($LOCAL_SNAP). Google Drive did not work: ${GD_TAIL:0:600}"
    log "Google Drive backup failed (the local backup is fine)"
  fi
fi

FINISHED=1
q "UPDATE backup_runs SET status = 'SUCCESS', finished_at = now(), updated_at = now(),
     size_bytes = :size, destination = :'dest', message = :'msg' WHERE id = :'id'" \
  -v id="$RUN_ID" -v size="$SIZE_BYTES" -v dest="$DESTINATION" -v msg="$MESSAGE" >/dev/null
heartbeat || true
log "backup finished: $MESSAGE"
