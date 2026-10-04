import { describe, expect, it, vi } from "vitest";
import { completeWorkoutSnapshot } from "@/server/complete-workout";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const snapshot = { id: id(1), programVersionId: id(2), status: "COMPLETED", completedAt: "2026-09-30T12:00:00.000Z", cardioStartedAt: "2026-09-30T11:00:00.000Z", cardioStoppedAt: "2026-09-30T11:10:00.000Z", exercises: [{ id: id(3), exerciseId: id(4), position: 1, plannedSets: 1, targetReps: 12, restSeconds: 60, autoRest: true, loadTrackingType: "MACHINE_LEVEL", sets: [{ id: id(5), setNumber: 1, targetReps: 12, actualReps: 12, weightKg: null, loadValue: 8, loadTrackingType: "MACHINE_LEVEL", completedAt: "2026-09-30T11:30:00.000Z" }] }] };
function fixture() {
  const exercise = { ...snapshot.exercises[0], exerciseNameSnapshot: "Chest Press", loadTrackingTypeSnapshot: "MACHINE_LEVEL", setLogs: [{ id: id(5), setNumber: 1 }] };
  const session = { id: id(1), programVersionId: id(2), status: "IN_PROGRESS", startedAt: new Date("2026-09-30T11:00:00Z"), cardioPlanned: true, exerciseSessions: [exercise] };
  const tx = { workoutSession: { findFirst: vi.fn().mockResolvedValue(session), update: vi.fn().mockResolvedValue({}) }, setLog: { findUnique: vi.fn().mockResolvedValue({ exerciseSessionId: id(3), setNumber: 1 }), update: vi.fn().mockResolvedValue({}) }, restPeriod: { updateMany: vi.fn().mockResolvedValue({}) } };
  return { tx, session };
}
describe("complete workout snapshot", () => {
  it("saves typed sets and cardio before completing the owned session", async () => {
    const { tx } = fixture();
    await completeWorkoutSnapshot(tx as never, "owner", id(1), snapshot);
    expect(tx.workoutSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: id(1), userId: "owner" } }));
    expect(tx.setLog.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ loadValue: 8, weightKg: null, loadTrackingType: "MACHINE_LEVEL" }) }));
    expect(tx.workoutSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", cardioDurationSeconds: 600 }) }));
  });
  it("does not complete an invalid snapshot and reports the specific set", async () => {
    const { tx } = fixture(); const bad = structuredClone(snapshot); bad.exercises[0].sets[0].loadValue = 8.5;
    await expect(completeWorkoutSnapshot(tx as never, "owner", id(1), bad)).rejects.toThrow("Chest Press, set 1: machine level must be a whole number");
    expect(tx.workoutSession.update).not.toHaveBeenCalled();
  });
  it("does not overwrite an already completed workout with a different completion request", async () => {
    const { tx, session } = fixture(); session.status = "COMPLETED";
    await expect(completeWorkoutSnapshot(tx as never, "owner", id(1), snapshot)).rejects.toThrow("another request");
    expect(tx.setLog.update).not.toHaveBeenCalled();
  });
  it("rejects a missing or foreign workout without writing data", async () => {
    const { tx } = fixture(); tx.workoutSession.findFirst.mockResolvedValue(null);
    await expect(completeWorkoutSnapshot(tx as never, "other-user", id(1), snapshot)).rejects.toThrow("not found");
    expect(tx.setLog.update).not.toHaveBeenCalled();
  });
  it("rejects a stale snapshot missing server sets", async () => {
    const { tx, session } = fixture(); session.exerciseSessions[0].setLogs.push({ id: id(6), setNumber: 2 });
    await expect(completeWorkoutSnapshot(tx as never, "owner", id(1), snapshot)).rejects.toThrow("missing server sets");
  });
});
