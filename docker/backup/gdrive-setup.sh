#!/bin/bash
# Connects Google Drive for backups (runs in a one-off backup container, started by
# scripts/setup-gdrive.command). Writes the [gdrive] remote into /config/rclone/rclone.conf.
#
# Default: browser sign-in. rclone waits for Google's answer on 127.0.0.1:53682 inside this
# container; socat makes it reachable from the Mac's browser through the published port
# (host 127.0.0.1:53682 → container :53683 → 127.0.0.1:53682).
# Fallback: GDRIVE_TOKEN='{"access_token":…}' (from `rclone authorize "drive" "…"` elsewhere).
# Optional own Google client: GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET (better rate limits).
set -Eeuo pipefail
# shellcheck source=docker/backup/lib.sh
. /usr/local/lib/backup/lib.sh

mkdir -p "$(dirname "$RCLONE_CONF_PATH")"
touch "$RCLONE_CONF_PATH" || { echo "Cannot write $RCLONE_CONF_PATH (folder config/rclone)." >&2; exit 1; }
chmod 600 "$RCLONE_CONF_PATH"
export RCLONE_CONFIG="$RCLONE_CONF_PATH"

ARGS=(gdrive drive scope=drive.file)
[ -n "${GDRIVE_CLIENT_ID:-}" ] && ARGS+=("client_id=$GDRIVE_CLIENT_ID")
[ -n "${GDRIVE_CLIENT_SECRET:-}" ] && ARGS+=("client_secret=$GDRIVE_CLIENT_SECRET")

if gdrive_configured; then
  log "replacing the existing Google Drive connection"
  rclone config delete gdrive
fi

if [ -n "${GDRIVE_TOKEN:-}" ]; then
  log "saving the Google Drive token…"
  rclone config create "${ARGS[@]}" "token=$GDRIVE_TOKEN" --non-interactive >/dev/null
else
  socat TCP-LISTEN:53683,fork,reuseaddr TCP:127.0.0.1:53682 &
  SOCAT_PID=$!
  trap 'kill $SOCAT_PID 2>/dev/null || true' EXIT
  echo
  echo "A Google sign-in page opens in your browser now."
  echo "If it does not, copy the link below (starting with http://127.0.0.1:53682/auth) into the browser."
  echo
  rclone config create "${ARGS[@]}" config_is_local=true >/dev/null
fi

gdrive_configured || { echo "Google Drive was not connected." >&2; exit 1; }

log "testing Google Drive…"
if ! { rclone mkdir "gdrive:$GDRIVE_FOLDER" && rclone lsd gdrive: >/dev/null; }; then
  # Do not leave a broken connection behind (backups would keep failing on it).
  rclone config delete gdrive || true
  echo "Google Drive did not answer correctly, so it was not connected. Please try again." >&2
  exit 1
fi
heartbeat || true
echo
echo "Google Drive is connected. Backups will also be saved in the folder \"$GDRIVE_FOLDER\"."
