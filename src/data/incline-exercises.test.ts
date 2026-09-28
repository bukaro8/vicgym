import { describe, expect, it, vi } from "vitest";
import { exerciseSeed, localExerciseMediaSeed } from "./phase-2-catalogue";
import { previewCoachImport } from "@/server/coach-import";
import { getExercisePrimaryMedia } from "@/lib/exercise-media";
import { loadInputLabel } from "@/lib/load-tracking";

const slugs = ["incline-bench-pulls", "seated-incline-dumbbell-biceps-curl", "incline-bench-reverse-fly"];

describe("incline dumbbell catalogue additions", () => {
  it.each(slugs)("recognises %s in initial imports with per-dumbbell kilogram semantics", async (slug) => {
    const exercise = exerciseSeed.find((item) => item.slug === slug)!;
    expect(exercise).toMatchObject({ equipmentSlug: "dumbbells", loadTrackingType: "KILOGRAM", loadEntryMode: "PER_DUMBBELL", defaultRestSeconds: slug === "incline-bench-pulls" ? 75 : 60 });
    expect(exerciseSeed.filter((item) => item.slug === slug)).toHaveLength(1);
    expect(loadInputLabel(exercise.loadTrackingType, exercise.loadEntryMode)).toBe("Weight per dumbbell (kg)");
    const db = {
      programmeRequest: { findFirst: vi.fn().mockResolvedValue(null) },
      workoutProgram: { findFirst: vi.fn().mockResolvedValue(null) },
      appSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      exercise: { findMany: vi.fn().mockResolvedValue([{ ...exercise, id: slug, active: true, equipmentId: "dumbbells", equipment: { available: true } }]) },
    };
    const preview = await previewCoachImport(db as never, "owner", JSON.stringify({ schemaVersion: 2, operation: "create-programme", program: { slug: "test", name: "Test" }, days: [{ slug: "day", name: "Day", rotationOrder: 1, exercises: [{ exercise: slug, sets: 3, targetReps: 12, load: { type: "kg", value: 10 }, restSeconds: exercise.defaultRestSeconds, autoRest: true, position: 1 }] }] }));
    expect(preview.days[0].exercises[0]).toMatchObject({ slug, sets: 3, targetReps: 12, restSeconds: exercise.defaultRestSeconds, autoRest: true });
    expect(preview.days[0].exercises[0].plannedLoad).toContain("per dumbbell");
    const media = localExerciseMediaSeed.find((item) => item.exerciseSlug === slug)!;
    expect(media.filename).toBe(`${slug}.png`);
    const local = { provider: "vicgym-local", role: "PRIMARY", kind: "IMAGE", storagePath: `/media/exercises/${slug}/${slug}-1280.webp`, altText: media.alt };
    expect(getExercisePrimaryMedia({ media: [{ ...local, provider: "ascendapi-exercisedb", storagePath: "/stale.webp" }, local] })).toBe(local);
  });
});
