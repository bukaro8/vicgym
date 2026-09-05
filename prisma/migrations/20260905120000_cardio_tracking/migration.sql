ALTER TABLE "WorkoutSession"
  ADD COLUMN "cardioPlanned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cardioStartedAt" TIMESTAMP(3),
  ADD COLUMN "cardioStoppedAt" TIMESTAMP(3),
  ADD COLUMN "cardioDurationSeconds" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WorkoutSession"
  ADD CONSTRAINT "WorkoutSession_cardio_duration_check"
  CHECK (
    "cardioDurationSeconds" >= 0
    AND ("cardioStoppedAt" IS NULL OR "cardioStartedAt" IS NOT NULL)
    AND ("cardioStoppedAt" IS NULL OR "cardioStoppedAt" >= "cardioStartedAt")
  );
