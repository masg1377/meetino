-- Meetino — Postgres init script. Runs once when the data volume is empty.
-- Extensions we'll rely on across phases:
--   uuid-ossp: UUID generation (Prisma uses @default(uuid()) but extensions are handy for raw SQL).
--   citext:    case-insensitive text — useful for emails in Phase 2.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Make sure the configured DB has the right default privileges.
ALTER DATABASE meetino SET timezone TO 'UTC';
