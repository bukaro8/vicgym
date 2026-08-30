import { describe, expect, it } from "vitest";

import { DEFAULT_TARGET_REPS, DEMO_SETS, demoProgrammeSeed, equipmentSeed, exerciseSeed } from "@/data/phase-2-catalogue";

describe("Phase 2 fixture boundaries", () => {
  it("maps every supplied photo once and gives every equipment item one primary", () => {
    const photos = equipmentSeed.flatMap((equipment) => equipment.photos.map((photo) => photo.filename));
    expect(photos).toHaveLength(24);
    expect(new Set(photos).size).toBe(24);
    for (const equipment of equipmentSeed) {
      expect(equipment.photos.filter((photo) => photo.role === "PRIMARY")).toHaveLength(1);
    }
  });

  it("uses verified equipment or no equipment for every exercise", () => {
    const verified = new Set(equipmentSeed.map((equipment) => equipment.slug));
    for (const exercise of exerciseSeed) {
      expect(exercise.equipmentSlug === null || verified.has(exercise.equipmentSlug)).toBe(true);
    }
  });

  it("keeps the demo programme constrained to the exercise library", () => {
    const exercises = new Set(exerciseSeed.map((exercise) => exercise.slug));
    const programmeExercises = demoProgrammeSeed.days.flatMap((day) => [...day.exercises]);
    expect(demoProgrammeSeed.days).toHaveLength(4);
    expect(programmeExercises).toHaveLength(20);
    expect(programmeExercises.every((slug) => exercises.has(slug))).toBe(true);
    expect(DEFAULT_TARGET_REPS).toBe(12);
    expect(DEMO_SETS).toBe(3);
    expect(demoProgrammeSeed.notice).toBe("Demo programme — not training advice.");
  });
});
