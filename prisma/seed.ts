import {
  MediaRole,
  MuscleRole,
  ProgramStatus,
  ProgramVersionSource,
} from "../src/generated/prisma/enums";
import { DEFAULT_TARGET_REPS, DEMO_SETS, demoProgrammeSeed, equipmentSeed, exerciseSeed, localExerciseMediaSeed, localExerciseMediaStem, mediaStem, muscleSeed } from "../src/data/phase-2-catalogue";
import { getPrisma } from "../src/lib/prisma";

const prisma = getPrisma();

async function main() {
const equipmentIds = new Map<string, string>();
const muscleIds = new Map<string, string>();
const exerciseIds = new Map<string, string>();

await prisma.appSettings.upsert({
  where: { id: 1 },
  create: { id: 1 },
  update: {},
});

for (const item of equipmentSeed) {
  const equipment = await prisma.equipment.upsert({
    where: { slug: item.slug },
    create: {
      slug: item.slug,
      name: item.name,
      type: item.type,
      notes: item.notes,
      available: true,
    },
    update: {
      name: item.name,
      type: item.type,
      notes: item.notes,
      available: true,
    },
  });
  equipmentIds.set(item.slug, equipment.id);

  for (const [sortOrder, photo] of item.photos.entries()) {
    await prisma.exerciseMedia.upsert({
      where: {
        equipmentId_sourceFilename: {
          equipmentId: equipment.id,
          sourceFilename: photo.filename,
        },
      },
      create: {
        equipmentId: equipment.id,
        role: photo.role as MediaRole,
        storagePath: `${mediaStem(item.slug, photo.filename)}-1280.webp`,
        sourceFilename: photo.filename,
        altText: photo.alt,
        sortOrder,
      },
      update: {
        role: photo.role as MediaRole,
        storagePath: `${mediaStem(item.slug, photo.filename)}-1280.webp`,
        altText: photo.alt,
        sortOrder,
      },
    });
  }
}

for (const item of muscleSeed) {
  const muscle = await prisma.muscle.upsert({
    where: { slug: item.slug },
    create: item,
    update: { name: item.name, groupName: item.groupName },
  });
  muscleIds.set(item.slug, muscle.id);
}

for (const item of exerciseSeed) {
  const equipmentId = item.equipmentSlug ? equipmentIds.get(item.equipmentSlug) : null;
  if (item.equipmentSlug && !equipmentId) {
    throw new Error(`Missing verified equipment: ${item.equipmentSlug}`);
  }

  const exercise = await prisma.exercise.upsert({
    where: { slug: item.slug },
    create: {
      slug: item.slug,
      name: item.name,
      equipmentId,
      defaultTargetReps: DEFAULT_TARGET_REPS,
      active: true,
      repMode: item.repMode,
      loadEntryMode: item.loadEntryMode,
      loadTrackingType: item.loadTrackingType,
    },
    update: {
      name: item.name,
      equipmentId,
      defaultTargetReps: DEFAULT_TARGET_REPS,
      active: true,
      repMode: item.repMode,
      loadEntryMode: item.loadEntryMode,
      loadTrackingType: item.loadTrackingType,
    },
  });
  exerciseIds.set(item.slug, exercise.id);

  const relationships = [
    { slug: item.primaryMuscle, role: MuscleRole.PRIMARY },
    ...item.secondaryMuscles.map((slug) => ({ slug, role: MuscleRole.SECONDARY })),
  ];
  const relationshipMuscleIds = relationships.map(({ slug }) => {
    const id = muscleIds.get(slug);
    if (!id) throw new Error(`Missing muscle: ${slug}`);
    return id;
  });

  await prisma.exerciseMuscle.deleteMany({
    where: { exerciseId: exercise.id, muscleId: { notIn: relationshipMuscleIds } },
  });

  for (const relationship of relationships) {
    const muscleId = muscleIds.get(relationship.slug)!;
    await prisma.exerciseMuscle.upsert({
      where: { exerciseId_muscleId: { exerciseId: exercise.id, muscleId } },
      create: { exerciseId: exercise.id, muscleId, role: relationship.role },
      update: { role: relationship.role },
    });
  }
}

// These filenames document equipment, not the movement. Remove only the
// historical incorrect exercise-owned associations; the equipment media itself
// remains available in the verified equipment catalogue.
for (const [exerciseSlug, sourceFilename] of [
  ["step-up", "20260830_142012.jpg"],
  ["goblet-squat", "20260830_141924.jpg"],
  ["dumbbell-romanian-deadlift", "20260830_141924.jpg"],
  ["one-arm-dumbbell-row", "20260830_141924.jpg"],
  ["standing-dumbbell-shoulder-press", "20260830_141924.jpg"],
  ["dumbbell-biceps-curl", "20260830_141924.jpg"],
  ["dumbbell-lateral-raise", "20260830_141924.jpg"],
] as const) {
  const exerciseId = exerciseIds.get(exerciseSlug);
  if (exerciseId) await prisma.exerciseMedia.deleteMany({ where: { exerciseId, sourceFilename } });
}

for (const media of localExerciseMediaSeed) {
  const exerciseId = exerciseIds.get(media.exerciseSlug);
  if (!exerciseId) throw new Error(`Missing exercise for local media: ${media.exerciseSlug}`);
  await prisma.exerciseMedia.upsert({
    where: { exerciseId_provider_externalId_kind: { exerciseId, provider: "vicgym-local", externalId: media.filename, kind: "IMAGE" } },
    create: { exerciseId, role: MediaRole.PRIMARY, kind: "IMAGE", storagePath: `${localExerciseMediaStem(media.exerciseSlug, media.filename)}-1280.webp`, sourceFilename: media.filename, altText: media.alt, provider: "vicgym-local", externalId: media.filename, attribution: "VicGym supplied exercise movement image.", sortOrder: 0 },
    update: { role: MediaRole.PRIMARY, storagePath: `${localExerciseMediaStem(media.exerciseSlug, media.filename)}-1280.webp`, sourceFilename: media.filename, altText: media.alt, attribution: "VicGym supplied exercise movement image.", sortOrder: 0 },
  });
}

const program = await prisma.workoutProgram.upsert({
  where: { slug: demoProgrammeSeed.slug },
  create: {
    slug: demoProgrammeSeed.slug,
    name: demoProgrammeSeed.name,
    isDemo: true,
    status: ProgramStatus.DEMO,
    activeVersionId: null,
    notice: demoProgrammeSeed.notice,
  },
  update: {
    name: demoProgrammeSeed.name,
    isDemo: true,
    notice: demoProgrammeSeed.notice,
  },
});

const existingVersion = await prisma.programVersion.findUnique({
  where: {
    programId_versionNumber: {
      programId: program.id,
      versionNumber: demoProgrammeSeed.version,
    },
  },
  select: { id: true },
});

if (!existingVersion) {
  const compoundExercises = new Set([
    "chest-press",
    "lat-pulldown",
    "shoulder-press",
    "machine-squat",
    "bodyweight-squat",
    "one-arm-dumbbell-row",
    "standing-dumbbell-shoulder-press",
    "push-up",
    "goblet-squat",
    "dumbbell-romanian-deadlift",
    "reverse-lunge",
    "step-up",
  ]);

  await prisma.programVersion.create({
    data: {
      programId: program.id,
      versionNumber: demoProgrammeSeed.version,
      source: ProgramVersionSource.SEED,
      notes: "Provisional fixture data created only to test programme and later workout workflows.",
      days: {
        create: demoProgrammeSeed.days.map((day, dayIndex) => ({
          slug: day.slug,
          name: day.name,
          rotationOrder: dayIndex + 1,
          workoutExercises: {
            create: day.exercises.map((exerciseSlug, exerciseIndex) => {
              const exerciseId = exerciseIds.get(exerciseSlug);
              if (!exerciseId) throw new Error(`Missing exercise: ${exerciseSlug}`);
              return {
                exerciseId,
                position: exerciseIndex + 1,
                sets: DEMO_SETS,
                targetReps: DEFAULT_TARGET_REPS,
                plannedWeightKg: null,
                plannedLoadValue: null,
                loadTrackingTypeSnapshot: exerciseSeed.find((item) => item.slug === exerciseSlug)?.loadTrackingType,
                loadEntryModeSnapshot: exerciseSeed.find((item) => item.slug === exerciseSlug)?.loadEntryMode,
                restSeconds: compoundExercises.has(exerciseSlug) ? 120 : 90,
                autoRest: true,
              };
            }),
          },
        })),
      },
    },
  });
}

console.log(
  `Seeded ${equipmentSeed.length} equipment records, ${exerciseSeed.length} exercises, ${muscleSeed.length} muscles, and demo programme version ${demoProgrammeSeed.version}.`,
);

}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
