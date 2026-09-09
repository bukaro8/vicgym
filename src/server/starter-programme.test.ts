import { describe, expect, it, vi } from "vitest";

import type { SemiPersonalisedInput } from "@/lib/onboarding";
import { generateAndActivateStarterProgramme, generateStarterProgramme, type StarterCatalogueExercise } from "@/server/starter-programme";

const muscles = ["quadriceps", "hamstrings", "glutes", "calves", "chest", "lats", "anterior-deltoids", "lateral-deltoids", "triceps", "biceps", "upper-back", "abdominals"];
const catalogue: StarterCatalogueExercise[] = muscles.flatMap((muscle, index) => [0, 1].map((variant) => ({ id: `${index}-${variant}`, slug: `${muscle}-${variant}`, name: `${muscle} ${variant}`, defaultTargetReps: 12, loadTrackingType: variant ? "KILOGRAM" : "MACHINE_LEVEL", loadEntryMode: variant ? "PER_DUMBBELL" : "STACK_TOTAL", equipmentType: variant ? "DUMBBELL" : "MACHINE", primaryMuscle: muscle })));
const answers: SemiPersonalisedInput = { goal: "GENERAL_FITNESS", trainingDaysPerWeek: 3, experience: "SOME_EXPERIENCE", sessionLengthMinutes: 60, cardioPreference: "SOME", hasLimitations: false, limitationAreas: [], limitationsText: "" };

describe("starter programme generator", () => {
  it.each([[2, ["full-body-a", "full-body-b"]], [3, ["full-body-a", "full-body-b", "full-body-c"]], [4, ["upper-a", "lower-a", "upper-b", "lower-b"]], [5, ["upper-a", "lower-a", "full-body", "upper-b", "lower-b"]]] as const)("creates the deterministic %i-day structure", (days, slugs) => {
    const result = generateStarterProgramme(catalogue, { ...answers, trainingDaysPerWeek: days });
    expect(result.days.map((day) => day.slug)).toEqual(slugs);
    expect(result.days.flatMap((day) => day.exercises).every((exercise) => catalogue.some((entry) => entry.id === exercise.exerciseId))).toBe(true);
    expect(result.days.flatMap((day) => day.exercises).every((exercise) => exercise.plannedLoadValue === null && exercise.plannedWeightKg === null)).toBe(true);
  });

  it("meaningfully varies volume, cardio, and catalogue preference", () => {
    const beginner = generateStarterProgramme(catalogue, { ...answers, experience: "BEGINNER", cardioPreference: "MINIMAL" });
    const experienced = generateStarterProgramme(catalogue, { ...answers, experience: "EXPERIENCED", cardioPreference: "ENJOYS_CARDIO" });
    expect(experienced.days[0].exercises.length).toBeGreaterThan(beginner.days[0].exercises.length);
    expect(experienced.days[0].exercises[0].sets).toBeGreaterThan(beginner.days[0].exercises[0].sets);
    expect(experienced.recommendedCardioMinutes).toBeGreaterThan(beginner.recommendedCardioMinutes);
    expect(beginner.days[0].exercises[0].loadTrackingTypeSnapshot).toBe("MACHINE_LEVEL");
    expect(experienced.days[0].exercises[0].loadTrackingTypeSnapshot).toBe("KILOGRAM");
  });

  it("uses structured limitation areas and only records free text for review", () => {
    const result = generateStarterProgramme(catalogue, { ...answers, hasLimitations: true, limitationAreas: ["BACK"], limitationsText: "private coach note" });
    expect(result.days.flatMap((day) => day.exercises).some((exercise) => ["lats-0", "lats-1", "upper-back-0", "upper-back-1"].includes(exercise.slug))).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private coach note");
  });

  it("creates version 1 for the authenticated owner and activates it atomically", async () => {
    const appSettingsUpsert = vi.fn().mockResolvedValueOnce({ activeProgramId: null }).mockResolvedValueOnce({});
    const workoutProgramFindFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "program-1" });
    const workoutProgramUpdate = vi.fn().mockResolvedValue({ id: "program-1" });
    const tx = {
      appSettings: { upsert: appSettingsUpsert, update: vi.fn() },
      workoutProgram: { findFirst: workoutProgramFindFirst, create: vi.fn().mockResolvedValue({ id: "program-1", versions: [{ id: "version-1", versionNumber: 1 }] }), updateMany: vi.fn(), update: workoutProgramUpdate },
      programVersion: { findFirst: vi.fn().mockResolvedValue({ id: "version-1" }) },
      exercise: { findMany: vi.fn().mockResolvedValue(catalogue.map((exercise) => ({ ...exercise, equipment: { type: exercise.equipmentType }, muscles: [{ muscle: { slug: exercise.primaryMuscle } }] }))) },
      onboardingProfile: { upsert: vi.fn() },
    };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    const result = await generateAndActivateStarterProgramme(prisma as never, "user-1", answers);
    expect(result).toMatchObject({ programId: "program-1", versionNumber: 1, days: 3 });
    expect(tx.workoutProgram.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", status: "DRAFT", versions: { create: expect.objectContaining({ versionNumber: 1, source: "GENERATED" }) } }) }));
    expect(workoutProgramUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "program-1" }, data: expect.objectContaining({ activeVersionId: "version-1", status: "ACTIVE" }) }));
    expect(appSettingsUpsert).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: "user-1" }, update: { activeProgramId: "program-1" } }));
  });
});
