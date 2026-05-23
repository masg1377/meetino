# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────────────
# Meetino — production image for the NestJS API.
#
# Multi-stage so the final runtime image only carries the compiled JS,
# the Prisma engine binaries, and the runtime deps. Build deps (TS,
# nest CLI, dev dependencies) stay in the "deps"/"build" stages.
#
# Build context MUST be the repo root (we use the pnpm workspace):
#   docker build -f apps/api/Dockerfile -t meetino-api:latest .
#
# All stages pin node:20-alpine + corepack for reproducibility.
# ─────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20-alpine

# ── 1) deps ──────────────────────────────────────────────────────────
# Cached install of the entire workspace. We copy only the lockfile +
# package.json manifests so this layer survives application-code changes.
FROM node:${NODE_VERSION} AS deps
RUN corepack enable && apk add --no-cache libc6-compat openssl
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Frozen install gives us reproducible builds. --prod=false because the
# API needs nest-cli and prisma during the build step below.
RUN pnpm install --frozen-lockfile

# ── 2) build ─────────────────────────────────────────────────────────
# Compile the shared package, generate the Prisma client, then nest build.
FROM node:${NODE_VERSION} AS build
RUN corepack enable && apk add --no-cache libc6-compat openssl
WORKDIR /repo

# Reuse the cached node_modules from the deps stage.
COPY --from=deps /repo /repo
COPY . .

# `@meetino/shared` is consumed by both web and api; build it once.
RUN pnpm --filter @meetino/shared build

# Prisma client must be generated INSIDE the image so the engine
# binaries match the alpine runtime.
RUN pnpm --filter @meetino/api exec prisma generate --schema=src/prisma/schema.prisma

# Compile the API.
RUN pnpm --filter @meetino/api build

# Build a "deployable" tree:
#   /repo/apps/api/dist                 — compiled JS
#   /repo/apps/api/node_modules         — prod deps (we'll re-resolve below)
#   /repo/apps/api/src/prisma/schema.prisma  — schema + migrations
# We re-install with --prod so devDependencies (nest-cli, ts, eslint) drop out.
RUN pnpm --filter @meetino/api... install --prod --frozen-lockfile

# ── 3) runtime ───────────────────────────────────────────────────────
# Minimal final image. Runs as a non-root user. Node's tini equivalent
# (--init) is handled by docker compose (init: true) for clean PID 1.
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache libc6-compat openssl tini && \
    addgroup -S meetino && adduser -S meetino -G meetino
WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn

# Everything the runtime needs, copied with correct ownership.
COPY --from=build --chown=meetino:meetino /repo/node_modules            ./node_modules
COPY --from=build --chown=meetino:meetino /repo/packages/shared         ./packages/shared
COPY --from=build --chown=meetino:meetino /repo/apps/api/dist           ./apps/api/dist
COPY --from=build --chown=meetino:meetino /repo/apps/api/node_modules   ./apps/api/node_modules
COPY --from=build --chown=meetino:meetino /repo/apps/api/package.json   ./apps/api/package.json
COPY --from=build --chown=meetino:meetino /repo/apps/api/src/prisma     ./apps/api/src/prisma
COPY --from=build --chown=meetino:meetino /repo/apps/api/scripts        ./apps/api/scripts

USER meetino
WORKDIR /app/apps/api

# Storage directory for shared-file uploads. The actual path is owned by
# docker compose (volume mount) — we just make sure it exists in the
# image so a misconfigured deploy fails early instead of mid-upload.
RUN mkdir -p /app/apps/api/storage/meeting-files

EXPOSE 4000

# `pnpm` is intentionally NOT in the runtime image — we call `node` directly.
# `prisma migrate deploy` is run as a separate one-shot container, not on boot.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
