import assert from "node:assert/strict";

import type { OfflineMutation } from "../src/lib/offline-types";
import { getPrisma } from "../src/lib/prisma";
import { replayOfflineMutations } from "../src/server/sync";

const ids = {
  session: "60000000-0000-4000-8000-000000000001",
  exerciseSession: "60000000-0000-4000-8000-000000000002",
  set: "60000000-0000-4000-8000-000000000003",
  timer: "60000000-0000-4000-8000-000000000004",
  setMutation: "60000000-0000-4000-8000-000000000005",
  timerMutation: "60000000-0000-4000-8000-000000000006",
  finishMutation: "60000000-0000-4000-8000-000000000007",
  failedMutation: "60000000-0000-4000-8000-000000000008",
  blockedMutation: "60000000-0000-4000-8000-000000000009",
} as const;

function mutation(input: Pick<OfflineMutation, "id" | "sequence" | "type" | "targetId" | "payload">): OfflineMutation { return { ...input, sessionId: ids.session, createdAt: "2026-08-31T09:00:00.000Z", attempts: 0, lastError: null }; }

async function main() {
  const databaseUrl = process.env.DATABASE_URL; assert(databaseUrl, "DATABASE_URL is required"); assert(new URL(databaseUrl).pathname.endsWith("_test"), "Phase 6 verification refuses to modify a non-test database"); const prisma = getPrisma();
  const day = await prisma.workoutDay.findFirst({ include: { workoutExercises: { orderBy: { position: "asc" }, take: 1 } } }); const planned = day?.workoutExercises[0]; assert(day && planned, "Seeded test programme is required");
  await prisma.workoutSession.create({ data: { id: ids.session, programVersionId: day.programVersionId, workoutDayId: day.id, workoutDayNameSnapshot: day.name, exerciseSessions: { create: { id: ids.exerciseSession, exerciseId: planned.exerciseId, position: 1, exerciseNameSnapshot: "Phase 6 isolated sync fixture", plannedSets: 1, targetReps: 12, restSeconds: 120, autoRest: true, loadTrackingTypeSnapshot: planned.loadTrackingTypeSnapshot, loadEntryModeSnapshot: planned.loadEntryModeSnapshot, loadMultiplierSnapshot: 1, setLogs: { create: { id: ids.set, setNumber: 1, targetReps: 12, actualReps: 12, loadTrackingType: planned.loadTrackingTypeSnapshot } } } } } });
  const batch: OfflineMutation[] = [
    mutation({ id: ids.setMutation, sequence: 1, type: "UPSERT_SET", targetId: ids.set, payload: { actualReps: 11, loadValue: 8, weightKg: null, loadTrackingType: "MACHINE_LEVEL", completedAt: "2026-08-31T09:01:00.000Z", notes: null } }),
    mutation({ id: ids.timerMutation, sequence: 2, type: "UPSERT_TIMER", targetId: ids.timer, payload: { setLogId: ids.set, status: "SKIPPED", configuredSeconds: 120, startedAt: "2026-08-31T09:01:00.000Z", endsAt: null, pausedAt: null, pausedRemainingMs: null, updatedAt: "2026-08-31T09:01:15.125Z" } }),
    mutation({ id: ids.finishMutation, sequence: 3, type: "FINISH_WORKOUT", targetId: ids.session, payload: { completedAt: "2026-08-31T09:02:00.000Z", confirmIncomplete: true } }),
  ];
  try {
    assert.deepEqual((await replayOfflineMutations(prisma, batch)).map((item) => item.status), ["applied", "applied", "applied"]); assert.deepEqual((await replayOfflineMutations(prisma, batch)).map((item) => item.status), ["duplicate", "duplicate", "duplicate"]);
    const saved = await prisma.workoutSession.findUniqueOrThrow({ where: { id: ids.session }, include: { exerciseSessions: { include: { setLogs: { include: { restPeriod: true } } } } } }); const savedSet = saved.exerciseSessions[0].setLogs[0]; assert.equal(saved.status, "COMPLETED"); assert.equal(savedSet.actualReps, 11); assert.equal(Number(savedSet.loadValue), 8); assert.equal(savedSet.weightKg, null); assert.equal(savedSet.restPeriod?.status, "SKIPPED"); assert.equal(await prisma.clientMutation.count({ where: { id: { in: [ids.setMutation, ids.timerMutation, ids.finishMutation] } } }), 3, "replay must not duplicate idempotency records");
    const failed = await replayOfflineMutations(prisma, [mutation({ id: ids.failedMutation, sequence: 4, type: "UPSERT_SET", targetId: "60000000-0000-4000-8000-999999999999", payload: { actualReps: 12, weightKg: null, completedAt: null } }), mutation({ id: ids.blockedMutation, sequence: 5, type: "FINISH_WORKOUT", targetId: ids.session, payload: { completedAt: "2026-08-31T09:03:00.000Z" } })]); assert.equal(failed.length, 1); assert.equal(failed[0].status, "failed"); assert.equal(await prisma.clientMutation.count({ where: { id: ids.blockedMutation } }), 0, "dependent work after a failure must remain unapplied");
    console.log("Verified PostgreSQL ordered replay, exact-once idempotency, completed state, timer uniqueness, and stop-on-first-failure behavior.");
  } finally { await prisma.clientMutation.deleteMany({ where: { id: { in: Object.values(ids) } } }); await prisma.workoutSession.deleteMany({ where: { id: ids.session } }); await prisma.$disconnect(); }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
