#!/usr/bin/env node
/**
 * sync-env.cjs
 * Copies the repo-root .env into apps/api/.env so the Prisma CLI (and any
 * other tool that reads .env from cwd) can find DATABASE_URL.
 *
 * Runs automatically before every `prisma:*` script. Idempotent and safe to
 * re-run. Pure Node, no dependencies, no PATH magic.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT_ENV = path.resolve(__dirname, '..', '..', '..', '.env');
const LOCAL_ENV = path.resolve(__dirname, '..', '.env');

if (!fs.existsSync(ROOT_ENV)) {
  console.error(`[env:sync] Root .env not found at ${ROOT_ENV}`);
  console.error('[env:sync] Run `cp .env.example .env` from the repo root first.');
  process.exit(1);
}

const rootContent = fs.readFileSync(ROOT_ENV, 'utf8');
let needsWrite = true;
if (fs.existsSync(LOCAL_ENV)) {
  const localContent = fs.readFileSync(LOCAL_ENV, 'utf8');
  if (localContent === rootContent) {
    needsWrite = false;
  }
}

if (needsWrite) {
  fs.writeFileSync(LOCAL_ENV, rootContent);
  console.log('[env:sync] Synced root .env  →  apps/api/.env');
} else {
  console.log('[env:sync] apps/api/.env already up to date');
}
