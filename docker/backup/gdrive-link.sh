#!/bin/bash
# Supun Construction — "Connect Google Drive" from the app (Settings → Backup).
# Runs in the background of the backup container (started by worker.sh). Every 2 seconds it picks
# up the action the app wrote into gdrive_link (CONNECT / CANCEL / DISCONNECT) and reports back:
#   STARTING → WAITING (auth_url: the owner opens it and allows access) → TESTING → DONE | FAILED
#
# The sign-in is rclone's own: rclone waits for Google's answer on 127.0.0.1:53682 inside this
# container; socat makes it reachable from the browser through the published port
# (host 127.0.0.1:53682 → container :53683 → 127.0.0.1:53682). So the sign-in has to be done in a
# browser on the computer that runs the system.
set -uo pipefail
# shellcheck source=docker/backup/lib.sh
. /usr/local/lib/backup/lib.sh

TIMEOUT_SECONDS="${GDRIVE_LINK_TIMEOUT_SECONDS:-600}"
NEW_CONF=/tmp/rclone-gdrive-new.conf
JOB_PID=""

set_state() { # state [auth_url] [message]
  q "UPDATE gdrive_link SET state = :'st', auth_url = NULLIF(:'url', ''), message = NULLIF(:'msg', ''),
       updated_at = now() WHERE id = 1" \
    -v st="$1" -v url="${2:-}" -v msg="${3:-}" >/dev/null || log "gdrive: could not save the state $1"
}

stop_job() {
  pkill -f 'rclone config create gdrive' 2>/dev/null || true
  pkill -f 'socat TCP-LISTEN:53683' 2>/dev/null || true
  if [ -n "$JOB_PID" ]; then
    kill "$JOB_PID" 2>/dev/null || true
    wait "$JOB_PID" 2>/dev/null || true
  fi
  JOB_PID=""
}

# The sign-in itself (runs in the background so CANCEL can stop it).
connect_job() {
  set -uo pipefail
  set_state STARTING
  rm -f "$NEW_CONF"
  : >"$NEW_CONF"
  chmod 600 "$NEW_CONF"
  local args=(gdrive drive scope=drive.file config_is_local=true)
  [ -n "${GDRIVE_CLIENT_ID:-}" ] && args+=("client_id=$GDRIVE_CLIENT_ID")
  [ -n "${GDRIVE_CLIENT_SECRET:-}" ] && args+=("client_secret=$GDRIVE_CLIENT_SECRET")

  socat TCP-LISTEN:53683,fork,reuseaddr TCP:127.0.0.1:53682 &
  local socat_pid=$!

  local url="" line rc
  # rclone prints the sign-in link, then waits until Google sends the answer back.
  while IFS= read -r line; do
    case "$line" in
      *http://127.0.0.1:53682/auth*)
        if [ -z "$url" ]; then
          url="$(printf '%s' "$line" | grep -o 'http://127.0.0.1:53682/auth[^ ]*' | head -n 1)"
          log "gdrive: waiting for the owner to sign in"
          set_state WAITING "$url"
        fi
        ;;
    esac
  done < <(RCLONE_CONFIG="$NEW_CONF" timeout "$TIMEOUT_SECONDS" rclone config create "${args[@]}" 2>&1)
  wait $! 2>/dev/null
  rc=$?
  kill "$socat_pid" 2>/dev/null || true

  if ! grep -q '^\[gdrive\]' "$NEW_CONF" || ! grep -q 'token' "$NEW_CONF"; then
    log "gdrive: sign-in not finished (rc $rc)"
    set_state FAILED "" "The Google sign-in was not finished (it was closed, refused, or took longer than $((TIMEOUT_SECONDS / 60)) minutes). Please try again."
    rm -f "$NEW_CONF"
    return 1
  fi

  set_state TESTING
  local out
  if ! out="$(RCLONE_CONFIG="$NEW_CONF" rclone mkdir "gdrive:$GDRIVE_FOLDER" 2>&1 &&
    RCLONE_CONFIG="$NEW_CONF" rclone lsd gdrive: 2>&1 >/dev/null)"; then
    log "gdrive: test failed: $out"
    set_state FAILED "" "Google Drive did not answer correctly, so it was not connected: ${out:0:300}"
    rm -f "$NEW_CONF"
    return 1
  fi

  # Keep any other remotes in rclone.conf; replace only [gdrive].
  mkdir -p "$(dirname "$RCLONE_CONF_PATH")"
  touch "$RCLONE_CONF_PATH" && chmod 600 "$RCLONE_CONF_PATH"
  RCLONE_CONFIG="$RCLONE_CONF_PATH" rclone config delete gdrive >/dev/null 2>&1 || true
  cat "$NEW_CONF" >>"$RCLONE_CONF_PATH"
  rm -f "$NEW_CONF"
  heartbeat || true
  log "gdrive: connected (folder \"$GDRIVE_FOLDER\")"
  set_state DONE
}

disconnect() {
  if [ -f "$RCLONE_CONF_PATH" ]; then
    RCLONE_CONFIG="$RCLONE_CONF_PATH" rclone config delete gdrive >/dev/null 2>&1 || true
  fi
  heartbeat || true
  log "gdrive: disconnected (backups stay on this computer)"
  set_state IDLE
}

until q "SELECT 1 FROM gdrive_link LIMIT 1" >/dev/null 2>&1 ||
  q "INSERT INTO gdrive_link (id) VALUES (1) ON CONFLICT DO NOTHING" >/dev/null 2>&1; do
  sleep 10
done
# A sign-in from before a restart cannot be finished any more.
q "UPDATE gdrive_link SET state = 'IDLE', auth_url = NULL, updated_at = now()
   WHERE id = 1 AND state IN ('STARTING', 'WAITING', 'TESTING')" >/dev/null || true

trap 'stop_job; exit 0' TERM INT

while true; do
  # Take the waiting action (RETURNING shows the new row, so read the old value in a CTE).
  action="$(q "WITH picked AS (SELECT action FROM gdrive_link WHERE id = 1 AND action IS NOT NULL FOR UPDATE)
               UPDATE gdrive_link g SET action = NULL FROM picked WHERE g.id = 1 RETURNING picked.action" \
    2>/dev/null || true)"
  case "$action" in
    CONNECT)
      log "gdrive: \"Connect Google Drive\" requested"
      stop_job
      connect_job &
      JOB_PID=$!
      ;;
    CANCEL)
      log "gdrive: sign-in cancelled"
      stop_job
      set_state IDLE
      ;;
    DISCONNECT)
      stop_job
      disconnect
      ;;
  esac
  # forget a finished job
  if [ -n "$JOB_PID" ] && ! kill -0 "$JOB_PID" 2>/dev/null; then
    wait "$JOB_PID" 2>/dev/null || true
    JOB_PID=""
  fi
  sleep 2
done
