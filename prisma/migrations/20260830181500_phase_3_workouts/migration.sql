ALTER TABLE "RestPeriod" ADD COLUMN "pausedRemainingMs" INTEGER;

CREATE UNIQUE INDEX "WorkoutSession_single_in_progress"
ON "WorkoutSession" ((true))
WHERE "status" = 'IN_PROGRESS';

CREATE UNIQUE INDEX "RestPeriod_single_active"
ON "RestPeriod" ((true))
WHERE "status" IN ('RUNNING', 'PAUSED');
