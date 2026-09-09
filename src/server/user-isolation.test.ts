import { describe, expect, it, vi } from "vitest";

import type { OfflineMutation } from "@/lib/offline-types";
import { previewCoachImport } from "@/server/coach-import";
import { getProgressOverview } from "@/server/progress";
import { replayOfflineMutations } from "@/server/sync";
import { startWorkout } from "@/server/workouts";

describe("personal data isolation", () => {
  it("scopes workout resume and progress history to the authenticated user", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "session-a", exerciseSessions: [] });
    expect(await startWorkout({ workoutSession: { findFirst } } as never, "user-a", "day-from-user-b")).toMatchObject({ id: "session-a", resumed: true });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-a", status: "IN_PROGRESS" } }));
    const findMany = vi.fn().mockResolvedValue([]);
    await getProgressOverview({ workoutSession: { findMany } } as never, "user-a", "all");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "user-a", status: "COMPLETED" }) }));
  });

  it("cannot start a workout day belonging to another user", async () => {
    const workoutDayFindFirst = vi.fn().mockResolvedValue(null);
    const prisma = {
      workoutSession: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: (callback: (tx: unknown) => unknown) => callback({ workoutDay: { findFirst: workoutDayFindFirst }, appSettings: { findUnique: vi.fn().mockResolvedValue(null) } }),
    };
    await expect(startWorkout(prisma as never, "user-a", "day-from-user-b")).rejects.toThrow("WORKOUT_DAY_NOT_ACTIVE");
    expect(workoutDayFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "day-from-user-b", programVersion: { program: { userId: "user-a" } } }),
    }));
  });

  it("scopes initial programme duplicate checks and active programme lookup to one user", async () => {
    const workoutProgramFindFirst = vi.fn().mockResolvedValue(null);
    const prisma = {
      programmeRequest: { findFirst: vi.fn().mockResolvedValue(null) },
      workoutProgram: { findFirst: workoutProgramFindFirst },
      appSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      exercise: { findMany: vi.fn().mockResolvedValue([{ id: "exercise-1", slug: "push-up", name: "Push-up", equipmentId: null, equipment: null, loadTrackingType: "BODYWEIGHT", loadEntryMode: "BODYWEIGHT" }]) },
    };
    const json = JSON.stringify({ schemaVersion: 2, operation: "create-programme", program: { slug: "starter", name: "Starter" }, days: [{ slug: "day-a", name: "Day A", rotationOrder: 1, exercises: [{ exercise: "push-up", sets: 3, targetReps: 12, load: null, restSeconds: 60, autoRest: true, position: 1 }] }] });
    await previewCoachImport(prisma as never, "user-a", json);
    expect(workoutProgramFindFirst.mock.calls[0][0].where).toMatchObject({ userId: "user-a", slug: "starter" });
    expect(workoutProgramFindFirst.mock.calls[1][0].where).toMatchObject({ userId: "user-a", isDemo: false });
    expect(prisma.appSettings.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-a" } }));
  });

  it("cannot patch a programme owned by another user", async () => {
    const workoutProgramFindFirst = vi.fn().mockResolvedValue(null);
    const prisma = { workoutProgram: { findFirst: workoutProgramFindFirst } };
    const json = JSON.stringify({ schemaVersion: 1, program: "private-programme", baseVersion: 1, changes: [{ action: "remove", day: "day-a", exercise: "push-up" }] });
    await expect(previewCoachImport(prisma as never, "user-a", json)).rejects.toThrow("Unknown programme");
    expect(workoutProgramFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-a", slug: "private-programme" } }));
  });

  it("binds offline replay and idempotency records to the authenticated user", async () => {
    const mutation: OfflineMutation = { id: "10000000-0000-4000-8000-000000000001", sequence: 1, type: "FINISH_WORKOUT", sessionId: "20000000-0000-4000-8000-000000000001", targetId: "20000000-0000-4000-8000-000000000001", payload: { completedAt: "2026-09-08T12:00:00.000Z" }, createdAt: "2026-09-08T12:00:00.000Z", attempts: 0, lastError: null };
    const transaction = { clientMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, workoutSession: { findFirst: vi.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction) };
    const result = await replayOfflineMutations(prisma as never, "user-a", [mutation]);
    expect(result[0]).toMatchObject({ status: "failed", error: "Workout session was not found" });
    expect(transaction.clientMutation.findUnique).toHaveBeenCalledWith({ where: { userId_id: { userId: "user-a", id: mutation.id } } });
    expect(transaction.workoutSession.findFirst).toHaveBeenCalledWith({ where: { id: mutation.sessionId, userId: "user-a" } });
  });

  it("rejects a client set identifier already owned by another exercise session", async () => {
    const mutation: OfflineMutation = { id: "10000000-0000-4000-8000-000000000002", sequence: 1, type: "ADD_SET", sessionId: "20000000-0000-4000-8000-000000000002", targetId: "30000000-0000-4000-8000-000000000002", payload: { exerciseSessionId: "40000000-0000-4000-8000-000000000002", setNumber: 4, targetReps: 12, actualReps: 12, loadValue: 10, loadTrackingType: "KILOGRAM" }, createdAt: "2026-09-08T12:00:00.000Z", attempts: 0, lastError: null };
    const create = vi.fn();
    const transaction = {
      clientMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      exerciseSession: { findFirst: vi.fn().mockResolvedValue({ id: mutation.payload.exerciseSessionId, loadTrackingTypeSnapshot: "KILOGRAM" }) },
      setLog: { findUnique: vi.fn().mockResolvedValue({ exerciseSessionId: "another-users-exercise-session" }), create },
    };
    const prisma = { $transaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction) };
    const result = await replayOfflineMutations(prisma as never, "user-a", [mutation]);
    expect(result[0]).toMatchObject({ status: "failed", error: "Set identifier belongs to another exercise session" });
    expect(transaction.exerciseSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workoutSession: { userId: "user-a", status: "IN_PROGRESS" } }) }));
    expect(create).not.toHaveBeenCalled();
  });
});
