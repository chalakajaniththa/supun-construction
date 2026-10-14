#!/bin/sh
# Renders the S3 credentials file from env, then starts SeaweedFS in single-node "mini" mode
# (master + volume + filer + S3 in one process) through the image's own entrypoint.
set -eu

: "${S3_ACCESS_KEY:?S3_ACCESS_KEY is required}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY is required}"

CONFIG=/etc/seaweedfs/s3.json
cat > "$CONFIG" <<JSON
{
  "identities": [
    {
      "name": "supun-api",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }],
      "actions": ["Admin", "Read", "List", "Tagging", "Write"]
    }
  ]
}
JSON
chown seaweed:seaweed "$CONFIG" 2>/dev/null || true
chmod 600 "$CONFIG"

exec /entrypoint.sh mini -dir=/data -ip.bind=0.0.0.0 -s3.config="$CONFIG" -admin.ui=false "$@"
