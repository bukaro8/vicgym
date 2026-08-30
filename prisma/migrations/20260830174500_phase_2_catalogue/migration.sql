-- Phase 2 catalogue and explicit programme activation metadata.
ALTER TABLE "WorkoutProgram"
  ADD COLUMN "notice" TEXT,
  ADD COLUMN "activatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ExerciseMedia_equipmentId_sourceFilename_key"
  ON "ExerciseMedia"("equipmentId", "sourceFilename");
