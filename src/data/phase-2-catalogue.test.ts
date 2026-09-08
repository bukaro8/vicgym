import { describe, expect, it } from "vitest";

import { DEFAULT_TARGET_REPS, DEMO_SETS, demoProgrammeSeed, equipmentSeed, exerciseDbMediaSeed, exerciseSeed, localExerciseMediaSeed } from "@/data/phase-2-catalogue";

describe("Phase 2 fixture boundaries", () => {
  it("maps every supplied photo once and gives every equipment item one primary", () => {
    const photos = equipmentSeed.flatMap((equipment) => equipment.photos.map((photo) => photo.filename));
    expect(photos).toHaveLength(24);
    expect(new Set(photos).size).toBe(24);
    for (const equipment of equipmentSeed) {
      expect(equipment.photos.filter((photo) => photo.role === "PRIMARY")).toHaveLength(1);
    }
  });

  it("uses the labelled side view as primary for every paired small-gym machine", () => {
    const expectedPrimaryPhotos = new Map([
      ["triceps-press", "20260830_141807.jpg"],
      ["chest-press", "20260830_141816.jpg"],
      ["shoulder-press", "20260830_141826.jpg"],
      ["squat-machine", "20260830_141836.jpg"],
      ["leg-extension", "20260830_141936.jpg"],
      ["lat-pulldown", "20260830_141853.jpg"],
      ["biceps-curl", "20260830_141904.jpg"],
      ["seated-leg-curl", "20260830_141928.jpg"],
    ]);

    for (const [slug, filename] of expectedPrimaryPhotos) {
      const equipment = equipmentSeed.find((item) => item.slug === slug);
      expect(equipment?.photos.find((photo) => photo.role === "PRIMARY")?.filename).toBe(filename);
      expect(equipment?.photos[0].filename).toBe(filename);
    }
  });

  it("uses verified equipment or no equipment for every exercise", () => {
    const verified = new Set(equipmentSeed.map((equipment) => equipment.slug));
    for (const exercise of exerciseSeed) {
      expect(exercise.equipmentSlug === null || verified.has(exercise.equipmentSlug)).toBe(true);
    }
  });

  it("uses explicit kilogram semantics for the supported dumbbell exercises", () => {
    expect(exerciseSeed.find((exercise) => exercise.slug === "dumbbell-chest-press")).toMatchObject({
      equipmentSlug: "dumbbells",
      loadTrackingType: "KILOGRAM",
      loadEntryMode: "PER_DUMBBELL",
    });
    for (const slug of ["glute-bridge", "hip-raises", "calf-raises"]) {
      expect(exerciseSeed.find((exercise) => exercise.slug === slug)).toMatchObject({
        equipmentSlug: "dumbbells",
        loadTrackingType: "KILOGRAM",
        loadEntryMode: "TOTAL_LOAD",
      });
    }
    for (const slug of ["barbell-bent-over-row", "barbell-deadlift"]) {
      expect(exerciseSeed.find((exercise) => exercise.slug === slug)).toMatchObject({
        equipmentSlug: "studio-accessories",
        loadTrackingType: "KILOGRAM",
        loadEntryMode: "TOTAL_LOAD",
      });
    }
    expect(exerciseSeed.find((exercise) => exercise.slug === "dumbbell-romanian-deadlift")).toMatchObject({
      equipmentSlug: "dumbbells",
      loadTrackingType: "KILOGRAM",
      loadEntryMode: "PER_DUMBBELL",
    });
  });

  it("maps the requested exercise-specific media to exact catalogue slugs", () => {
    expect(localExerciseMediaSeed).toContainEqual(expect.objectContaining({
      exerciseSlug: "dumbbell-chest-press",
      filename: "dumbbell-chest-press.png",
    }));
    expect(exerciseDbMediaSeed).toEqual(expect.arrayContaining([
      expect.objectContaining({ exerciseSlug: "barbell-bent-over-row", externalId: "eZyBC3j" }),
      expect.objectContaining({ exerciseSlug: "barbell-deadlift", externalId: "ila4NZS" }),
    ]));
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
