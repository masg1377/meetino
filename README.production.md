# Meetino — Production Deployment Guide

Deploy a self-hosted video meeting platform on **a single Ubuntu VPS inside Iran**, with no reliance on external cloud services. The stack is the same Next.js / NestJS / PostgreSQL / Redis / LiveKit / coturn / Nginx you used in development — wired up with Docker Compose and TLS.

> All user-facing strings in the app are Persian (RTL). This guide is in English so operators can copy commands literally; rewrite the customer docs in Persian as needed.

---

## 1. Server prerequisites

| Requirement | Recommended |
| --- | --- |
| OS          | Ubuntu 22.04 LTS or 24.04 LTS |
| vCPU        | 4+ (≥ 2 used by LiveKit alone under load) |
| RAM         | 8 GB minimum, 16 GB recommended |
| Disk        | 80 GB SSD (Postgres, Docker images, recordings users save locally don't land on the server, but uploaded files do) |
| Network     | Static public IPv4, 100 Mbps symmetric or better |
| Sudo user   | Yes — never deploy as `root` |

```bash
# After login
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw envsubst
```

Install Docker Engine (the upstream repo, not Ubuntu's `docker.io`):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker --version
docker compose version
```

## 2. DNS setup

Create A records that point at `SERVER_IP`:

| Record               | Type | Value         | Purpose                            |
| -------------------- | ---- | ------------- | ---------------------------------- |
| `meetino.example.com`         | A    | `SERVER_IP`   | Web (Next.js)                      |
| `api.meetino.example.com`     | A    | `SERVER_IP`   | API (NestJS) + Socket.IO realtime  |
| `livekit.meetino.example.com` | A    | `SERVER_IP`   | LiveKit signaling (`wss://`)       |
| `turn.meetino.example.com`    | A    | `SERVER_IP`   | coturn (optional — `turn:` URI)    |

After updating DNS, wait until `dig +short meetino.example.com` returns your `SERVER_IP` before continuing — Certbot's HTTP-01 challenges depend on it.

## 3. Required ports

Open these in UFW (or your hosting provider's firewall). PostgreSQL, Redis, the Next.js port, and the API port stay private inside the Docker network.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                                  # SSH (lock to your IP if possible)
sudo ufw allow 80/tcp                                  # HTTP (Certbot + redirect to HTTPS)
sudo ufw allow 443/tcp                                 # HTTPS (web + API + LiveKit)
sudo ufw allow 3478/tcp                                # coturn STUN/TURN over TCP
sudo ufw allow 3478/udp                                # coturn STUN/TURN over UDP
sudo ufw allow 5349/tcp                                # coturn TURN-TLS (if enabled)
sudo ufw allow 5349/udp                                # coturn TURN-DTLS (if enabled)
sudo ufw allow 49160:49200/udp                         # coturn relay range
sudo ufw allow 50000:60000/udp                         # LiveKit RTC range
sudo ufw enable
```

| Port range            | Service              | Public?       |
| --------------------- | -------------------- | ------------- |
| 22/tcp                | SSH                  | yes (restrict)|
| 80/tcp                | Nginx (ACME, redirect) | yes         |
| 443/tcp               | Nginx (web, API, LiveKit) | yes      |
| 3478/tcp+udp          | coturn STUN/TURN     | yes           |
| 5349/tcp+udp          | coturn TURN-TLS      | optional      |
| 49160-49200/udp       | coturn relay         | yes           |
| 50000-60000/udp       | LiveKit RTC          | yes           |
| 5432, 6379, 7880, 3000, 4000 | Postgres / Redis / LiveKit signaling / web / API | **no** (internal) |

## 4. Clone the project

```bash
git clone https://your-git-host/meetino.git
cd meetino
```

## 5. Create the production env file

```bash
cp .env.production.example .env.production
$EDITOR .env.production
```

You **must** replace at minimum:

| Variable                       | How to generate / pick                                |
| ------------------------------ | ----------------------------------------------------- |
| `DOMAIN` / `API_DOMAIN` / `LIVEKIT_DOMAIN` / `TURN_DOMAIN` | Your subdomains.                |
| `SERVER_IP`                    | Your VPS public IPv4.                                 |
| `SSL_EMAIL`                    | Your admin email (Let's Encrypt expiry alerts).       |
| `POSTGRES_PASSWORD`            | `openssl rand -hex 24` — 48 hex chars.                |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -hex 32` — two **different** values. |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | An `API…` style key (any string) + `openssl rand -hex 32`. **Copy the SAME values into `infra/docker/livekit/livekit.prod.yaml`** under `keys:`. |
| `TURN_SHARED_SECRET`           | `openssl rand -hex 32`. **Copy into `infra/docker/coturn/turnserver.conf` as `static-auth-secret`.** |
| `NEXT_PUBLIC_API_URL`          | `https://${API_DOMAIN}/api`                           |
| `NEXT_PUBLIC_LIVEKIT_URL`      | `wss://${LIVEKIT_DOMAIN}`                             |

> **Never commit `.env.production`.** Only the `.example` file is tracked.

## 6. Customize the per-service configs

```bash
# A: render the nginx vhost configs from the templates
chmod +x scripts/*.sh
./scripts/render-nginx.sh

# B: edit livekit.prod.yaml — replace REPLACE_WITH_VPS_PUBLIC_IP,
#    REPLACE_WITH_TURN_DOMAIN, REPLACE_WITH_TURN_SHARED_SECRET,
#    REPLACE_LIVEKIT_API_KEY/SECRET. Same secret values as .env.production.
$EDITOR infra/docker/livekit/livekit.prod.yaml

# C: edit turnserver.conf — same VPS IP + same TURN shared secret.
$EDITOR infra/docker/coturn/turnserver.conf
```

## 7. First boot

```bash
# Build api + web images. First build is slow (10-15 min); cached after.
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production build

# Bring up infra first so we can issue SSL certs before nginx tries to load them.
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production up -d postgres redis nginx

# Wait until nginx is serving the ACME catch-all on :80
curl -fsS http://${DOMAIN}/.well-known/acme-challenge/test || echo "(404 is fine — nginx is alive)"
```

## 8. Issue SSL certificates

```bash
./scripts/issue-ssl.sh
```

The script asks Let's Encrypt for certs for `DOMAIN`, `API_DOMAIN`, `LIVEKIT_DOMAIN`, and (if set) `TURN_DOMAIN`, then reloads nginx. Re-runs are safe — `--keep-until-expiring` skips active certs.

**Auto-renewal:** add a cron entry on the host to renew weekly:

```bash
sudo crontab -e
# Every Monday at 03:30 (off-peak):
30 3 * * 1 cd /home/<user>/meetino && docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production run --rm --profile ssl certbot renew --quiet && docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production exec nginx nginx -s reload
```

## 9. Run database migrations

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production run --rm \
  --entrypoint sh \
  api -c "cd /app/apps/api && node_modules/.bin/prisma migrate deploy --schema=src/prisma/schema.prisma"
```

## 10. Bring up the app

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production up -d
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production ps
```

Every container should show `Up (healthy)` after ~60 seconds.

## 11. Health checks

```bash
# API liveness (process up)
curl -fsS https://${API_DOMAIN}/api/health/live

# API readiness (DB + Redis ping ok)
curl -fsS https://${API_DOMAIN}/api/health/ready

# Web
curl -I https://${DOMAIN}

# LiveKit (root path returns a tiny banner)
curl -I https://${LIVEKIT_DOMAIN}
```

> **Browser test:** open `https://${DOMAIN}` in two browsers, sign up in one and join the meeting URL from another (guest). Verify mic, camera, screen-share, chat, whiteboard, file sharing, recording, and rejoin approval.

**TURN sanity check** (the WebRTC sample app — open in a non-corp network):

```
https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
```

Add `turn:turn.meetino.example.com:3478` with a username/password generated by your LiveKit instance. You should see a `relay` candidate appear if coturn is reachable.

## 12. Updating the app safely

The repo ships `scripts/deploy.sh` — it backs up Postgres, rebuilds, migrates, restarts API + web, reloads nginx, then smoke-tests:

```bash
./scripts/deploy.sh
```

If a deploy fails after the migration step, roll back like this:

```bash
# 1) Stop api/web
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production stop api web

# 2) Restore the most recent backup
./scripts/restore-postgres.sh infra/docker/backups/meetino_<TIMESTAMP>.dump

# 3) Check out the previous git revision and bring the stack back up
git checkout <previous-sha>
./scripts/deploy.sh   # rebuilds at the previous SHA
```

## 13. Backup & restore

```bash
# Manual backup (deploy.sh runs this automatically too)
./scripts/backup-postgres.sh
# → infra/docker/backups/meetino_2026-05-22_03-14-22.dump

# Restore
./scripts/restore-postgres.sh infra/docker/backups/meetino_2026-05-22_03-14-22.dump
```

**Off-host copies are mandatory.** Pull backups onto a private machine over `rsync`:

```bash
# from your laptop / another server
rsync -avh --delete user@SERVER_IP:/home/user/meetino/infra/docker/backups/ ./meetino-backups/
```

Set a daily cron on the VPS to refresh the local snapshots:

```bash
crontab -e
0 2 * * * cd /home/<user>/meetino && ./scripts/backup-postgres.sh >> /var/log/meetino-backup.log 2>&1
```

## 14. Logs & monitoring

```bash
# All containers, follow
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production logs -f

# Single service
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production logs -f api
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production logs -f livekit

# Nginx access log (volume-mounted)
docker volume inspect meetino_prod_nginx_logs
sudo tail -F /var/lib/docker/volumes/meetino_prod_nginx_logs/_data/access.log

# Docker disk usage
docker system df

# Host disk usage
df -h /var/lib/docker
```

**Restart a service** without disturbing the others:

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production restart api
```

**Force a clean rebuild** of one image:

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production build --no-cache web
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production up -d --no-deps web
```

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | ---- |
| `502 Bad Gateway` from `https://${DOMAIN}` | `web` container down or unhealthy. | `docker compose logs web` |
| `502 Bad Gateway` from `https://${API_DOMAIN}/api/health/ready` | API can't reach Postgres or Redis. | `docker compose ps`; check the env values match. |
| Camera works locally but other people can't see/hear you | LiveKit RTC ports closed in firewall or `node_ip` wrong. | `sudo ufw status`; check `infra/docker/livekit/livekit.prod.yaml` `rtc.node_ip`. |
| Mobile users on cell networks can't connect | TURN unreachable. | `docker compose logs coturn`; verify 3478/UDP allowed and `TURN_SHARED_SECRET` matches LiveKit. |
| `wss://${LIVEKIT_DOMAIN}` returns 502 | nginx can't reach LiveKit on host network. | Confirm `extra_hosts: host.docker.internal:host-gateway` exists on the nginx service. |
| File upload returns 413 | Nginx `client_max_body_size` is below the user's file. | Bump it in `infra/docker/nginx/nginx.conf` AND `MEDIA_MAX_FILE_BYTES` in `.env.production`. |
| `prisma migrate` fails with `P3009` | A prior migration is marked failed. | Inspect with `prisma migrate status`; consider `prisma migrate resolve --rolled-back <name>`. |

## 16. Security checklist (operator)

- [ ] All four secrets in `.env.production` are >= 32 chars and not commitable.
- [ ] Postgres + Redis are **not** published in `ports:` (verified with `docker compose ps`).
- [ ] SSH is restricted to a non-root user; passwords disabled; key-only login.
- [ ] UFW or hosting provider firewall matches §3 exactly.
- [ ] `livekit.prod.yaml` `rtc.node_ip` is the real VPS IP, not the placeholder.
- [ ] `turnserver.conf` `external-ip` and `static-auth-secret` are real.
- [ ] Let's Encrypt renewal cron is installed and tested with `--dry-run` once.
- [ ] Backups are copied off-server at least daily.
- [ ] `LIVEKIT_API_SECRET` and the matching `keys:` entry in the YAML agree exactly.
- [ ] Browser sanity test passes: mic + camera + screen + chat + whiteboard + file share + recording + rejoin.
