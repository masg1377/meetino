-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "participant_id" UUID,
    "sender_display_name" VARCHAR(120) NOT NULL,
    "sender_role" "ParticipantRole" NOT NULL,
    "sender_type" "ParticipantType" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_meeting_id_created_at_idx" ON "chat_messages"("meeting_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_participant_id_idx" ON "chat_messages"("participant_id");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "meeting_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
