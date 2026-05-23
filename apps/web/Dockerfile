# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────────────
# Meetino — production image for the Next.js web client.
#
# Uses `output: 'standalone'` (already set in next.config.mjs) so the
# final image is ~150 MB instead of ~700 MB. The standalone build copies
# only the files actually required by the route tree.
#
# Build context MUST be the repo root:
#   docker build -f apps/web/Dockerfile -t meetino-web:latest .
#
# IMPORTANT: NEXT_PUBLIC_* values are baked at build time. To rebuild
# with new API URLs you must re-run docker build with --build-arg.
# ─────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20-alpine

# ── 1) deps ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# ── 2) build ────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS build
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

# Build-time public env vars. Re-exposed below in ENV so Next.js sees them.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_LIVEKIT_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_APP_NAME=Meetino
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /repo /repo
COPY . .

# Shared package first — the web build imports compiled types from it.
RUN pnpm --filter @meetino/shared build

# Standalone build: writes .next/standalone (server.js + minimal node_modules)
# and .next/static (assets to copy alongside).
RUN pnpm --filter @meetino/web build

# ── 3) runtime ──────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache libc6-compat tini && \
    addgroup -S meetino && adduser -S meetino -G meetino
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The standalone output is the entire runtime bundle.
COPY --from=build --chown=meetino:meetino /repo/apps/web/.next/standalone ./
# Static + public assets aren't inside the standalone tree — copy them
# alongside so Next can serve them.
COPY --from=build --chown=meetino:meetino /repo/apps/web/.next/static    ./apps/web/.next/static
COPY --from=build --chown=meetino:meetino /repo/apps/web/public          ./apps/web/public

USER meetino

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
# The standalone bundle puts its `server.js` at the build-context root.
CMD ["node", "apps/web/server.js"]
