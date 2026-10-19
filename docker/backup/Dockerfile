# syntax=docker/dockerfile:1
# Supun Construction — backup service (pg_dump + rclone + restic + supercronic).
# Build context: repo root. Multi-arch (linux/amd64 + linux/arm64).
#
# postgresql18-client MUST match the server's major version (postgres:18.6-alpine).
FROM alpine:3.24.2

RUN apk add --no-cache bash postgresql18-client restic rclone supercronic socat curl jq tzdata \
      flock \
    && flock --version && restic version && rclone version | head -n 1 && pg_dump --version

ENV TZ=Asia/Colombo \
    LOCAL_REPO=/backup-local/restic \
    RCLONE_CONF_PATH=/config/rclone/rclone.conf \
    XDG_CACHE_HOME=/backup-local/cache

COPY docker/backup/lib.sh /usr/local/lib/backup/lib.sh
COPY --chmod=0755 docker/backup/backup.sh docker/backup/worker.sh docker/backup/restore.sh \
     docker/backup/gdrive-setup.sh docker/backup/gdrive-link.sh docker/backup/run-backup \
     /usr/local/bin/

# Google sign-in answer (rclone listens on 127.0.0.1:53682; socat forwards :53683 to it)
EXPOSE 53683
VOLUME ["/backup-local"]
WORKDIR /work

# Alive = the heartbeat loop is writing (worker.sh); the scheduler is checked by worker.sh itself.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD pgrep -f supercronic >/dev/null || exit 1

CMD ["/usr/local/bin/worker.sh"]
