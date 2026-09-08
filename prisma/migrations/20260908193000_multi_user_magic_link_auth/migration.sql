-- VicGym is intentionally discarding the former single-owner personal data.
-- The shared exercise/equipment/muscle/media catalogue is left untouched.
TRUNCATE TABLE
  "RestPeriod", "SetLog", "ExerciseSession", "WorkoutSession",
  "WorkoutExercise", "WorkoutDay", "ProgramVersion", "AppSettings",
  "WorkoutProgram", "ClientMutation"
CASCADE;

DROP TABLE "AppSettings";
DROP TABLE "ClientMutation";

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MagicLinkToken" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkoutProgram" ADD COLUMN "userId" UUID NOT NULL;
ALTER TABLE "WorkoutSession" ADD COLUMN "userId" UUID NOT NULL;

CREATE TABLE "AppSettings" (
  "userId" UUID NOT NULL,
  "activeProgramId" UUID,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
  "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG',
  "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
  "vibrationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ClientMutation" (
  "userId" UUID NOT NULL,
  "id" UUID NOT NULL,
  "status" "ClientMutationStatus" NOT NULL DEFAULT 'PENDING',
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "payloadHash" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientMutation_pkey" PRIMARY KEY ("userId", "id")
);

DROP INDEX "WorkoutProgram_slug_key";
DROP INDEX "WorkoutSession_status_startedAt_idx";
DROP INDEX IF EXISTS "WorkoutSession_single_in_progress";
DROP INDEX IF EXISTS "RestPeriod_single_active";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "MagicLinkToken_tokenHash_key" ON "MagicLinkToken"("tokenHash");
CREATE INDEX "MagicLinkToken_email_createdAt_idx" ON "MagicLinkToken"("email", "createdAt");
CREATE INDEX "MagicLinkToken_expiresAt_idx" ON "MagicLinkToken"("expiresAt");
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE UNIQUE INDEX "WorkoutProgram_userId_slug_key" ON "WorkoutProgram"("userId", "slug");
CREATE INDEX "WorkoutProgram_userId_status_idx" ON "WorkoutProgram"("userId", "status");
CREATE INDEX "WorkoutSession_userId_status_startedAt_idx" ON "WorkoutSession"("userId", "status", "startedAt");
CREATE UNIQUE INDEX "WorkoutSession_one_active_per_user" ON "WorkoutSession"("userId") WHERE "status" = 'IN_PROGRESS';
CREATE UNIQUE INDEX "AppSettings_activeProgramId_key" ON "AppSettings"("activeProgramId");
CREATE INDEX "ClientMutation_userId_status_createdAt_idx" ON "ClientMutation"("userId", "status", "createdAt");

ALTER TABLE "WorkoutProgram" ADD CONSTRAINT "WorkoutProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_activeProgramId_fkey" FOREIGN KEY ("activeProgramId") REFERENCES "WorkoutProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientMutation" ADD CONSTRAINT "ClientMutation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
