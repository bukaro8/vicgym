-- Preserve provenance for explicitly imported exercise media and provider-hosted videos.
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "ExerciseMedia"
  ADD COLUMN "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'vicgym',
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "attribution" TEXT;

CREATE UNIQUE INDEX "ExerciseMedia_exerciseId_provider_externalId_kind_key"
  ON "ExerciseMedia"("exerciseId", "provider", "externalId", "kind");
