-- CreateTable
CREATE TABLE "whiteboard_snapshots" (
    "meeting_id" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whiteboard_snapshots_pkey" PRIMARY KEY ("meeting_id")
);

-- CreateTable
CREATE TABLE "meeting_files" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "uploaded_by_participant_id" UUID,
    "uploaded_by_display_name" VARCHAR(120) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "stored_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_files_stored_name_key" ON "meeting_files"("stored_name");

-- CreateIndex
CREATE INDEX "meeting_files_meeting_id_created_at_idx" ON "meeting_files"("meeting_id", "created_at");

-- AddForeignKey
ALTER TABLE "whiteboard_snapshots" ADD CONSTRAINT "whiteboard_snapshots_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_files" ADD CONSTRAINT "meeting_files_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_files" ADD CONSTRAINT "meeting_files_uploaded_by_participant_id_fkey" FOREIGN KEY ("uploaded_by_participant_id") REFERENCES "meeting_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
