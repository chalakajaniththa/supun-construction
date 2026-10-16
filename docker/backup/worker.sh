#!/bin/bash
# Supun Construction — the backup container's main process.
#   • supercronic runs the nightly backup (BACKUP_SCHEDULE, default 23:00 Asia/Colombo)
#   • a heartbeat tells the app the backup service is alive (and whether Google Drive is set up)
#   • every BACKUP_POLL_SECONDS it looks for "Backup now" requests from the app
#   • on start it makes a catch-up backup when the last success is older than 24 h
#     (the MacBook may have been asleep at 23:00)
set -uo pipefail
# shellcheck source=docker/backup/lib.sh
. /usr/local/lib/backup/lib.sh

CHILDREN=()
shutdown() {
  log "stopping"
  for pid in "${CHILDREN[@]}"; do kill "$pid" 2>/dev/null || true; done
  exit 0
}
trap shutdown TERM INT

: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required (it is created in .env by start.command)}"

if ! [ -w "$(dirname "$RCLONE_CONF_PATH")" ]; then
  log "note: $(dirname "$RCLONE_CONF_PATH") is not writable — Google Drive setup will not be able to save its connection"
fi

log "backup service starting (schedule \"$BACKUP_SCHEDULE\", $TZ)"
log "waiting for the database…"
until q "SELECT 1 FROM backup_runs LIMIT 1" >/dev/null 2>&1 && q "SELECT 1 FROM backup_agent LIMIT 1" >/dev/null 2>&1; do
  sleep 5
done

# A run still marked RUNNING was cut off (container stopped or computer switched off).
q "UPDATE backup_runs SET status = 'FAILED', finished_at = now(), updated_at = now(),
     message = 'Interrupted: the backup stopped before it finished (the computer was turned off or restarted).'
   WHERE status = 'RUNNING'" >/dev/null || true

printf '%s /usr/local/bin/run-backup SCHEDULED\n' "$BACKUP_SCHEDULE" >/tmp/crontab
supercronic -quiet /tmp/crontab &
CHILDREN+=($!)

(while true; do
  heartbeat || log "heartbeat failed (database not reachable?)"
  sleep 30
done) &
CHILDREN+=($!)

# Let the app finish its start (migrations, first-time seed) before the catch-up backup, so the
# first backup is not of a half-made database. Backups never depend on the app: give up after 10 min.
for _ in $(seq 1 120); do
  curl -fsS -o /dev/null "$API_HEALTH_URL" 2>/dev/null && break
  sleep 5
done

recent="$(q "SELECT count(*) FROM backup_runs WHERE status = 'SUCCESS' AND started_at > now() - interval '24 hours'" || echo 1)"
if [ "$recent" = "0" ]; then
  log "no successful backup in the last 24 hours — making a catch-up backup now"
  /usr/local/bin/run-backup SCHEDULED || log "catch-up backup did not finish"
fi

while true; do
  waiting="$(q "SELECT count(*) FROM backup_requests WHERE picked_at IS NULL" 2>/dev/null || echo 0)"
  if [ "${waiting:-0}" != "0" ]; then
    log "\"Backup now\" requested"
    /usr/local/bin/run-backup MANUAL || log "backup did not finish (or another one is running)"
  fi
  if ! kill -0 "${CHILDREN[0]}" 2>/dev/null; then
    log "the scheduler stopped — restarting the container"
    exit 1
  fi
  sleep "$BACKUP_POLL_SECONDS" &
  wait $! || true
done
