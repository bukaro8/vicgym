CREATE TYPE "LoadTrackingType" AS ENUM ('KILOGRAM', 'MACHINE_LEVEL', 'BODYWEIGHT', 'REPS_ONLY');

ALTER TABLE "Exercise"
ADD COLUMN "loadTrackingType" "LoadTrackingType" NOT NULL DEFAULT 'KILOGRAM';

UPDATE "Exercise"
SET "loadTrackingType" = CASE
  WHEN "loadEntryMode" = 'STACK_TOTAL' THEN 'MACHINE_LEVEL'::"LoadTrackingType"
  WHEN "loadEntryMode" = 'BODYWEIGHT' THEN 'BODYWEIGHT'::"LoadTrackingType"
  WHEN "loadEntryMode" = 'NONE' THEN 'REPS_ONLY'::"LoadTrackingType"
  ELSE 'KILOGRAM'::"LoadTrackingType"
END;

ALTER TABLE "WorkoutExercise"
ADD COLUMN "plannedLoadValue" DECIMAL(7,2),
ADD COLUMN "loadTrackingTypeSnapshot" "LoadTrackingType",
ADD COLUMN "loadEntryModeSnapshot" "LoadEntryMode";

ALTER TABLE "ExerciseSession"
ADD COLUMN "loadTrackingTypeSnapshot" "LoadTrackingType",
ADD COLUMN "loadEntryModeSnapshot" "LoadEntryMode",
ADD COLUMN "loadMultiplierSnapshot" DECIMAL(6,3);

ALTER TABLE "SetLog"
ADD COLUMN "loadValue" DECIMAL(7,2),
ADD COLUMN "loadTrackingType" "LoadTrackingType";

-- Blank historical plans contain no numeric value to reinterpret, so they can
-- safely snapshot the catalogue semantics. Any plan with legacy weightKg stays
-- explicitly unsnapshotted and continues through the legacy path.
UPDATE "WorkoutExercise" AS planned
SET "loadTrackingTypeSnapshot" = exercise."loadTrackingType",
    "loadEntryModeSnapshot" = exercise."loadEntryMode"
FROM "Exercise" AS exercise
WHERE planned."exerciseId" = exercise."id"
  AND planned."plannedWeightKg" IS NULL;

ALTER TABLE "WorkoutExercise"
ADD CONSTRAINT "WorkoutExercise_load_columns_check"
CHECK (NOT ("plannedWeightKg" IS NOT NULL AND "plannedLoadValue" IS NOT NULL)),
ADD CONSTRAINT "WorkoutExercise_machine_level_integer_check"
CHECK ("loadTrackingTypeSnapshot" <> 'MACHINE_LEVEL' OR "plannedLoadValue" IS NULL OR "plannedLoadValue" = trunc("plannedLoadValue")),
ADD CONSTRAINT "WorkoutExercise_non_external_load_check"
CHECK ("loadTrackingTypeSnapshot" NOT IN ('BODYWEIGHT', 'REPS_ONLY') OR "plannedLoadValue" IS NULL);

ALTER TABLE "SetLog"
ADD CONSTRAINT "SetLog_load_columns_check"
CHECK (NOT ("weightKg" IS NOT NULL AND "loadValue" IS NOT NULL)),
ADD CONSTRAINT "SetLog_machine_level_integer_check"
CHECK ("loadTrackingType" <> 'MACHINE_LEVEL' OR "loadValue" IS NULL OR "loadValue" = trunc("loadValue")),
ADD CONSTRAINT "SetLog_non_external_load_check"
CHECK ("loadTrackingType" NOT IN ('BODYWEIGHT', 'REPS_ONLY') OR "loadValue" IS NULL);
