# Meetino — Operator scripts

| Script                       | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `deploy.sh`                  | Safe redeploy: pull → backup → build → migrate → restart → smoke test.  |
| `backup-postgres.sh`         | Timestamped `pg_dump --format=custom` into `infra/docker/backups/`.     |
| `restore-postgres.sh <file>` | DROP + CREATE + `pg_restore`. **Destructive.**                          |
| `issue-ssl.sh`               | First-time Let's Encrypt cert issuance for all three vhosts.            |
| `render-nginx.sh`            | Expand `*.conf.template` → `*.conf` using values from `.env.production`. |

Run from the repo root. All scripts require `.env.production` to exist
(copy from `.env.production.example` and fill in real values).

```bash
# After cloning on the VPS:
cp .env.production.example .env.production
$EDITOR .env.production
chmod +x scripts/*.sh
./scripts/render-nginx.sh
./scripts/issue-ssl.sh
./scripts/deploy.sh
```

Backups are kept locally at `infra/docker/backups/` by default. Copy
them off-server (rsync to a private machine) — never trust a single
host with your only copy.
