ALTER TABLE "ProgrammeRequest"
  ADD COLUMN "submittedNotificationSentAt" TIMESTAMP(3),
  ADD COLUMN "completedNotificationSentAt" TIMESTAMP(3);
