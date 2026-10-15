# syntax=docker/dockerfile:1
# Supun Construction — API (NestJS). Build context: repo root.
#   docker build -f docker/api.Dockerfile .
# Multi-arch: node:*-slim is published for linux/amd64 and linux/arm64 (Apple Silicon).

ARG NODE_IMAGE=node:24.21.0-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
RUN corepack enable
# OpenSSL for Prisma's schema engine (migrate deploy).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# ── build ────────────────────────────────────────────────────────────────────
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter supun-construction --filter "@sc/api..."
RUN pnpm --filter @sc/api build
# Self-contained production install of the API (workspace deps copied in, dev deps dropped).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @sc/api deploy --legacy --prod /out \
    && cp -r apps/api/dist /out/dist \
    && cp -r apps/web/messages /out/messages

# ── runtime ──────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    TZ=Asia/Colombo \
    PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
# Report labels / reminder sentences come from the web's message files.
COPY --from=build --chown=node:node /out/messages ./messages
COPY --from=build --chown=node:node /out/prisma ./prisma
COPY --from=build --chown=node:node /out/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "/usr/local/bin/api-entrypoint.sh"]
