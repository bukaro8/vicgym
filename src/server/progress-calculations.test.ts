import { describe, expect, it } from "vitest";

import { performanceFromSession, periodStart, progressChange, setVolume, weeklyBuckets, type CompletedExerciseSession } from "@/server/progress-calculations";

const completedAt = new Date("2026-08-30T10:00:00.000Z");
function session(overrides: Partial<CompletedExerciseSession> = {}): CompletedExerciseSession {
  return { exerciseId: "row", exerciseSlug: "one-arm-dumbbell-row", exerciseName: "One-arm Dumbbell Row", completedAt, startedAt: new Date("2026-08-30T09:00:00.000Z"), loadTrackingType: "KILOGRAM", loadEntryMode: "PER_DUMBBELL", loadMultiplier: 2, primaryMuscles: ["Lats"], secondaryMuscles: ["Biceps"], sets: [{ weightKg: null, loadValue: 10, actualReps: 12 }, { weightKg: null, loadValue: 10, actualReps: 11 }], ...overrides };
}

describe("progress calculations", () => {
  it("keeps a 10 kg per-dumbbell row in the kilogram series and applies its multiplier", () => {
    const performance = performanceFromSession(session({ sets: [{ weightKg: null, loadValue: 10, actualReps: 12 }] }));
    expect(performance.highestWeightKg).toBe(10);
    expect(performance.highestMachineLevel).toBeNull();
    expect(performance.volumeKgReps).toBe(240);
    expect(setVolume({ weightKg: null, loadValue: 10, actualReps: 12 }, "KILOGRAM", 2)).toBe(240);
  });

  it("stores and compares Chest Press L8 to L9 as machine levels, never kilograms", () => {
    const previous = performanceFromSession(session({ exerciseSlug: "chest-press", loadTrackingType: "MACHINE_LEVEL", loadEntryMode: "STACK_TOTAL", loadMultiplier: 1, sets: [{ weightKg: null, loadValue: 8, actualReps: 12 }] }));
    const current = performanceFromSession(session({ exerciseSlug: "chest-press", loadTrackingType: "MACHINE_LEVEL", loadEntryMode: "STACK_TOTAL", loadMultiplier: 1, sets: [{ weightKg: null, loadValue: 9, actualReps: 12 }] }));
    expect(previous.highestMachineLevel).toBe(8);
    expect(previous.highestWeightKg).toBeNull();
    expect(previous.volumeKgReps).toBeNull();
    expect(progressChange(current, previous)).toBe("machine level increased");
  });

  it("does not compare legacy machine kg history with a new machine-level session", () => {
    const legacy = performanceFromSession(session({ loadTrackingType: null, loadEntryMode: null, sets: [{ weightKg: 8, loadValue: null, actualReps: 12 }] }));
    const level = performanceFromSession(session({ loadTrackingType: "MACHINE_LEVEL", loadEntryMode: "STACK_TOTAL", sets: [{ weightKg: null, loadValue: 8, actualReps: 12 }] }));
    expect(progressChange(level, legacy)).toBe("insufficient compatible history");
  });

  it("does not fabricate kilogram volume for bodyweight or incomplete sets", () => {
    expect(setVolume({ weightKg: null, loadValue: null, actualReps: 12 }, "BODYWEIGHT", 1)).toBeNull();
    expect(setVolume({ weightKg: null, loadValue: 20, actualReps: null }, "KILOGRAM", 1)).toBeNull();
  });

  it("uses Europe/London Monday boundaries for the selected period and weekly buckets", () => {
    expect(periodStart("4", new Date("2026-08-30T12:00:00.000Z"))?.toISOString()).toBe("2026-08-02T23:00:00.000Z");
    const buckets = weeklyBuckets([{ completedAt: new Date("2026-08-24T10:00:00.000Z") }, { completedAt: new Date("2026-08-30T10:00:00.000Z") }], "4", new Date("2026-08-30T12:00:00.000Z"));
    expect(buckets.at(-1)?.items).toHaveLength(2);
  });
});
