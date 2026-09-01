ALTER TABLE "AppSettings"
  ADD COLUMN "activeProgramId" UUID;

CREATE UNIQUE INDEX "AppSettings_activeProgramId_key"
  ON "AppSettings"("activeProgramId");

ALTER TABLE "AppSettings"
  ADD CONSTRAINT "AppSettings_activeProgramId_fkey"
  FOREIGN KEY ("activeProgramId") REFERENCES "WorkoutProgram"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "AppSettings"
SET "activeProgramId" = (
  SELECT "id"
  FROM "WorkoutProgram"
  WHERE "status" = 'ACTIVE'
  ORDER BY "activatedAt" DESC NULLS LAST, "updatedAt" DESC
  LIMIT 1
)
WHERE "id" = 1;
