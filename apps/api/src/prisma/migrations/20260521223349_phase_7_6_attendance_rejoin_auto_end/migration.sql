-- CreateEnum
CREATE TYPE "RejoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "meeting_participants" ADD COLUMN     "last_joined_at" TIMESTAMPTZ(6),
ADD COLUMN     "total_duration_seconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "duration_seconds" INTEGER,
ADD COLUMN     "last_activity_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "rejoin_requests" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "status" "RejoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(280),
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rejoin_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rejoin_requests_meeting_id_status_idx" ON "rejoin_requests"("meeting_id", "status");

-- CreateIndex
CREATE INDEX "rejoin_requests_participant_id_status_idx" ON "rejoin_requests"("participant_id", "status");

-- CreateIndex
CREATE INDEX "meetings_status_last_activity_at_idx" ON "meetings"("status", "last_activity_at");

-- AddForeignKey
ALTER TABLE "rejoin_requests" ADD CONSTRAINT "rejoin_requests_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejoin_requests" ADD CONSTRAINT "rejoin_requests_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "meeting_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejoin_requests" ADD CONSTRAINT "rejoin_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
