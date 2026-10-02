-- Students now pick the exact meeting time, and answer a survey question
-- about whether their teacher helped first.

-- AlterTable
ALTER TABLE "TutoringRequest"
  ADD COLUMN "meetingStart" TIMESTAMP(3),
  ADD COLUMN "meetingEnd" TIMESTAMP(3),
  ADD COLUMN "receivedTeacherHelp" BOOLEAN;

-- Backfill any requests created before this change.
UPDATE "TutoringRequest"
SET "meetingStart" = "createdAt",
    "meetingEnd" = "createdAt" + INTERVAL '1 hour';

ALTER TABLE "TutoringRequest"
  ALTER COLUMN "meetingStart" SET NOT NULL,
  ALTER COLUMN "meetingEnd" SET NOT NULL,
  DROP COLUMN "availability";
