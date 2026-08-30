-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('KG');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('MACHINE', 'DUMBBELL', 'BARBELL', 'BODYWEIGHT', 'CARDIO', 'STEP');

-- CreateEnum
CREATE TYPE "RepMode" AS ENUM ('TOTAL', 'PER_SIDE');

-- CreateEnum
CREATE TYPE "LoadEntryMode" AS ENUM ('STACK_TOTAL', 'TOTAL_LOAD', 'PER_DUMBBELL', 'BODYWEIGHT', 'NONE');

-- CreateEnum
CREATE TYPE "MuscleRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "MediaRole" AS ENUM ('PRIMARY', 'REFERENCE');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'DEMO');

-- CreateEnum
CREATE TYPE "ProgramVersionSource" AS ENUM ('SEED', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "RestPeriodStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ClientMutationStatus" AS ENUM ('PENDING', 'APPLIED', 'FAILED');

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG',
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vibrationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EquipmentType" NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentId" UUID,
    "defaultTargetReps" INTEGER NOT NULL DEFAULT 12,
    "techniqueUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "repMode" "RepMode" NOT NULL DEFAULT 'TOTAL',
    "loadEntryMode" "LoadEntryMode" NOT NULL DEFAULT 'STACK_TOTAL',
    "loadMultiplier" DECIMAL(6,3) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Muscle" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Muscle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseMuscle" (
    "exerciseId" UUID NOT NULL,
    "muscleId" UUID NOT NULL,
    "role" "MuscleRole" NOT NULL,

    CONSTRAINT "ExerciseMuscle_pkey" PRIMARY KEY ("exerciseId","muscleId")
);

-- CreateTable
CREATE TABLE "ExerciseMedia" (
    "id" UUID NOT NULL,
    "exerciseId" UUID,
    "equipmentId" UUID,
    "role" "MediaRole" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutProgram" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "activeVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramVersion" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "source" "ProgramVersionSource" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutDay" (
    "id" UUID NOT NULL,
    "programVersionId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rotationOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" UUID NOT NULL,
    "workoutDayId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "targetReps" INTEGER NOT NULL DEFAULT 12,
    "plannedWeightKg" DECIMAL(7,2),
    "restSeconds" INTEGER NOT NULL,
    "autoRest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" UUID NOT NULL,
    "programVersionId" UUID NOT NULL,
    "workoutDayId" UUID NOT NULL,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "workoutDayNameSnapshot" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSession" (
    "id" UUID NOT NULL,
    "workoutSessionId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "exerciseNameSnapshot" TEXT NOT NULL,
    "plannedSets" INTEGER NOT NULL,
    "targetReps" INTEGER NOT NULL DEFAULT 12,
    "restSeconds" INTEGER NOT NULL,
    "autoRest" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" UUID NOT NULL,
    "exerciseSessionId" UUID NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "targetReps" INTEGER NOT NULL DEFAULT 12,
    "actualReps" INTEGER,
    "weightKg" DECIMAL(7,2),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestPeriod" (
    "id" UUID NOT NULL,
    "setLogId" UUID NOT NULL,
    "status" "RestPeriodStatus" NOT NULL,
    "configuredSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedRemainingSeconds" INTEGER,
    "accumulatedPausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "adjustments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMutation" (
    "id" UUID NOT NULL,
    "status" "ClientMutationStatus" NOT NULL DEFAULT 'PENDING',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMutation_pkey" PRIMARY KEY ("id")
);

-- Single-owner and basic domain invariants that Prisma cannot express.
ALTER TABLE "AppSettings"
  ADD CONSTRAINT "AppSettings_singleton_check" CHECK ("id" = 1);

ALTER TABLE "Exercise"
  ADD CONSTRAINT "Exercise_defaultTargetReps_check" CHECK ("defaultTargetReps" > 0),
  ADD CONSTRAINT "Exercise_loadMultiplier_check" CHECK ("loadMultiplier" > 0);

ALTER TABLE "ExerciseMedia"
  ADD CONSTRAINT "ExerciseMedia_owner_check" CHECK ("exerciseId" IS NOT NULL OR "equipmentId" IS NOT NULL),
  ADD CONSTRAINT "ExerciseMedia_sortOrder_check" CHECK ("sortOrder" >= 0);

ALTER TABLE "ProgramVersion"
  ADD CONSTRAINT "ProgramVersion_versionNumber_check" CHECK ("versionNumber" > 0);

ALTER TABLE "WorkoutDay"
  ADD CONSTRAINT "WorkoutDay_rotationOrder_check" CHECK ("rotationOrder" > 0);

ALTER TABLE "WorkoutExercise"
  ADD CONSTRAINT "WorkoutExercise_values_check" CHECK (
    "position" > 0 AND "sets" > 0 AND "targetReps" > 0 AND "restSeconds" >= 0
  );

ALTER TABLE "ExerciseSession"
  ADD CONSTRAINT "ExerciseSession_values_check" CHECK (
    "position" > 0 AND "plannedSets" > 0 AND "targetReps" > 0 AND "restSeconds" >= 0
  );

ALTER TABLE "SetLog"
  ADD CONSTRAINT "SetLog_values_check" CHECK (
    "setNumber" > 0 AND "targetReps" > 0 AND ("actualReps" IS NULL OR "actualReps" >= 0)
  );

ALTER TABLE "RestPeriod"
  ADD CONSTRAINT "RestPeriod_values_check" CHECK (
    "configuredSeconds" >= 0
    AND ("pausedRemainingSeconds" IS NULL OR "pausedRemainingSeconds" >= 0)
    AND "accumulatedPausedSeconds" >= 0
  );

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_slug_key" ON "Equipment"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

-- CreateIndex
CREATE INDEX "Exercise_equipmentId_idx" ON "Exercise"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Muscle_slug_key" ON "Muscle"("slug");

-- CreateIndex
CREATE INDEX "ExerciseMuscle_muscleId_role_idx" ON "ExerciseMuscle"("muscleId", "role");

-- CreateIndex
CREATE INDEX "ExerciseMedia_exerciseId_role_sortOrder_idx" ON "ExerciseMedia"("exerciseId", "role", "sortOrder");

-- CreateIndex
CREATE INDEX "ExerciseMedia_equipmentId_role_sortOrder_idx" ON "ExerciseMedia"("equipmentId", "role", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutProgram_slug_key" ON "WorkoutProgram"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutProgram_activeVersionId_key" ON "WorkoutProgram"("activeVersionId");

-- CreateIndex
CREATE INDEX "ProgramVersion_programId_createdAt_idx" ON "ProgramVersion"("programId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramVersion_programId_versionNumber_key" ON "ProgramVersion"("programId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutDay_programVersionId_slug_key" ON "WorkoutDay"("programVersionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutDay_programVersionId_rotationOrder_key" ON "WorkoutDay"("programVersionId", "rotationOrder");

-- CreateIndex
CREATE INDEX "WorkoutExercise_exerciseId_idx" ON "WorkoutExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_workoutDayId_position_key" ON "WorkoutExercise"("workoutDayId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_workoutDayId_exerciseId_key" ON "WorkoutExercise"("workoutDayId", "exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutSession_status_startedAt_idx" ON "WorkoutSession"("status", "startedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_programVersionId_idx" ON "WorkoutSession"("programVersionId");

-- CreateIndex
CREATE INDEX "WorkoutSession_workoutDayId_idx" ON "WorkoutSession"("workoutDayId");

-- CreateIndex
CREATE INDEX "ExerciseSession_exerciseId_createdAt_idx" ON "ExerciseSession"("exerciseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseSession_workoutSessionId_position_key" ON "ExerciseSession"("workoutSessionId", "position");

-- CreateIndex
CREATE INDEX "SetLog_completedAt_idx" ON "SetLog"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_exerciseSessionId_setNumber_key" ON "SetLog"("exerciseSessionId", "setNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RestPeriod_setLogId_key" ON "RestPeriod"("setLogId");

-- CreateIndex
CREATE INDEX "RestPeriod_status_endsAt_idx" ON "RestPeriod"("status", "endsAt");

-- CreateIndex
CREATE INDEX "ClientMutation_status_createdAt_idx" ON "ClientMutation"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_muscleId_fkey" FOREIGN KEY ("muscleId") REFERENCES "Muscle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMedia" ADD CONSTRAINT "ExerciseMedia_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMedia" ADD CONSTRAINT "ExerciseMedia_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgram" ADD CONSTRAINT "WorkoutProgram_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "ProgramVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramVersion" ADD CONSTRAINT "ProgramVersion_programId_fkey" FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutDay" ADD CONSTRAINT "WorkoutDay_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSession" ADD CONSTRAINT "ExerciseSession_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSession" ADD CONSTRAINT "ExerciseSession_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_exerciseSessionId_fkey" FOREIGN KEY ("exerciseSessionId") REFERENCES "ExerciseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestPeriod" ADD CONSTRAINT "RestPeriod_setLogId_fkey" FOREIGN KEY ("setLogId") REFERENCES "SetLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
