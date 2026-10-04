import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../src/lib/prisma";
import { replayOfflineMutations } from "../src/server/sync";
import type { OfflineMutation } from "../src/lib/offline-types";

async function main() {
  const url = process.env.DATABASE_URL;
  assert(url && new URL(url).pathname.endsWith("_test"), "This verifier requires an isolated database ending in _test");
  const prisma = getPrisma();
  const userId = randomUUID();
  try {
    const catalogue = await prisma.exercise.findFirstOrThrow({ where: { slug: "chest-press", loadTrackingType: "MACHINE_LEVEL" } });
    await prisma.user.create({ data: { id: userId, email: `completion-${userId}@example.invalid` } });
    const program = await prisma.workoutProgram.create({ data: { userId, slug: "completion-test", name: "Completion verifier", versions: { create: { versionNumber: 1, source: "IMPORT", days: { create: { slug: "test-day", name: "Test day", rotationOrder: 1 } } } } }, include: { versions: { include: { days: true } } } });
    const version = program.versions[0];
    const session = await prisma.workoutSession.create({ data: { userId, programVersionId: version.id, workoutDayId: version.days[0].id, workoutDayNameSnapshot: "Test day", startedAt: new Date("2026-09-30T10:00:00Z"), cardioPlanned: true, exerciseSessions: { create: { exerciseId: catalogue.id, position: 1, exerciseNameSnapshot: catalogue.name, plannedSets: 2, targetReps: 12, restSeconds: 60, autoRest: true, loadTrackingTypeSnapshot: "MACHINE_LEVEL", loadEntryModeSnapshot: "STACK_TOTAL", setLogs: { create: [1, 2].map((setNumber) => ({ setNumber, targetReps: 12, loadTrackingType: "MACHINE_LEVEL" })) } } } }, include: { exerciseSessions: { include: { setLogs: { orderBy: { setNumber: "asc" } } } } } });
    const exercise = session.exerciseSessions[0];
    const snapshot = { id: session.id, programVersionId: version.id, status: "COMPLETED", completedAt: "2026-09-30T11:00:00.000Z", cardioStartedAt: "2026-09-30T10:00:00.000Z", cardioStoppedAt: "2026-09-30T10:10:00.000Z", exercises: [{ id: exercise.id, exerciseId: catalogue.id, position: 1, plannedSets: 2, targetReps: 12, restSeconds: 60, autoRest: true, loadTrackingType: "MACHINE_LEVEL", sets: exercise.setLogs.map((set) => ({ id: set.id, setNumber: set.setNumber, targetReps: 12, actualReps: 12, weightKg: null, loadValue: 8, loadTrackingType: "MACHINE_LEVEL", completedAt: "2026-09-30T10:30:00.000Z" })) }] };
    const mutation = (value: typeof snapshot): OfflineMutation => ({ id: randomUUID(), sequence: 1, sessionId: session.id, targetId: session.id, type: "COMPLETE_WORKOUT", payload: { snapshot: value }, createdAt: new Date().toISOString(), attempts: 0, lastError: null });
    const invalid = structuredClone(snapshot); invalid.exercises[0].sets[1].loadValue = 8.5;
    const failure = await replayOfflineMutations(prisma, userId, [mutation(invalid)]);
    assert.equal(failure[0].status, "failed");
    assert.equal((await prisma.setLog.findUniqueOrThrow({ where: { id: exercise.setLogs[0].id } })).actualReps, null, "earlier set writes must roll back if a later set is invalid");
    assert.equal((await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } })).status, "IN_PROGRESS");
    const valid = mutation(snapshot);
    assert.equal((await replayOfflineMutations(prisma, userId, [valid]))[0].status, "applied");
    assert.equal((await replayOfflineMutations(prisma, userId, [valid]))[0].status, "duplicate", "lost acknowledgement must be safely replayable");
    const saved = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(saved.status, "COMPLETED"); assert.equal(saved.cardioDurationSeconds, 600);
    assert.equal((await replayOfflineMutations(prisma, userId, [mutation(snapshot)]))[0].status, "failed", "different completion request must not overwrite history");
    assert.equal((await replayOfflineMutations(prisma, randomUUID(), [mutation(snapshot)]))[0].status, "failed", "ownership must be enforced");
    console.log("Verified atomic snapshot rollback, typed loads, cardio, exact completion receipt replay, history preservation, and user isolation.");
  } finally {
    await prisma.workoutSession.deleteMany({ where: { userId } });
    await prisma.workoutProgram.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
