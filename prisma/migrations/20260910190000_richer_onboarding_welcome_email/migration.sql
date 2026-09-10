CREATE TYPE "OutsideGymActivity" AS ENUM ('LOW', 'MODERATE', 'HIGH');

ALTER TABLE "OnboardingProfile"
  ADD COLUMN "age" INTEGER,
  ADD COLUMN "heightCm" INTEGER,
  ADD COLUMN "weightKg" DECIMAL(6,2),
  ADD COLUMN "outsideGymActivity" "OutsideGymActivity",
  ADD COLUMN "averageDailySteps" INTEGER;

ALTER TABLE "ProgrammeRequest"
  ADD COLUMN "welcomeEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "welcomeEmailBody" TEXT;

ALTER TABLE "WorkoutProgram"
  ADD COLUMN "programmeRequestId" UUID;

CREATE UNIQUE INDEX "WorkoutProgram_programmeRequestId_key" ON "WorkoutProgram"("programmeRequestId");

ALTER TABLE "WorkoutProgram"
  ADD CONSTRAINT "WorkoutProgram_programmeRequestId_fkey"
  FOREIGN KEY ("programmeRequestId") REFERENCES "ProgrammeRequest"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
