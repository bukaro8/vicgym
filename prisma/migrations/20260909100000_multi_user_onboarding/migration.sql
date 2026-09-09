CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "OnboardingPath" AS ENUM ('SEMI_PERSONALISED', 'FULLY_PERSONALISED');
CREATE TYPE "TrainingGoal" AS ENUM ('LOSE_FAT', 'BUILD_MUSCLE', 'GENERAL_FITNESS');
CREATE TYPE "TrainingExperience" AS ENUM ('BEGINNER', 'SOME_EXPERIENCE', 'EXPERIENCED');
CREATE TYPE "CardioPreference" AS ENUM ('MINIMAL', 'SOME', 'ENJOYS_CARDIO');
CREATE TYPE "LimitationArea" AS ENUM ('UPPER_BODY', 'LOWER_BODY', 'BACK', 'CORE', 'OTHER');
CREATE TYPE "ProgrammeRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

ALTER TYPE "ProgramVersionSource" ADD VALUE 'GENERATED';

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

CREATE TABLE "OnboardingProfile" (
  "userId" UUID NOT NULL,
  "path" "OnboardingPath" NOT NULL,
  "goal" "TrainingGoal",
  "trainingDaysPerWeek" INTEGER,
  "experience" "TrainingExperience",
  "sessionLengthMinutes" INTEGER,
  "cardioPreference" "CardioPreference",
  "hasLimitations" BOOLEAN NOT NULL DEFAULT false,
  "limitationAreas" "LimitationArea"[] NOT NULL,
  "limitationsText" TEXT,
  "limitationReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "recommendedCardioMinutes" INTEGER,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ProgrammeRequest" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "status" "ProgrammeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "adminNotes" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgrammeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgrammeRequest_userId_status_createdAt_idx"
  ON "ProgrammeRequest"("userId", "status", "createdAt");

CREATE UNIQUE INDEX "ProgrammeRequest_one_pending_per_user"
  ON "ProgrammeRequest"("userId")
  WHERE "status" = 'PENDING';

ALTER TABLE "OnboardingProfile"
  ADD CONSTRAINT "OnboardingProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgrammeRequest"
  ADD CONSTRAINT "ProgrammeRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
