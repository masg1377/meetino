-- AlterTable
ALTER TABLE "meeting_participants" ADD COLUMN     "kicked_at" TIMESTAMPTZ(6),
ADD COLUMN     "kicked_by_id" UUID;

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "ended_by_id" UUID,
ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_hash" TEXT;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_kicked_by_id_fkey" FOREIGN KEY ("kicked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
