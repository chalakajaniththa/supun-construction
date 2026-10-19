# syntax=docker/dockerfile:1
# Supun Construction — SeaweedFS (document storage) with our start script built in, so the
# published image works without the source code (deploy/docker-compose.yml).
FROM chrislusf/seaweedfs:4.48
COPY --chmod=0755 docker/seaweedfs/entrypoint.sh /sc-entrypoint.sh
ENTRYPOINT ["/bin/sh", "/sc-entrypoint.sh"]
