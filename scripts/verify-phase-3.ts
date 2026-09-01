import assert from "node:assert/strict";

import { getPrisma } from "../src/lib/prisma";
import { setActiveProgramme } from "../src/server/active-programme";
import { applyTimerAction, getActiveRestTimer, startRestForSet } from "../src/server/rest-timers";
import { startWorkout } from "../src/server/workouts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, "DATABASE_URL is required");
  assert(new URL(databaseUrl).pathname.endsWith("_test"), "Phase 3 verification refuses to modify a non-test database");
  const prisma = getPrisma();

  await prisma.workoutSession.deleteMany();
  const program = await prisma.workoutProgram.findUnique({ where: { slug: "demo-four-day" }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { days: { orderBy: { rotationOrder: "asc" } } } } } });
  assert(program && program.versions[0]);
  const version = program.versions[0];
  await setActiveProgramme(prisma, program.id, version.id);

  const first = await startWorkout(prisma, version.days[0].id);
  const duplicate = await startWorkout(prisma, version.days[1].id);
  assert.equal(duplicate.id, first.id, "a second start must resume the existing workout");
  const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: first.id }, include: { exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: { orderBy: { setNumber: "asc" } } } } } });
  assert.equal(session.programVersionId, version.id);
  assert.equal(session.workoutDayNameSnapshot, version.days[0].name);
  assert(session.exerciseSessions.length > 0);
  assert(session.exerciseSessions.every((exercise) => exercise.setLogs.length >= exercise.plannedSets));
  assert(session.exerciseSessions.flatMap((exercise) => exercise.setLogs).every((set) => set.targetReps === 12 && set.actualReps === 12 && set.weightKg === null));

  const [setOne, setTwo] = session.exerciseSessions[0].setLogs;
  const base = new Date("2026-08-30T18:00:00.000Z");
  await prisma.setLog.update({ where: { id: setOne.id }, data: { loadValue: 8, actualReps: 12, completedAt: base } });
  const timerOne = await startRestForSet(prisma, setOne.id, base);
  assert(timerOne && timerOne.endsAt);
  const paused = await applyTimerAction(prisma, timerOne.id, "PAUSE", new Date(base.getTime() + 1_234));
  assert(paused?.status === "PAUSED" && paused.pausedRemainingMs !== null);
  const exactPausedMs = paused.pausedRemainingMs;
  const resumedAt = new Date(base.getTime() + 9_876);
  const resumed = await applyTimerAction(prisma, timerOne.id, "RESUME", resumedAt);
  assert.equal(new Date(resumed!.endsAt!).getTime(), resumedAt.getTime() + exactPausedMs);
  const added = await applyTimerAction(prisma, timerOne.id, "ADD_15", resumedAt);
  assert.equal(new Date(added!.endsAt!).getTime(), resumedAt.getTime() + exactPausedMs + 15_000);
  const subtracted = await applyTimerAction(prisma, timerOne.id, "SUBTRACT_15", resumedAt);
  assert.equal(new Date(subtracted!.endsAt!).getTime(), resumedAt.getTime() + exactPausedMs);

  await prisma.setLog.update({ where: { id: setTwo.id }, data: { loadValue: 9, actualReps: 10, completedAt: new Date(base.getTime() + 20_000) } });
  const timerTwo = await startRestForSet(prisma, setTwo.id, new Date(base.getTime() + 20_000));
  assert(timerTwo && timerTwo.id !== timerOne.id);
  assert.equal((await prisma.restPeriod.findUniqueOrThrow({ where: { id: timerOne.id } })).status, "SKIPPED");
  assert.equal(await prisma.restPeriod.count({ where: { status: { in: ["RUNNING", "PAUSED"] } } }), 1);

  await applyTimerAction(prisma, timerTwo.id, "SKIP", new Date(base.getTime() + 21_000));
  await prisma.workoutSession.update({ where: { id: session.id }, data: { status: "COMPLETED", completedAt: new Date(base.getTime() + 30_000) } });
  const secondWorkout = await startWorkout(prisma, version.days[0].id);
  const secondSession = await prisma.workoutSession.findUniqueOrThrow({ where: { id: secondWorkout.id }, include: { exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: { orderBy: { setNumber: "asc" } } } } } });
  const prefilled = secondSession.exerciseSessions[0].setLogs.map((set) => set.loadValue === null ? null : Number(set.loadValue));
  assert.deepEqual(prefilled.slice(0, 3), [8, 9, 9], "matching machine levels should be used before last-level fallback");
  assert(await getActiveRestTimer(prisma) === null);

  await prisma.workoutSession.deleteMany();
  await prisma.appSettings.update({ where: { id: 1 }, data: { activeProgramId: null } });
  await prisma.workoutProgram.update({ where: { id: program.id }, data: { status: "DEMO", activeVersionId: null, activatedAt: null } });
  assert.equal(await prisma.workoutSession.count(), 0);
  console.log("Verified session snapshots, one-active-session protection, 12-rep defaults, blank/no-history weights, previous-performance prefills, timestamp pause/resume/adjustment, timer replacement, and test-data cleanup.");
  await prisma.$disconnect();
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
