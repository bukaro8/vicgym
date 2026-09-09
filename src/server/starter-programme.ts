import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { SemiPersonalisedInput } from "@/lib/onboarding";
import { setActiveProgramme } from "@/server/active-programme";

export type StarterCatalogueExercise = {
  id: string; slug: string; name: string; defaultTargetReps: number;
  loadTrackingType: "KILOGRAM" | "MACHINE_LEVEL" | "BODYWEIGHT" | "REPS_ONLY";
  loadEntryMode: "STACK_TOTAL" | "TOTAL_LOAD" | "PER_DUMBBELL" | "BODYWEIGHT" | "NONE";
  equipmentType: string | null; primaryMuscle: string | null;
};

const patterns = {
  upperA: ["chest", "lats", "anterior-deltoids", "triceps", "biceps", "lateral-deltoids", "upper-back", "abdominals"],
  upperB: ["lats", "chest", "lateral-deltoids", "biceps", "triceps", "anterior-deltoids", "upper-back", "abdominals"],
  lowerA: ["quadriceps", "hamstrings", "glutes", "calves", "abdominals", "quadriceps", "hamstrings", "glutes"],
  lowerB: ["hamstrings", "quadriceps", "glutes", "calves", "abdominals", "hamstrings", "quadriceps", "glutes"],
  fullA: ["quadriceps", "chest", "lats", "hamstrings", "anterior-deltoids", "glutes", "abdominals", "biceps"],
  fullB: ["hamstrings", "lats", "chest", "quadriceps", "lateral-deltoids", "glutes", "abdominals", "triceps"],
  fullC: ["glutes", "chest", "upper-back", "quadriceps", "anterior-deltoids", "hamstrings", "abdominals", "biceps"],
} as const;

const structures = {
  2: [["full-body-a", "Full Body A", "fullA"], ["full-body-b", "Full Body B", "fullB"]],
  3: [["full-body-a", "Full Body A", "fullA"], ["full-body-b", "Full Body B", "fullB"], ["full-body-c", "Full Body C", "fullC"]],
  4: [["upper-a", "Upper A", "upperA"], ["lower-a", "Lower A", "lowerA"], ["upper-b", "Upper B", "upperB"], ["lower-b", "Lower B", "lowerB"]],
  5: [["upper-a", "Upper A", "upperA"], ["lower-a", "Lower A", "lowerA"], ["full-body", "Full Body", "fullC"], ["upper-b", "Upper B", "upperB"], ["lower-b", "Lower B", "lowerB"]],
} as const;

const limitedMuscles: Record<string, string[]> = {
  UPPER_BODY: ["chest", "triceps", "biceps", "anterior-deltoids", "lateral-deltoids"],
  LOWER_BODY: ["quadriceps", "glutes", "hamstrings", "calves", "hip-flexors"],
  BACK: ["lats", "upper-back", "lower-back"], CORE: ["abdominals", "obliques"], OTHER: [],
};

export function generateStarterProgramme(catalogue: StarterCatalogueExercise[], input: SemiPersonalisedInput) {
  const excluded = new Set(input.limitationAreas.flatMap((area) => limitedMuscles[area]));
  const available = catalogue.filter((exercise) => !exercise.primaryMuscle || !excluded.has(exercise.primaryMuscle));
  const base = ({ 45: 4, 60: 5, 90: 6, 120: 7 } as const)[input.sessionLengthMinutes];
  const desired = Math.min(8, Math.max(3, base + (input.experience === "BEGINNER" ? -1 : input.experience === "EXPERIENCED" ? 1 : 0) + (input.goal === "BUILD_MUSCLE" ? 1 : 0)));
  const equipmentOrder = input.experience === "BEGINNER" ? ["MACHINE", "BODYWEIGHT", "DUMBBELL", "STEP", "BARBELL"] : input.experience === "EXPERIENCED" ? ["DUMBBELL", "BARBELL", "MACHINE", "BODYWEIGHT", "STEP"] : ["MACHINE", "DUMBBELL", "BODYWEIGHT", "STEP", "BARBELL"];
  const ranked = [...available].sort((a, b) => equipmentOrder.indexOf(a.equipmentType ?? "BODYWEIGHT") - equipmentOrder.indexOf(b.equipmentType ?? "BODYWEIGHT") || a.slug.localeCompare(b.slug));
  const days = structures[input.trainingDaysPerWeek].map(([slug, name, patternKey], dayIndex) => {
    const picked: StarterCatalogueExercise[] = [];
    for (const muscle of patterns[patternKey]) {
      const matches = ranked.filter((exercise) => exercise.primaryMuscle === muscle && !picked.some((item) => item.id === exercise.id));
      const candidate = matches[dayIndex % Math.max(matches.length, 1)] ?? matches[0];
      if (candidate) picked.push(candidate);
      if (picked.length >= desired) break;
    }
    for (const candidate of ranked) if (picked.length < desired && !picked.some((item) => item.id === candidate.id)) picked.push(candidate);
    if (!picked.length) throw new Error("No catalogue exercises remain after the selected limitations; choose fully personalised review");
    return { slug, name, rotationOrder: dayIndex + 1, exercises: picked.map((exercise, position) => ({
      exerciseId: exercise.id, slug: exercise.slug, name: exercise.name, position: position + 1,
      sets: input.experience === "BEGINNER" ? 2 : (input.experience === "EXPERIENCED" && position < 2) || (input.goal === "BUILD_MUSCLE" && position === 0) ? 4 : 3,
      targetReps: exercise.defaultTargetReps, plannedWeightKg: null, plannedLoadValue: null,
      loadTrackingTypeSnapshot: exercise.loadTrackingType, loadEntryModeSnapshot: exercise.loadEntryMode,
      restSeconds: (input.goal === "LOSE_FAT" ? 60 : input.goal === "BUILD_MUSCLE" ? 90 : 75) + (input.experience === "EXPERIENCED" && position < 2 ? 30 : 0), autoRest: true,
    })) };
  });
  const cardioBase = input.goal === "LOSE_FAT" ? 20 : input.goal === "GENERAL_FITNESS" ? 10 : 5;
  const recommendedCardioMinutes = Math.min(({ 45: 10, 60: 20, 90: 30, 120: 40 } as const)[input.sessionLengthMinutes], Math.max(0, cardioBase + (input.cardioPreference === "MINIMAL" ? -5 : input.cardioPreference === "ENJOYS_CARDIO" ? 10 : 0)));
  return { slug: "vicgym-starter", name: "VicGym Starter Programme", days, recommendedCardioMinutes };
}

export async function generateAndActivateStarterProgramme(prisma: PrismaClient, userId: string, input: SemiPersonalisedInput) {
  return prisma.$transaction(async (tx) => {
    const settings = await tx.appSettings.upsert({ where: { userId }, create: { userId }, update: {}, select: { activeProgramId: true } });
    if (settings.activeProgramId || await tx.workoutProgram.findFirst({ where: { userId }, select: { id: true } })) throw new Error("ONBOARDING_ALREADY_COMPLETED");
    const rows = await tx.exercise.findMany({ where: { active: true, OR: [{ equipmentId: null }, { equipment: { available: true } }] }, orderBy: { slug: "asc" }, include: { equipment: { select: { type: true } }, muscles: { where: { role: "PRIMARY" }, take: 1, include: { muscle: { select: { slug: true } } } } } });
    const catalogue: StarterCatalogueExercise[] = rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, defaultTargetReps: row.defaultTargetReps, loadTrackingType: row.loadTrackingType, loadEntryMode: row.loadEntryMode, equipmentType: row.equipment?.type ?? null, primaryMuscle: row.muscles[0]?.muscle.slug ?? null }));
    const plan = generateStarterProgramme(catalogue, input);
    const notice = `Generated starter programme. Optional cardio target: ${plan.recommendedCardioMinutes} minutes per session.${input.hasLimitations ? " Limitations were recorded for coach review; free text was not interpreted automatically." : ""}`;
    const program = await tx.workoutProgram.create({ data: { userId, slug: plan.slug, name: plan.name, notice, status: "DRAFT", versions: { create: { versionNumber: 1, source: "GENERATED", notes: "Deterministic onboarding starter programme", days: { create: plan.days.map((day) => ({ slug: day.slug, name: day.name, rotationOrder: day.rotationOrder, workoutExercises: { create: day.exercises.map((exercise) => ({ exerciseId: exercise.exerciseId, position: exercise.position, sets: exercise.sets, targetReps: exercise.targetReps, plannedWeightKg: exercise.plannedWeightKg, plannedLoadValue: exercise.plannedLoadValue, loadTrackingTypeSnapshot: exercise.loadTrackingTypeSnapshot, loadEntryModeSnapshot: exercise.loadEntryModeSnapshot, restSeconds: exercise.restSeconds, autoRest: exercise.autoRest })) } })) } } } }, include: { versions: { select: { id: true, versionNumber: true } } } });
    const version = program.versions[0];
    await tx.onboardingProfile.upsert({ where: { userId }, create: { userId, path: "SEMI_PERSONALISED", ...input, limitationsText: input.limitationsText || null, limitationReviewRequired: input.hasLimitations, recommendedCardioMinutes: plan.recommendedCardioMinutes, completedAt: new Date() }, update: { path: "SEMI_PERSONALISED", ...input, limitationsText: input.limitationsText || null, limitationReviewRequired: input.hasLimitations, recommendedCardioMinutes: plan.recommendedCardioMinutes, completedAt: new Date() } });
    await setActiveProgramme(tx, userId, program.id, version.id);
    await tx.appSettings.update({ where: { userId }, data: { onboardingCompleted: true } });
    return { programId: program.id, versionNumber: version.versionNumber, days: plan.days.length };
  }, { isolationLevel: "Serializable" as Prisma.TransactionIsolationLevel });
}
