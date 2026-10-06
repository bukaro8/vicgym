CREATE TYPE "SetEffort" AS ENUM ('EASY', 'MODERATE', 'HARD');
ALTER TABLE "SetLog" ADD COLUMN "effort" "SetEffort";
