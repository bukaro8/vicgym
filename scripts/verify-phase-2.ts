import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_TARGET_REPS, equipmentSeed, exerciseDbMediaSeed, exerciseSeed, muscleSeed } from "../src/data/phase-2-catalogue";
import { getPrisma } from "../src/lib/prisma";

async function main() {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const manifestPath = path.join(projectRoot, "public/media/equipment/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { items: Array<{ equipmentSlug: string; originalFilename: string; originalSha256: string; derivatives: string[] }> };
  const expectedPhotos = equipmentSeed.flatMap((equipment) => equipment.photos.map((photo) => ({ equipmentSlug: equipment.slug, filename: photo.filename })));
  const equipmentItems = manifest.items.filter((item) => !item.equipmentSlug.startsWith("exercise:"));
  assert.equal(equipmentItems.length, expectedPhotos.length);

  for (const item of equipmentItems) {
    assert(expectedPhotos.some((expected) => expected.equipmentSlug === item.equipmentSlug && expected.filename === item.originalFilename));
    const original = await readFile(path.join(projectRoot, "gym-pictures", item.originalFilename));
    assert.equal(createHash("sha256").update(original).digest("hex"), item.originalSha256);
    assert.equal(item.derivatives.length, 4);
    for (const derivative of item.derivatives) await stat(path.join(projectRoot, "public", derivative));
  }

  const prisma = getPrisma();
  const [equipment, exercises, muscles, providerMedia, programCount, sessionCount] = await Promise.all([
    prisma.equipment.findMany({ include: { media: true }, orderBy: { slug: "asc" } }),
    prisma.exercise.findMany({ include: { equipment: true }, orderBy: { slug: "asc" } }),
    prisma.muscle.findMany(),
    prisma.exerciseMedia.findMany({ where: { provider: "ascendapi-exercisedb" } }),
    prisma.workoutProgram.count(),
    prisma.workoutSession.count(),
  ]);

  assert.deepEqual(equipment.map((item) => item.slug).sort(), equipmentSeed.map((item) => item.slug).sort());
  assert.equal(equipment.flatMap((item) => item.media).length, expectedPhotos.length);
  assert.deepEqual(exercises.map((item) => item.slug).sort(), exerciseSeed.map((item) => item.slug).sort());
  assert(exercises.every((exercise) => exercise.defaultTargetReps === DEFAULT_TARGET_REPS && exercise.active));
  assert(exercises.every((exercise) => exercise.equipmentId === null || exercise.equipment?.available));
  assert(exercises.filter((exercise) => exercise.loadEntryMode === "STACK_TOTAL").every((exercise) => exercise.loadTrackingType === "MACHINE_LEVEL"));
  assert(exercises.filter((exercise) => exercise.loadEntryMode === "PER_DUMBBELL" || exercise.loadEntryMode === "TOTAL_LOAD").every((exercise) => exercise.loadTrackingType === "KILOGRAM"));
  assert.equal(providerMedia.filter((media) => media.kind === "IMAGE").length, exerciseDbMediaSeed.length);
  assert.equal(providerMedia.filter((media) => media.kind === "VIDEO").length, exerciseDbMediaSeed.filter((media) => media.videoUrl).length);
  for (const media of providerMedia.filter((item) => item.kind === "IMAGE")) await stat(path.join(projectRoot, "public", media.storagePath));
  assert.equal(muscles.length, muscleSeed.length);
  assert.equal(programCount, 0, "Catalogue seeding must not create personal programmes");
  assert.equal(sessionCount, 0);

  console.log(`Verified ${equipment.length} shared equipment records, ${expectedPhotos.length} original-photo mappings, ${exercises.length} shared exercises, ${muscles.length} shared muscles, and no personal seed data.`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
