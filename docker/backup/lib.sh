# shellcheck shell=bash
# Shared helpers for the backup container scripts (sourced, bash).
# Environment (set in docker-compose.yml):
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE      database to back up
#   S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET  SeaweedFS (document files)
#   RESTIC_PASSWORD                                  encrypts both backup repositories
#   BACKUP_SCHEDULE (cron, default "0 23 * * *")     BACKUP_POLL_SECONDS (default 15)
#   GDRIVE_FOLDER (default SupunConstructionBackup)  LOCAL_REPO (default /backup-local/restic)

export TZ="${TZ:-Asia/Colombo}"
export BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-0 23 * * *}"
export BACKUP_POLL_SECONDS="${BACKUP_POLL_SECONDS:-15}"
export GDRIVE_FOLDER="${GDRIVE_FOLDER:-SupunConstructionBackup}"
export LOCAL_REPO="${LOCAL_REPO:-/backup-local/restic}"
export WORK_DIR="${WORK_DIR:-/work}"
export LOCK_FILE="${LOCK_FILE:-/tmp/backup.lock}"
export BACKUP_VERSION="1"
export API_HEALTH_URL="${API_HEALTH_URL:-http://api:4000/health}"
export RESTIC_HOST="supun"
# rclone: Google Drive lives in rclone.conf (written by setup-gdrive); the SeaweedFS remote
# "store" is defined from the environment so it never needs a config file.
export RCLONE_CONF_PATH="${RCLONE_CONF_PATH:-/config/rclone/rclone.conf}"
# rclone only reads rclone.conf when it exists (avoids "config file not found" noise).
if [ -f "$RCLONE_CONF_PATH" ]; then
  export RCLONE_CONFIG="$RCLONE_CONF_PATH"
else
  export RCLONE_CONFIG=/tmp/rclone-empty.conf
  : >"$RCLONE_CONFIG"
fi
export RCLONE_CONFIG_STORE_TYPE=s3
export RCLONE_CONFIG_STORE_PROVIDER=SeaweedFS
export RCLONE_CONFIG_STORE_ENDPOINT="${S3_ENDPOINT:-http://seaweedfs:8333}"
export RCLONE_CONFIG_STORE_ACCESS_KEY_ID="${S3_ACCESS_KEY:-}"
export RCLONE_CONFIG_STORE_SECRET_ACCESS_KEY="${S3_SECRET_KEY:-}"
export RCLONE_CONFIG_STORE_REGION="${S3_REGION:-us-east-1}"
export RCLONE_CONFIG_STORE_FORCE_PATH_STYLE=true
export S3_BUCKET="${S3_BUCKET:-supun-docs}"

log() { printf '%s [backup] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# q "SQL" [psql -v args…] — runs SQL from stdin (so :'var' interpolation works), prints rows.
q() {
  local sql="$1"
  shift
  printf '%s\n' "$sql" | psql -X -q -t -A -v ON_ERROR_STOP=1 "$@"
}

gdrive_configured() {
  [ -f "$RCLONE_CONF_PATH" ] && grep -q '^\[gdrive\]' "$RCLONE_CONF_PATH"
}

gdrive_repo() { printf 'rclone:gdrive:%s' "$GDRIVE_FOLDER"; }

# Initialises a restic repository when it does not exist yet (restic ≥ 0.17: exit code 10).
ensure_repo() {
  local repo="$1" out rc
  set +e
  out="$(restic -r "$repo" cat config 2>&1 >/dev/null)"
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then return 0; fi
  if [ "$rc" -eq 10 ] || printf '%s' "$out" | grep -qiE 'does not exist|no such file|Is there a repository'; then
    log "creating backup repository $repo"
    restic -r "$repo" init
    return 0
  fi
  printf '%s\n' "$out" >&2
  if printf '%s' "$out" | grep -qi 'wrong password'; then
    echo "RESTIC_PASSWORD does not match this backup repository ($repo)." >&2
  fi
  return "$rc"
}

heartbeat() {
  local gd=false
  gdrive_configured && gd=true
  q "INSERT INTO backup_agent (id, last_seen_at, gdrive_configured, schedule, version, created_at, updated_at)
     VALUES (1, now(), :gd, :'schedule', :'version', now(), now())
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now(), gdrive_configured = EXCLUDED.gdrive_configured,
       schedule = EXCLUDED.schedule, version = EXCLUDED.version, updated_at = now()" \
    -v gd="$gd" -v schedule="$BACKUP_SCHEDULE" -v version="$BACKUP_VERSION" >/dev/null
}

human_size() {
  awk -v b="$1" 'BEGIN { split("B KB MB GB TB", u); i = 1; while (b >= 1024 && i < 5) { b /= 1024; i++ } printf (i == 1 ? "%d %s" : "%.1f %s"), b, u[i] }'
}
