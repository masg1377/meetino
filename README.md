# Meetino

Self-hosted video meeting and online classroom platform for **Irno Academy**.

Phase 1 delivers the project foundation: monorepo, Next.js frontend with RTL, NestJS API, PostgreSQL + Redis, Docker Compose, and a working health-check endpoint.

---

## Stack (Phase 1)

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, RTL |
| Backend | NestJS 10, TypeScript |
| Database | PostgreSQL 15 (via Prisma) |
| Cache | Redis 7 (via ioredis) |
| Infra | Docker Compose |
| Tooling | pnpm + Turborepo |

---

## Prerequisites

- **Node.js ≥ 20**
- **pnpm ≥ 9** — `npm install -g pnpm`
- **Docker** + **Docker Compose**
- Optional: download Vazirmatn fonts (see *Persian fonts* below)

---

## Quick start

```bash
# 1. Clone & enter
cd Meetino

# 2. Copy env file
cp .env.example .env

# 3. Install all workspace dependencies
pnpm install

# 4. Start Postgres + Redis
pnpm docker:up

# 5. Generate Prisma client & run the initial migration
cd apps/api
pnpm prisma:migrate    # name the migration something like "init"
cd ../..

# 6. Run everything in dev mode
pnpm dev
```

The API will be at **http://localhost:4000/api** and the web app at **http://localhost:3000**.

---

## Verifying Phase 1 works

```bash
# Liveness — should return { "status": "ok", ... }
curl http://localhost:4000/api/health/live

# Readiness — should return { "status": "ok", "checks": { "database": "ok", "redis": "ok" } }
curl http://localhost:4000/api/health/ready
```

Open the landing page in your browser at **http://localhost:3000** — you should see the Persian RTL landing page for Meetino.

If readiness returns `503` with `database: down` or `redis: down`, run `pnpm docker:up` and check `pnpm docker:logs`.

---

## Useful commands

| Command | Description |
|---|---|
| `pnpm dev` | Run web + api in parallel (Turborepo) |
| `pnpm docker:up` | Start Postgres + Redis containers |
| `pnpm docker:down` | Stop containers (volumes preserved) |
| `pnpm docker:logs` | Tail logs for the docker stack |
| `pnpm --filter @meetino/api prisma:studio` | Browse the DB |
| `pnpm --filter @meetino/api prisma:migrate` | Create a new Prisma migration |
| `pnpm typecheck` | Type-check every package |
| `pnpm lint` | Lint every package |

---

## Persian fonts (self-hosted, no CDN)

Per project rules we never pull fonts from an external CDN. Download Vazirmatn manually:

1. Go to **https://github.com/rastikerdar/vazirmatn/releases** (latest release).
2. Open the `webfonts` (or `Webfonts`) folder.
3. Copy these into `apps/web/public/fonts/vazirmatn/`:
   - `Vazirmatn-Regular.woff2`
   - `Vazirmatn-Medium.woff2`
   - `Vazirmatn-Bold.woff2`

If the files aren't there yet, the page still renders using the system-font fallback chain configured in `apps/web/tailwind.config.ts`.

---

## Project structure

```
meetino/
├── apps/
│   ├── api/          NestJS backend
│   │   └── src/
│   │       ├── config/        env validation + typed config
│   │       ├── prisma/        Prisma schema + service
│   │       ├── redis/         Redis service
│   │       ├── modules/
│   │       │   └── health/    /api/health/live & /ready
│   │       ├── app.module.ts
│   │       └── main.ts
│   └── web/          Next.js frontend
│       └── src/
│           ├── app/           App Router pages
│           ├── components/    UI components
│           └── lib/           Client helpers
├── packages/
│   └── shared/       Cross-app types & enums
├── infra/
│   └── docker/
│       ├── docker-compose.yml
│       └── postgres/init.sql
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── .env.example
```

---

## Environment variables

Root `.env` (copied from `.env.example`) is the single source of truth in development; Docker Compose, the API, and the Web app all read from it.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string for Prisma |
| `REDIS_URL` | Redis connection URL |
| `API_PORT` / `API_HOST` | NestJS bind address |
| `WEB_ORIGIN` | CORS allow-origin for the API |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Reserved for Phase 2 (auth) |
| `NEXT_PUBLIC_API_URL` | API base URL the browser calls |
| `NEXT_PUBLIC_APP_NAME` | App name shown in UI |

> The API will refuse to boot if a required variable is missing or invalid — by design.

---

## LiveKit (Phase 6 — self-hosted SFU)

Real audio/video runs through a self-hosted LiveKit server. No LiveKit Cloud, no external SDKs.

### What gets started

`pnpm docker:up` brings up the LiveKit container alongside Postgres and Redis:

| Port | Protocol | Purpose |
|---|---|---|
| 7880 | TCP / WS | Signaling — browser connects here |
| 7881 | TCP | RTC fallback |
| 7882 | UDP | RTC media (preferred) |

Config lives at `infra/docker/livekit/livekit.yaml` and is mounted read-only into the container. The dev key/secret in that file MUST match `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` in your `.env`.

### Environment variables added

| Variable | Purpose |
|---|---|
| `LIVEKIT_API_KEY` | Key name (must match `keys:` block in `livekit.yaml`) |
| `LIVEKIT_API_SECRET` | Matching secret — min 32 chars |
| `LIVEKIT_URL` | WS URL the backend hands to clients |
| `LIVEKIT_TOKEN_TTL_MINUTES` | Token lifetime (default 360 = 6 hours) |
| `NEXT_PUBLIC_LIVEKIT_URL` | Public WS URL — fallback when backend omits it |

### How a meeting reaches LiveKit

1. Browser hits `POST /api/meetings/:slug/livekit-token` with the same auth (bearer for registered, `meetino_guest` cookie for guests) used by `/room` and `/chat`.
2. Backend validates the participant row via `MeetingAuthService`, signs a short-lived JWT with `LIVEKIT_API_SECRET`, and returns `{ token, url, room }`.
3. Browser calls `room.connect(url, token)` from `livekit-client` — no media is published yet.
4. When the user clicks the mic / camera / screen button, `setMicrophoneEnabled(true)` etc. prompts the browser for permission and starts publishing.

The local mic / camera toggles also mirror their state into the Phase 4 WebSocket gateway so other participants see the right chips in the live participant list.

### Production hardening (NOT included in Phase 6)

- Replace the dev key/secret in `livekit.yaml` and `.env`.
- Wrap the WS endpoint in TLS (`wss://`) behind nginx / Caddy.
- Set `use_external_ip: true` and configure `node_ip` to the server's public IP.
- Run a self-hosted **coturn** for TURN relays so users behind strict NAT can connect.

---

## What's next

Phases 1–6 ✅ — Foundations, auth, meetings, realtime presence, chat, video.
Phase 7+ → Host controls (mute / kick), recording, scheduled meetings, multilingual UI.

See the architecture doc for the full roadmap.
