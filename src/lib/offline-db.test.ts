import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearPrivateOfflineData, getOfflineOutbox, getOfflineTimer, getOfflineWorkout, putOfflineTimer, putOfflineWorkout, queueOfflineMutation } from "@/lib/offline-db";
import type { OfflineTimer, OfflineWorkout } from "@/lib/offline-types";
import { saveSetLocally, updateTimerLocally } from "@/lib/offline-workout";

const workout: OfflineWorkout = { schemaVersion: 1, id: "session-1", programId: "program-1", programSlug: "demo-upper-lower", programName: "Demo Upper/Lower", programVersionId: "version-1", programVersionNumber: 1, workoutDayId: "day-1", workoutDaySlug: "upper-a", status: "IN_PROGRESS", workoutDayName: "Demo Upper A", startedAt: "2026-08-31T09:00:00.000Z", completedAt: null, currentExerciseId: "exercise-session-1", updatedAt: "2026-08-31T09:00:00.000Z", exercises: [{ id: "exercise-session-1", exerciseId: "exercise-1", slug: "chest-press", name: "Chest Press", position: 1, plannedSets: 3, targetReps: 12, restSeconds: 120, autoRest: true, equipmentName: "Chest Press", imagePath: "/media/equipment/chest-press-1280.webp", sets: [{ id: "set-1", setNumber: 1, targetReps: 12, actualReps: 12, weightKg: 30, completedAt: null }] }] };

describe("offline database", () => {
  beforeEach(async () => { vi.restoreAllMocks(); await clearPrivateOfflineData(); });

  it("persists workout snapshots and keeps outbox mutations in deterministic order", async () => {
    await putOfflineWorkout(workout);
    await queueOfflineMutation({ id: "mutation-b", type: "UPSERT_SET", sessionId: workout.id, targetId: "set-1", payload: { actualReps: 12 } });
    await queueOfflineMutation({ id: "mutation-a", type: "FINISH_WORKOUT", sessionId: workout.id, targetId: workout.id, payload: { completedAt: "2026-08-31T10:00:00.000Z" } });
    expect(await getOfflineWorkout(workout.id)).toEqual(workout);
    expect((await getOfflineOutbox()).map((item) => [item.id, item.sequence])).toEqual([["mutation-b", 1], ["mutation-a", 2]]);
  });

  it("preserves exact paused milliseconds across reloads", async () => {
    const now = new Date("2026-08-31T09:00:30.250Z").getTime(); vi.spyOn(Date, "now").mockReturnValue(now);
    const timer: OfflineTimer = { id: "timer-1", sessionId: workout.id, setLogId: "set-1", status: "RUNNING", configuredSeconds: 120, startedAt: "2026-08-31T09:00:00.000Z", endsAt: new Date(now + 89_750).toISOString(), pausedAt: null, pausedRemainingMs: null, exerciseName: "Chest Press", completedSetNumber: 1, nextSetId: null, updatedAt: "2026-08-31T09:00:00.000Z" };
    await putOfflineTimer(timer); await updateTimerLocally("different-session", "PAUSE");
    expect(await getOfflineTimer()).toMatchObject({ status: "PAUSED", endsAt: null, pausedRemainingMs: 89_750 });
    expect((await getOfflineOutbox())[0]).toMatchObject({ type: "UPSERT_TIMER", sessionId: workout.id, targetId: timer.id });
  });

  it("binds a new rest timer and its queued mutations to the workout that owns the set", async () => {
    await putOfflineWorkout(workout);
    const result = await saveSetLocally({ sessionId: workout.id, exerciseSessionId: "exercise-session-1", setId: "set-1", actualReps: 12, loadValue: 30, completed: true });

    expect(result.timer).toMatchObject({ sessionId: workout.id, setLogId: "set-1" });
    expect(await getOfflineTimer()).toMatchObject({ sessionId: workout.id, setLogId: "set-1" });
    expect((await getOfflineOutbox()).map((item) => [item.type, item.sessionId])).toEqual([
      ["UPSERT_SET", workout.id],
      ["UPSERT_TIMER", workout.id],
    ]);
  });

  it("clears the workout, timer, and outbox on explicit private-data reset", async () => {
    await putOfflineWorkout(workout); await putOfflineTimer({ id: "timer-1", setLogId: "set-1", status: "PAUSED", configuredSeconds: 120, startedAt: workout.startedAt, endsAt: null, pausedAt: workout.startedAt, pausedRemainingMs: 60_125, exerciseName: "Chest Press", completedSetNumber: 1, nextSetId: null, updatedAt: workout.updatedAt }); await queueOfflineMutation({ type: "UPSERT_SET", sessionId: workout.id, targetId: "set-1", payload: {} });
    await clearPrivateOfflineData();
    expect(await getOfflineWorkout(workout.id)).toBeNull(); expect(await getOfflineTimer()).toBeNull(); expect(await getOfflineOutbox()).toEqual([]);
  });
});
