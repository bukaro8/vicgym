import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { getWeeklyReview } from "@/server/weekly-review";

function prismaFor(activeProgram: unknown, exercises: unknown[] = []) {
  return {
    workoutSession: { findMany: vi.fn().mockResolvedValue([]) },
    appSettings: { findUnique: vi.fn().mockResolvedValue({ activeProgram }) },
    exercise: { findMany: vi.fn().mockResolvedValue(exercises) },
    exerciseSession: { findMany: vi.fn() },
    programVersion: { findMany: vi.fn().mockResolvedValue([]) },
    onboardingProfile: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaClient;
}

describe("weekly review coaching identifiers", () => {
  it("exports bounded comparable exposures, programme stability and only available substitution metadata", async () => {
    const program = { id: "p", name: "Small Gym", slug: "small-gym", status: "ACTIVE", activeVersion: { versionNumber: 4, days: [{ slug: "upper-a", name: "Upper A", workoutExercises: [{ exerciseId: "curl", position: 1, sets: 3, targetReps: 12, restSeconds: 60, autoRest: true, plannedLoadValue: 8, plannedWeightKg: null, loadTrackingTypeSnapshot: "MACHINE_LEVEL", loadEntryModeSnapshot: "STACK_TOTAL", exercise: { slug: "biceps-curl", loadTrackingType: "MACHINE_LEVEL" } }] }] } };
    const db = prismaFor(program, [{ slug: "hammer-curl", name: "Hammer Curl", loadTrackingType: "KILOGRAM", loadEntryMode: "PER_DUMBBELL", muscles: [{ role: "PRIMARY", muscle: { name: "Biceps" } }], equipment: { available: true, type: "DUMBBELL", name: "Dumbbells" } }, { slug: "unavailable", equipment: { available: false, type: "MACHINE" } }]);
    vi.mocked(db.programVersion.findMany).mockResolvedValue([{ versionNumber: 3, createdAt: new Date("2026-08-10T12:00:00Z"), notes: null, days: [{ slug: "upper-a", workoutExercises: [{ exercise: { slug: "biceps-curl" } }] }] }] as never);
    vi.mocked(db.onboardingProfile.findUnique).mockResolvedValue({ limitationsText: "Avoid painful shoulder movements", trainingPreferences: "nope" } as never);
    vi.mocked(db.exerciseSession.findMany).mockResolvedValue([1, 2, 3, 4].map((index) => ({ id: `exposure-${index}`, exerciseId: "curl", exercise: { slug: "biceps-curl" }, plannedSets: 3, restSeconds: 60, loadTrackingTypeSnapshot: "MACHINE_LEVEL", loadEntryModeSnapshot: "STACK_TOTAL", workoutSession: { completedAt: new Date(`2026-08-${10 + index}T12:00:00Z`), programVersion: { versionNumber: 3, program: { slug: "small-gym" } } }, setLogs: [1, 2, 3].map((setNumber) => ({ setNumber, actualReps: 12, targetReps: 12, weightKg: null, loadValue: 8, effort: "EASY", notes: null })) })) as never);
    const { report } = await getWeeklyReview(db, "user-1", "2026-08-24");
    expect(report).not.toContain("biceps-curl · 2026-08-11");
    expect(report).toContain("biceps-curl · 2026-08-12");
    expect(report).toContain("S1 L8 × 12/12 target · Easy; S2 L8 × 12/12 target · Easy; S3 L8 × 12/12 target · Easy");
    expect(report).toContain("Version 3 · 2026-08-10: upper-a [biceps-curl]");
    expect(report).toContain("hammer-curl: Hammer Curl · primary Biceps · Dumbbells · KILOGRAM/PER_DUMBBELL");
    expect(report).not.toContain("unavailable:");
    expect(report).toContain("Avoid painful shoulder movements");
    expect(report).toContain("Preferences: nope");
    expect(db.programVersion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ program: { userId: "user-1" } }), take: 3 }));
    expect(db.exerciseSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workoutSession: expect.objectContaining({ userId: "user-1", status: "COMPLETED" }) }) }));
  });
  it("exports effort for individual completed sets in sequence, without guessing missing ratings", async () => {
    const prisma = prismaFor(null);
    vi.mocked(prisma.exerciseSession.findMany).mockResolvedValue([]);
    const sets = ["EASY", "MODERATE", "HARD", null].map((effort, index) => ({ setNumber: index + 1, targetReps: 12, actualReps: 12, weightKg: null, loadValue: 12, effort, notes: null, completedAt: new Date("2026-08-25T10:10:00Z"), restPeriod: null }));
    vi.mocked(prisma.workoutSession.findMany).mockResolvedValue([{
      id: "session", status: "COMPLETED", startedAt: new Date("2026-08-25T10:00:00Z"), completedAt: new Date("2026-08-25T10:20:00Z"), workoutDayNameSnapshot: "Upper A", workoutDay: { slug: "upper-a" }, programVersion: { versionNumber: 3 }, cardioPlanned: false,
      exerciseSessions: [{ id: "exercise-session", exerciseId: "chest", exerciseNameSnapshot: "Chest Press", targetReps: 12, plannedSets: 4, restSeconds: 60, notes: null, loadTrackingTypeSnapshot: "MACHINE_LEVEL", loadEntryModeSnapshot: "STACK_TOTAL", loadMultiplierSnapshot: 1, exercise: { slug: "chest-press", muscles: [] }, setLogs: sets }],
    }] as never);
    const { report } = await getWeeklyReview(prisma, "user-1", "2026-08-24");
    expect(report).toContain("- Set 1: L12 × 12 · Effort: Easy\n- Set 2: L12 × 12 · Effort: Moderate\n- Set 3: L12 × 12 · Effort: Hard\n- Set 4: L12 × 12\n");
  });
  it("uses the exact active programme, version, workout days, and available exercise slugs", async () => {
    const review = await getWeeklyReview(prismaFor({
      id: "programme-id",
      slug: "upper-lower",
      name: "Upper/Lower",
      status: "ACTIVE",
      activeVersion: {
        versionNumber: 4,
        days: [
          { slug: "upper-a", name: "Upper A", workoutExercises: [{ exercise: { slug: "chest-press" } }] },
          { slug: "lower-a", name: "Lower A", workoutExercises: [] },
        ],
      },
    }, [
      { slug: "chest-press", name: "Chest Press", active: true, equipment: { available: true, type: "MACHINE" } },
      { slug: "push-up", name: "Push-up", active: true, equipment: null },
    ]), "user-1", "2026-08-24");

    expect(review.programSlug).toBe("upper-lower");
    expect(review.versionNumber).toBe(4);
    expect(review.report).toContain("Programme: Upper/Lower [upper-lower]");
    expect(review.report).toContain("Programme version: 4");
    expect(review.report).toContain("- Upper A [upper-a]");
    expect(review.report).toContain("- Lower A [lower-a]");
    expect(review.report).toContain("- Machines: chest-press");
    expect(review.report).toContain("- Bodyweight / no equipment: push-up");
    expect(review.report).toContain('"program": "upper-lower"');
    expect(review.report).toContain('"baseVersion": 4');
    expect(review.report).toContain('"day": "upper-a"');
    expect(review.report).toContain('"exercise": "chest-press"');
  });

  it("does not fabricate import identifiers when no programme is active", async () => {
    const review = await getWeeklyReview(prismaFor(null, [{ slug: "push-up", name: "Push-up", active: true, equipment: null }]), "user-1", "2026-08-24");

    expect(review.programSlug).toBeNull();
    expect(review.versionNumber).toBeNull();
    expect(review.report).toContain("No active programme is currently confirmed.");
    expect(review.report).toContain("Weekly schemaVersion 1 changes cannot be imported");
    expect(review.report).toContain("schemaVersion 2 JSON");
    expect(review.report).not.toContain('"program"');
    expect(review.report).not.toContain('"baseVersion"');
    expect(review.report).not.toContain("```json");
  });
});
