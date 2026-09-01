import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { getExerciseDbExercise, preferredExerciseDbImage, EXERCISEDB_PROVIDER } from "../src/lib/exercisedb-core";
import { getPrisma } from "../src/lib/prisma";

const importableExerciseSlugs = new Set([
  "bodyweight-squat", "dumbbell-biceps-curl", "dumbbell-lateral-raise", "dumbbell-romanian-deadlift", "glute-bridge", "goblet-squat", "one-arm-dumbbell-row", "push-up", "reverse-lunge", "standing-dumbbell-shoulder-press", "step-up", "hip-raises", "calf-raises", "plank", "lying-leg-raises",
]);
const projectRoot = path.resolve(import.meta.dirname, "..");

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function downloadImage(url: string) {
  const response = await fetch(url, { headers: { Accept: "image/avif,image/webp,image/*" } });
  if (!response.ok) throw new Error(`ExerciseDB image download failed (${response.status}).`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) throw new Error("ExerciseDB media URL did not return an image.");
  return Buffer.from(await response.arrayBuffer());
}

async function writeDerivatives(exerciseSlug: string, externalExerciseId: string, source: Buffer) {
  const directory = path.join(projectRoot, "public", "media", "exercises", exerciseSlug);
  const stem = `exercisedb-${safeFilePart(externalExerciseId)}`;
  await mkdir(directory, { recursive: true });
  await Promise.all([640, 1280].flatMap((width) => [
    sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(path.join(directory, `${stem}-${width}.webp`)),
    sharp(source).rotate().resize({ width, withoutEnlargement: true }).avif({ quality: 58, effort: 5 }).toFile(path.join(directory, `${stem}-${width}.avif`)),
  ]));
  return { storagePath: `/media/exercises/${exerciseSlug}/${stem}-1280.webp`, sourceFilename: `${stem}-source` };
}

async function main() {
  const [exerciseSlug, externalExerciseId] = process.argv.slice(2);
  if (!exerciseSlug || !externalExerciseId) throw new Error("Usage: npm run exercise-media:import -- <vicgym-exercise-slug> <exercisedb-exercise-id>");
  if (!importableExerciseSlugs.has(exerciseSlug)) throw new Error("This import is limited to the current placeholder exercise list.");

  const prisma = getPrisma();
  const exercise = await prisma.exercise.findUnique({ where: { slug: exerciseSlug }, include: { equipment: true } });
  if (!exercise || !exercise.active) throw new Error("VicGym exercise was not found or is unavailable.");
  if (exercise.equipment?.type === "MACHINE") throw new Error("Machine photographs are verified VicGym media and are not replaced by this importer.");

  const external = await getExerciseDbExercise(externalExerciseId);
  const imageUrl = preferredExerciseDbImage(external);
  if (!imageUrl) throw new Error("The selected ExerciseDB record has no importable image.");
  const stored = await writeDerivatives(exercise.slug, external.exerciseId, await downloadImage(imageUrl));
  const altText = `${external.name} movement demonstration supplied by ExerciseDB`;
  const attribution = "ExerciseDB media via AscendAPI/RapidAPI. Provider licence and plan terms apply; Basic-plan media may be watermarked.";

  await prisma.$transaction(async (transaction) => {
    await transaction.exerciseMedia.upsert({
      where: { exerciseId_provider_externalId_kind: { exerciseId: exercise.id, provider: EXERCISEDB_PROVIDER, externalId: external.exerciseId, kind: "IMAGE" } },
      create: { exerciseId: exercise.id, role: "PRIMARY", kind: "IMAGE", storagePath: stored.storagePath, sourceFilename: stored.sourceFilename, altText, provider: EXERCISEDB_PROVIDER, externalId: external.exerciseId, sourceUrl: imageUrl, attribution, sortOrder: 0 },
      update: { role: "PRIMARY", storagePath: stored.storagePath, sourceFilename: stored.sourceFilename, altText, sourceUrl: imageUrl, attribution, sortOrder: 0 },
    });
    if (external.videoUrl) {
      await transaction.exerciseMedia.upsert({
        where: { exerciseId_provider_externalId_kind: { exerciseId: exercise.id, provider: EXERCISEDB_PROVIDER, externalId: external.exerciseId, kind: "VIDEO" } },
        create: { exerciseId: exercise.id, role: "REFERENCE", kind: "VIDEO", storagePath: external.videoUrl, sourceFilename: `${safeFilePart(external.exerciseId)}-video`, altText: `${external.name} movement video`, provider: EXERCISEDB_PROVIDER, externalId: external.exerciseId, sourceUrl: external.videoUrl, attribution, sortOrder: 0 },
        update: { sourceUrl: external.videoUrl, storagePath: external.videoUrl, altText: `${external.name} movement video`, attribution },
      });
    }
  });
  console.log(`Imported ExerciseDB image for ${exercise.slug} from ${external.exerciseId}.${external.videoUrl ? " Provider video reference saved." : ""}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "ExerciseDB media import failed.");
  process.exitCode = 1;
});
