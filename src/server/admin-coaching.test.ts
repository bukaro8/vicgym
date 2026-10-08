import { describe, expect, it, vi } from "vitest";
import { adminCoachApply, adminCoachPreview, adminCoachReport, coachingTarget } from "./admin-coaching";
import { getWeeklyReview } from "./weekly-review";
vi.mock("./weekly-review", () => ({ getWeeklyReview: vi.fn().mockResolvedValue({ report: "Owner report" }) }));
const admin = { id: "admin", email: "admin@example.com", role: "ADMIN" } as const;
const ordinary = { id: "other", email: "other@example.com", role: "USER" } as const;
function fixture(status = "ACTIVE") {
  const program = { id: "p", slug: "small-gym", name: "Small Gym", status: "ACTIVE", activeVersion: { versionNumber: 1, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, workoutExercises: [] }] } };
  const db = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: "owner", email: "owner@example.com", role: "USER", status }) },
    workoutProgram: { findFirst: vi.fn().mockResolvedValue(program), updateMany: vi.fn(), update: vi.fn() },
    appSettings: { findUnique: vi.fn().mockResolvedValue({ activeProgram: program }), upsert: vi.fn() },
    programVersion: { create: vi.fn().mockResolvedValue({ id: "v2", versionNumber: 2 }), findFirst: vi.fn().mockResolvedValue({ id: "v2" }) },
    exercise: { findMany: vi.fn().mockResolvedValue([{ id: "pushup", slug: "push-up", name: "Push-up", equipmentId: null, loadTrackingType: "BODYWEIGHT", loadEntryMode: "BODYWEIGHT" }]) },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  };
  return { db, program };
}
const patch = JSON.stringify({ schemaVersion: 1, program: "small-gym", baseVersion: 1, changes: [{ action: "upsert", day: "upper-a", exercise: "push-up", sets: 3, targetReps: 12, load: null, restSeconds: 60, autoRest: true, position: 1 }] });
describe("admin coaching ownership", () => {
  it("rejects USER before profile lookup, report, preview or apply", async () => {
    const { db } = fixture();
    for (const operation of [() => coachingTarget(db as never, ordinary, "owner"), () => adminCoachReport(db as never, ordinary, "owner"), () => adminCoachPreview(db as never, ordinary, "owner", patch), () => adminCoachApply(db as never, ordinary, "owner", patch)]) await expect(operation()).rejects.toThrow("Administrator access required");
    expect(db.user.findUnique).not.toHaveBeenCalled(); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("reports for the resolved owner and rejects nonexistent/admin targets", async () => {
    const { db } = fixture();
    await adminCoachReport(db as never, admin, "owner", "2026-10-05");
    expect(getWeeklyReview).toHaveBeenCalledWith(db, "owner", "2026-10-05");
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "owner" } }));
    db.user.findUnique.mockResolvedValueOnce(null as never);
    await expect(coachingTarget(db as never, admin, "missing")).rejects.toThrow("not found");
    db.user.findUnique.mockResolvedValueOnce({ ...admin, status: "ACTIVE" } as never);
    await expect(coachingTarget(db as never, admin, "admin")).rejects.toThrow("not found");
  });
  it("previews without writes, then creates a new version for the target without mutating old history", async () => {
    const { db, program } = fixture(); const before = structuredClone(program);
    const preview = await adminCoachPreview(db as never, admin, "owner", patch);
    expect(preview.nextVersion).toBe(2); expect(db.programVersion.create).not.toHaveBeenCalled();
    await adminCoachApply(db as never, admin, "owner", patch);
    expect(program).toEqual(before);
    expect(db.programVersion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ programId: "p", versionNumber: 2 }) });
    expect(db.appSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner" } }));
    expect(db.workoutProgram.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner" }) }));
  });
  it("rejects invalid, stale and another programme's patches", async () => {
    const { db } = fixture();
    for (const json of ["{}", patch.replace('"baseVersion":1', '"baseVersion":9')]) await expect(adminCoachPreview(db as never, admin, "owner", json)).rejects.toThrow();
    db.workoutProgram.findFirst.mockResolvedValueOnce(null as never);
    await expect(adminCoachPreview(db as never, admin, "owner", patch.replace('"small-gym"', '"someone-else"'))).rejects.toThrow();
    expect(db.workoutProgram.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner", slug: "someone-else" }) }));
    expect(db.programVersion.create).not.toHaveBeenCalled();
  });
  it("allows disabled account review but blocks writes, including inside apply transaction", async () => {
    const { db } = fixture("DISABLED");
    await expect(coachingTarget(db as never, admin, "owner")).resolves.toMatchObject({ status: "DISABLED" });
    await expect(adminCoachPreview(db as never, admin, "owner", patch)).rejects.toThrow("Reactivate");
    await expect(adminCoachApply(db as never, admin, "owner", patch)).rejects.toThrow("Reactivate");
    expect(db.programVersion.create).not.toHaveBeenCalled();
  });
});
