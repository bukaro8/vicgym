import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_TARGET_REPS, DEMO_SETS, demoProgrammeSeed, equipmentSeed, exerciseDbMediaSeed, exerciseSeed, muscleSeed } from "../src/data/phase-2-catalogue";
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
  const [equipment, exercises, muscles, providerMedia, program, sessionCount] = await Promise.all([
    prisma.equipment.findMany({ include: { media: true }, orderBy: { slug: "asc" } }),
    prisma.exercise.findMany({ include: { equipment: true }, orderBy: { slug: "asc" } }),
    prisma.muscle.findMany(),
    prisma.exerciseMedia.findMany({ where: { provider: "ascendapi-exercisedb" } }),
    prisma.workoutProgram.findUnique({ where: { slug: demoProgrammeSeed.slug }, include: { versions: { include: { days: { include: { workoutExercises: { include: { exercise: true } } } } } } } }),
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
  assert.equal(providerMedia.filter((media) => media.kind === "VIDEO").length, exerciseDbMediaSeed.length);
  for (const media of providerMedia.filter((item) => item.kind === "IMAGE")) await stat(path.join(projectRoot, "public", media.storagePath));
  assert.equal(muscles.length, muscleSeed.length);
  assert(program);
  assert.equal(program.isDemo, true);
  assert.equal(program.status, "DEMO");
  assert.equal(program.activeVersionId, null);
  assert.equal(program.activatedAt, null);
  assert.equal(program.notice, demoProgrammeSeed.notice);
  assert.equal(program.versions.length, 1);
  const programmeExercises = program.versions[0].days.flatMap((day) => day.workoutExercises);
  assert.equal(programmeExercises.length, 20);
  assert(programmeExercises.every((item) => item.sets === DEMO_SETS && item.targetReps === DEFAULT_TARGET_REPS && item.plannedWeightKg === null));
  assert(programmeExercises.every((item) => item.loadTrackingTypeSnapshot !== null && item.loadEntryModeSnapshot !== null));
  assert(programmeExercises.every((item) => item.exercise.active));
  assert.equal(sessionCount, 0);

  console.log(`Verified ${equipment.length} equipment, ${expectedPhotos.length} original-photo mappings, ${exercises.length} exercises, ${muscles.length} muscles, and one inactive four-day demo programme.`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
