import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { equipmentSeed, exerciseSeed, muscleSeed, exerciseDbMediaSeed, localExerciseMediaSeed } from "./phase-2-catalogue";
import { posterExerciseSeed, posterExerciseMediaSeed, posterPlaceholderSlugs } from "./poster-catalogue";
import { getExercisePrimaryMedia } from "../lib/exercise-media";

describe("poster catalogue expansion", () => {
  it("has unique stable identifiers and valid equipment/muscle references", () => {
    expect(new Set(exerciseSeed.map((exercise) => exercise.slug)).size).toBe(exerciseSeed.length);
    const muscles = new Set<string>(muscleSeed.map((muscle) => muscle.slug));
    for (const exercise of posterExerciseSeed) {
      expect(exercise.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(exercise.equipmentSlug === null || equipmentSeed.some((equipment) => equipment.slug === exercise.equipmentSlug)).toBe(true);
      expect(muscles.has(exercise.primaryMuscle)).toBe(true);
      expect(exercise.secondaryMuscles.every((muscle) => muscles.has(muscle) && muscle !== exercise.primaryMuscle)).toBe(true);
      expect(exercise.loadTrackingType).toBe(exercise.equipmentSlug === null ? "BODYWEIGHT" : "KILOGRAM");
    }
  });

  it("bundles all four local derivatives and selects them as primary movement media", () => {
    const posterSlugs = new Set(posterExerciseSeed.map((exercise) => exercise.slug));
    const mediaSlugs = new Set([
      ...posterExerciseMediaSeed.map((media) => media.exerciseSlug),
      ...localExerciseMediaSeed.map((media) => media.exerciseSlug),
    ]);
    expect([...posterSlugs].filter((slug) => !mediaSlugs.has(slug)).sort()).toEqual([...posterPlaceholderSlugs].sort());
    for (const media of posterExerciseMediaSeed) {
      expect(exerciseDbMediaSeed.filter((item) => item.exerciseSlug === media.exerciseSlug)).toHaveLength(1);
      expect(media.sourceUrl).toMatch(/^https:\/\//);
      const stem = `/media/exercises/${media.exerciseSlug}/${media.sourceFilename.replace(/-source$/, "")}`;
      for (const width of [640, 1280]) for (const format of ["webp", "avif"]) {
        expect(existsSync(path.join(process.cwd(), "public", `${stem}-${width}.${format}`))).toBe(true);
      }
      const image = { storagePath: `${stem}-1280.webp`, altText: media.alt, role: "PRIMARY", kind: "IMAGE" };
      expect(getExercisePrimaryMedia({ media: [image] })).toEqual(image);
    }
  });

  it("uses generated local movement illustrations for retained unmatched exercises", () => {
    expect(localExerciseMediaSeed).toEqual(expect.arrayContaining([
      expect.objectContaining({ exerciseSlug: "renegade-row", filename: "renegade-row.png" }),
      expect.objectContaining({ exerciseSlug: "dumbbell-thruster", filename: "dumbbell-thruster.png" }),
    ]));
  });

  it("keeps any explicitly declared unmatched movements free of misleading equipment media", () => {
    for (const slug of posterPlaceholderSlugs) {
      expect(posterExerciseSeed.some((exercise) => exercise.slug === slug)).toBe(true);
      expect(exerciseDbMediaSeed.some((media) => media.exerciseSlug === slug)).toBe(false);
      expect(getExercisePrimaryMedia({ media: [], equipment: { type: "DUMBBELL", media: [{ storagePath: "/rack.webp", altText: "Dumbbell rack", role: "PRIMARY" }] } })).toBeNull();
    }
  });

  it("reuses existing poster aliases without adding duplicate catalogue definitions", () => {
    for (const slug of ["dumbbell-chest-press", "dumbbell-lateral-raise", "one-arm-dumbbell-row", "dumbbell-romanian-deadlift", "standing-dumbbell-shoulder-press", "dumbbell-biceps-curl", "goblet-squat", "glute-bridge", "reverse-lunge", "step-up", "calf-raises"]) {
      expect(exerciseSeed.filter((exercise) => exercise.slug === slug)).toHaveLength(1);
      expect(posterExerciseSeed.some((exercise) => exercise.slug === slug)).toBe(false);
    }
  });
});
