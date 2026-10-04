import { describe, expect, it, vi } from "vitest";

import { replayOfflineMutations, resolveTimerReplay, validatedSyncLoad } from "@/server/sync";

describe("offline sync load compatibility", () => {
  it("recovers a pending legacy field using a typed machine session snapshot", () => {
    expect(validatedSyncLoad({ weightKg: 8 }, { loadTrackingTypeSnapshot: "MACHINE_LEVEL" })).toEqual({
      load: { weightKg: null, loadValue: 8, loadTrackingType: "MACHINE_LEVEL" },
      recoveredLegacyField: true,
    });
  });

  it("recovers kilograms without changing their unit", () => {
    expect(validatedSyncLoad({ weightKg: 10 }, { loadTrackingTypeSnapshot: "KILOGRAM" })).toEqual({
      load: { weightKg: null, loadValue: 10, loadTrackingType: "KILOGRAM" },
      recoveredLegacyField: true,
    });
  });

  it("keeps a historical legacy session in its legacy weight field", () => {
    expect(validatedSyncLoad({ weightKg: 30 }, { loadTrackingTypeSnapshot: null })).toEqual({
      load: { weightKg: 30, loadValue: null, loadTrackingType: null },
      recoveredLegacyField: false,
    });
  });

  it("rejects ambiguous or incompatible pending loads", () => {
    expect(() => validatedSyncLoad({ weightKg: 8, loadValue: 8 }, { loadTrackingTypeSnapshot: "MACHINE_LEVEL" })).toThrow("both weightKg and loadValue");
    expect(() => validatedSyncLoad({ weightKg: 5 }, { loadTrackingTypeSnapshot: "BODYWEIGHT" })).toThrow("does not accept an external load");
    expect(() => validatedSyncLoad({ loadValue: 8, loadTrackingType: "KILOGRAM" }, { loadTrackingTypeSnapshot: "MACHINE_LEVEL" })).toThrow("does not match session type");
    expect(() => validatedSyncLoad({ weightKg: 8.5 }, { loadTrackingTypeSnapshot: "MACHINE_LEVEL" })).toThrow("integer");
  });
});

describe("offline timer replay compatibility", () => {
  it("keeps same-session timers unchanged", () => {
    expect(resolveTimerReplay("RUNNING", "session-1", "session-1")).toEqual({ action: "apply", status: "RUNNING", recoveredSessionMismatch: false });
  });

  it("turns a cross-session active timer into a safe historical skip", () => {
    expect(resolveTimerReplay("RUNNING", "session-2", "session-1")).toEqual({ action: "apply", status: "SKIPPED", recoveredSessionMismatch: true });
  });

  it("acknowledges an orphan timer so it cannot block later workout data", () => {
    expect(resolveTimerReplay("SKIPPED", "session-1", null)).toEqual({ action: "orphan" });
  });
});

describe("ad-hoc exercise replay", () => {
  const mutation = { id: "10000000-0000-4000-8000-000000000001", sequence: 1, type: "ADD_EXERCISE" as const, sessionId: "20000000-0000-4000-8000-000000000001", targetId: "30000000-0000-4000-8000-000000000001", createdAt: "2026-09-08T12:00:00.000Z", attempts: 0, lastError: null, payload: { exerciseId: "40000000-0000-4000-8000-000000000001", position: 2, plannedSets: 3, targetReps: 12, restSeconds: 90, autoRest: true, sets: [1, 2, 3].map((setNumber) => ({ id: `50000000-0000-4000-8000-00000000000${setNumber}`, setNumber, targetReps: 12, actualReps: 12 })) } };

  it("creates a session-only exercise using authoritative catalogue load snapshots", async () => {
    const create = vi.fn().mockResolvedValue({ id: mutation.targetId });
    const transaction = { clientMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) }, workoutSession: { findFirst: vi.fn().mockResolvedValue({ id: mutation.sessionId, exerciseSessions: [{ exerciseId: "existing", position: 1 }] }) }, exercise: { findFirst: vi.fn().mockResolvedValue({ id: mutation.payload.exerciseId, name: "Chest Press", loadTrackingType: "MACHINE_LEVEL", loadEntryMode: "STACK_TOTAL", loadMultiplier: 1 }) }, exerciseSession: { create } };
    const prisma = { $transaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction) };
    expect(await replayOfflineMutations(prisma as never, "user-1", [mutation])).toEqual([expect.objectContaining({ status: "applied", type: "ADD_EXERCISE" })]);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ isAdHoc: true, loadTrackingTypeSnapshot: "MACHINE_LEVEL", loadEntryModeSnapshot: "STACK_TOTAL", setLogs: { create: expect.arrayContaining([expect.objectContaining({ loadTrackingType: "MACHINE_LEVEL", loadValue: null, weightKg: null })]) } }) });
  });

  it("rejects adding a catalogue exercise already present in the session", async () => {
    const create = vi.fn();
    const transaction = { clientMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, workoutSession: { findFirst: vi.fn().mockResolvedValue({ id: mutation.sessionId, exerciseSessions: [{ exerciseId: mutation.payload.exerciseId, position: 1 }] }) }, exercise: { findFirst: vi.fn() }, exerciseSession: { create } };
    const prisma = { $transaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction) };
    expect(await replayOfflineMutations(prisma as never, "user-1", [mutation])).toEqual([expect.objectContaining({ status: "failed", error: "Exercise is already part of this workout session" })]);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("stale offline mutation recovery", () => {
  it("acknowledges an invalid fractional machine-level update so it cannot block workout completion", async () => {
    const mutation = { id: "10000000-0000-4000-8000-000000000010", sequence: 32, type: "UPSERT_SET" as const, sessionId: "20000000-0000-4000-8000-000000000010", targetId: "30000000-0000-4000-8000-000000000010", createdAt: "2026-09-30T18:00:00.000Z", attempts: 0, lastError: null, payload: { actualReps: 12, loadValue: 8.5, loadTrackingType: "MACHINE_LEVEL", completedAt: "2026-09-30T18:00:00.000Z", notes: null } };
    const failedRecord = vi.fn().mockResolvedValue({});
    const transaction = { clientMutation: { findUnique: vi.fn().mockResolvedValue(null), create: failedRecord }, workoutSession: { findFirst: vi.fn().mockResolvedValue({ status: "IN_PROGRESS" }) }, setLog: { findFirst: vi.fn().mockResolvedValue({ id: mutation.targetId, exerciseSession: { loadTrackingTypeSnapshot: "MACHINE_LEVEL", workoutSession: { status: "IN_PROGRESS" } } }) } };
    const prisma = { $transaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction) };

    await expect(replayOfflineMutations(prisma as never, "user-1", [mutation])).resolves.toEqual([expect.objectContaining({ status: "acknowledged", error: "Machine level must be an integer" })]);
    expect(failedRecord).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "FAILED", errorMessage: "Machine level must be an integer" }) });
  });

  it("acknowledges a late extra-set mutation after a workout is completed", async () => {
    const mutation = { id: "10000000-0000-4000-8000-000000000011", sequence: 53, type: "ADD_SET" as const, sessionId: "20000000-0000-4000-8000-000000000011", targetId: "30000000-0000-4000-8000-000000000011", createdAt: "2026-09-30T18:00:00.000Z", attempts: 0, lastError: null, payload: { exerciseSessionId: "40000000-0000-4000-8000-000000000011", setNumber: 4, targetReps: 12, actualReps: 12, loadValue: null, loadTrackingType: "MACHINE_LEVEL" } };
    const failedRecord = vi.fn().mockResolvedValue({});
    const transaction = { clientMutation: { findUnique: vi.fn().mockResolvedValue(null), create: failedRecord }, workoutSession: { findFirst: vi.fn().mockResolvedValue({ status: "COMPLETED" }) } };
    const prisma = { $transaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction) };

    await expect(replayOfflineMutations(prisma as never, "user-1", [mutation])).resolves.toEqual([expect.objectContaining({ status: "acknowledged", error: "Workout was already completed before this extra set was saved" })]);
    expect(failedRecord).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "FAILED" }) });
  });

  it("acknowledges an orphaned set update after a workout is completed", async () => {
    const mutation = { id: "10000000-0000-4000-8000-000000000012", sequence: 39, type: "UPSERT_SET" as const, sessionId: "20000000-0000-4000-8000-000000000012", targetId: "30000000-0000-4000-8000-000000000012", createdAt: "2026-09-30T18:00:00.000Z", attempts: 0, lastError: null, payload: { actualReps: 12, loadValue: null, loadTrackingType: "MACHINE_LEVEL", completedAt: "2026-09-30T18:00:00.000Z", notes: null } };
    const failedRecord = vi.fn().mockResolvedValue({});
    const transaction = { clientMutation: { findUnique: vi.fn().mockResolvedValue(null), create: failedRecord }, workoutSession: { findFirst: vi.fn().mockResolvedValue({ status: "COMPLETED" }) }, setLog: { findFirst: vi.fn() } };
    const prisma = { $transaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction) };

    await expect(replayOfflineMutations(prisma as never, "user-1", [mutation])).resolves.toEqual([expect.objectContaining({ status: "acknowledged", error: "Workout was already completed before this set update was saved" })]);
    expect(transaction.setLog.findFirst).not.toHaveBeenCalled();
  });
});
