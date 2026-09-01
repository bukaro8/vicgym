import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { getWeeklyReview } from "@/server/weekly-review";

function prismaFor(activeProgram: unknown, exercises: unknown[] = []) {
  return {
    workoutSession: { findMany: vi.fn().mockResolvedValue([]) },
    appSettings: { findUnique: vi.fn().mockResolvedValue({ activeProgram }) },
    exercise: { findMany: vi.fn().mockResolvedValue(exercises) },
    exerciseSession: { findMany: vi.fn() },
  } as unknown as PrismaClient;
}

describe("weekly review coaching identifiers", () => {
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
    ]), "2026-08-24");

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
    const review = await getWeeklyReview(prismaFor(null, [{ slug: "push-up", name: "Push-up", active: true, equipment: null }]), "2026-08-24");

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
