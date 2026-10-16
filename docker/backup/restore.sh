#!/bin/bash
# Supun Construction — restore a backup (runs inside the backup container).
# Use scripts/restore.sh on the Mac: it stops the app first and starts it again afterwards.
#
#   restore.sh [--from local|gdrive] --list
#   restore.sh [--from local|gdrive] [--snapshot ID|latest] [--yes]
#
# Replaces the WHOLE database and all document files with the chosen backup.
set -Eeuo pipefail
# shellcheck source=docker/backup/lib.sh
. /usr/local/lib/backup/lib.sh

FROM=local
SNAPSHOT=latest
LIST=0
YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2 ;;
    --snapshot) SNAPSHOT="${2:-}"; shift 2 ;;
    --list) LIST=1; shift ;;
    --yes) YES=1; shift ;;
    -h | --help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

case "$FROM" in
  local) REPO="$LOCAL_REPO" ;;
  gdrive)
    if ! gdrive_configured; then
      echo "Google Drive is not set up on this computer (run scripts/setup-gdrive.command first)." >&2
      exit 1
    fi
    REPO="$(gdrive_repo)"
    ;;
  *) echo "--from must be local or gdrive" >&2; exit 2 ;;
esac
[[ "$SNAPSHOT" =~ ^(latest|[0-9a-f]{8,64})$ ]] || { echo "Snapshot must be 'latest' or an ID like 1a2b3c4d" >&2; exit 2; }

if [ "$LIST" -eq 1 ]; then
  restic -r "$REPO" snapshots --host "$RESTIC_HOST"
  exit 0
fi

# Same lock as the backups: never restore while a backup runs (and no backup starts meanwhile).
exec 9>"$LOCK_FILE"
log "waiting for any running backup to finish…"
flock -w 3600 9

# Resolve and show the snapshot.
SNAP_JSON="$(restic -r "$REPO" snapshots --host "$RESTIC_HOST" --json "$SNAPSHOT")"
SNAP_ID="$(printf '%s' "$SNAP_JSON" | jq -r '.[-1].short_id // empty')"
# restic records the container's local time (Asia/Colombo) with its offset.
SNAP_TIME="$(printf '%s' "$SNAP_JSON" | jq -r '.[-1].time // empty' | cut -c1-16 | tr 'T' ' ')"
if [ -z "$SNAP_ID" ]; then
  echo "No backup found ($FROM, $SNAPSHOT)." >&2
  exit 1
fi
log "restoring backup $SNAP_ID from $SNAP_TIME — source: $FROM"

if [ "$YES" -ne 1 ]; then
  echo
  echo "This REPLACES all current data (database and documents) with the backup from $SNAP_TIME."
  read -r -p "Type RESTORE to continue: " answer
  [ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }
fi

RESTORE_DIR=/restore
rm -rf "$RESTORE_DIR"
mkdir -p "$RESTORE_DIR"
trap 'rm -rf "$RESTORE_DIR"' EXIT

log "unpacking the backup…"
restic -r "$REPO" restore "$SNAP_ID" --target "$RESTORE_DIR" >/dev/null
DUMP="$RESTORE_DIR$WORK_DIR/db/supun.dump"
FILES="$RESTORE_DIR$WORK_DIR/files"
[ -s "$DUMP" ] || { echo "The backup has no database dump ($DUMP)." >&2; exit 1; }
mkdir -p "$FILES"

log "restoring the database…"
# Disconnect anything still connected (the app should already be stopped).
q "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE datname = current_database() AND pid <> pg_backend_pid()" >/dev/null
# Start from an empty schema, so tables added by a newer version do not survive and confuse
# the migrations (the app re-applies newer migrations when it starts).
q "SET client_min_messages = warning; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" >/dev/null
pg_restore --no-owner --no-privileges --exit-on-error --single-transaction -d "$PGDATABASE" "$DUMP"

# The run that made this backup was still RUNNING when the database was dumped.
q "UPDATE backup_runs SET status = 'SUCCESS', finished_at = COALESCE(finished_at, now()), updated_at = now(),
     message = :'msg' WHERE status = 'RUNNING'" \
  -v msg="This backup was restored on $(date '+%Y-%m-%d %H:%M')." >/dev/null

log "restoring document files…"
rclone mkdir "store:${S3_BUCKET}"
rclone sync "$FILES" "store:${S3_BUCKET}" --stats-log-level NOTICE

log "restore finished (backup $SNAP_ID from $SNAP_TIME)"
