import "dotenv/config";

import assert from "node:assert/strict";

import { getPrisma } from "../src/lib/prisma";
import { getActiveProgramme } from "../src/server/active-programme";
import { applyCoachImport, previewCoachImport } from "../src/server/coach-import";
import { startWorkout } from "../src/server/workouts";

const slug = "lifecycle-test-programme";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl && new URL(databaseUrl).pathname.endsWith("_test"), "Programme lifecycle verification refuses a non-test database");
  const prisma = getPrisma();
  await prisma.user.deleteMany({ where: { email: "lifecycle@vicgym.test" } });
  const user = await prisma.user.create({ data: { email: "lifecycle@vicgym.test", settings: { create: {} } } });

  const creation = JSON.stringify({
    schemaVersion: 2,
    operation: "create-programme",
    program: { slug, name: "Lifecycle Test Programme" },
    days: [
      { slug: "upper-a", name: "Upper A", rotationOrder: 1, exercises: [{ exercise: "chest-press", sets: 1, targetReps: 12, load: { type: "machineLevel", value: 8 }, restSeconds: 120, autoRest: true, position: 1 }] },
      { slug: "lower-a", name: "Lower A", rotationOrder: 2, exercises: [{ exercise: "machine-squat", sets: 1, targetReps: 12, load: null, restSeconds: 120, autoRest: true, position: 1 }] },
    ],
  });

  const beforePreview = await prisma.workoutProgram.count({ where: { userId: user.id, slug } });
  const creationPreview = await previewCoachImport(prisma, user.id, creation);
  assert.equal(creationPreview.kind, "create");
  assert.equal(creationPreview.baseVersion, null);
  assert.equal(creationPreview.nextVersion, 1);
  assert.equal(creationPreview.days.length, 2);
  assert.equal(await prisma.workoutProgram.count({ where: { userId: user.id, slug } }), beforePreview, "Preview must not write");
  await assert.rejects(() => previewCoachImport(prisma, user.id, creation.replace("chest-press", "not-in-vicgym")), /Unknown or unavailable/);

  const created = await applyCoachImport(prisma, user.id, creation);
  assert.equal(created.kind, "create");
  assert.equal(created.versionNumber, 1);
  const program = await prisma.workoutProgram.findFirstOrThrow({ where: { userId: user.id, slug }, include: { versions: { include: { days: { orderBy: { rotationOrder: "asc" } } } } } });
  assert.equal(program.versions.length, 1);
  assert.equal(program.versions[0].versionNumber, 1);
  assert.equal(program.activeVersionId, program.versions[0].id);
  assert.equal((await getActiveProgramme(prisma, user.id))?.id, program.id);
  assert.equal((await prisma.workoutProgram.count({ where: { userId: user.id, slug } })), 1);
  await assert.rejects(() => previewCoachImport(prisma, user.id, creation), /already exists/);

  const version1 = program.versions[0];
  const upperDay = await prisma.workoutDay.findUniqueOrThrow({ where: { id: version1.days[0].id }, include: { workoutExercises: { include: { exercise: true } } } });
  const chestPlan = upperDay.workoutExercises.find((item) => item.exercise.slug === "chest-press");
  assert(chestPlan, "Chest Press plan is required");
  const legacyCompletedAt = new Date("2026-08-25T17:00:00.000Z");
  const legacy = await prisma.workoutSession.create({ data: { userId: user.id, programVersionId: version1.id, workoutDayId: upperDay.id, workoutDayNameSnapshot: upperDay.name, status: "COMPLETED", completedAt: legacyCompletedAt, exerciseSessions: { create: { exerciseId: chestPlan.exerciseId, position: 1, exerciseNameSnapshot: "Chest Press", plannedSets: 1, targetReps: 12, restSeconds: 120, autoRest: true, loadTrackingTypeSnapshot: null, loadEntryModeSnapshot: null, setLogs: { create: { setNumber: 1, targetReps: 12, actualReps: 12, weightKg: 99, completedAt: legacyCompletedAt } } } } } });
  const session = await startWorkout(prisma, user.id, version1.days[0].id);
  const fullSession = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id }, include: { exerciseSessions: { include: { setLogs: true } } } });
  assert.equal(Number(fullSession.exerciseSessions[0].setLogs[0].loadValue), 8, "legacy 99kg machine history must not prefill the L8 session");
  assert.equal(fullSession.exerciseSessions[0].setLogs[0].weightKg, null);
  const preservedLegacy = await prisma.workoutSession.findUniqueOrThrow({ where: { id: legacy.id }, include: { exerciseSessions: { include: { setLogs: true } } } });
  assert.equal(Number(preservedLegacy.exerciseSessions[0].setLogs[0].weightKg), 99);
  assert.equal(preservedLegacy.exerciseSessions[0].setLogs[0].loadValue, null);
  const completedAt = new Date("2026-09-01T17:00:00.000Z");
  for (const exercise of fullSession.exerciseSessions) for (const set of exercise.setLogs) await prisma.setLog.update({ where: { id: set.id }, data: { actualReps: 12, completedAt } });
  await prisma.workoutSession.update({ where: { id: session.id }, data: { status: "COMPLETED", completedAt } });
  const historicalBefore = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id }, include: { exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: { orderBy: { setNumber: "asc" } } } } } });

  const patch = JSON.stringify({ schemaVersion: 1, program: slug, baseVersion: 1, changes: [{ action: "upsert", day: "upper-a", exercise: "chest-press", load: { type: "machineLevel", value: 9 }, restSeconds: 60 }] });
  const patchPreview = await previewCoachImport(prisma, user.id, patch);
  assert.equal(patchPreview.kind, "patch");
  assert.equal(patchPreview.nextVersion, 2);
  assert(patchPreview.changed.some((item) => item.details.includes("Rest: 120 sec → 60 sec")), "Preview must show the rest-time change");
  const patched = await applyCoachImport(prisma, user.id, patch);
  assert.equal(patched.kind, "patch");
  assert.equal(patched.versionNumber, 2);

  const after = await prisma.workoutProgram.findFirstOrThrow({ where: { userId: user.id, slug }, include: { versions: { orderBy: { versionNumber: "asc" }, include: { days: { where: { slug: "upper-a" }, include: { workoutExercises: { include: { exercise: true } } } } } } } });
  assert.equal(after.versions.length, 2);
  assert.equal(after.activeVersionId, after.versions[1].id);
  const version2Exercise = after.versions[1].days[0].workoutExercises.find((item) => item.exercise.slug === "chest-press");
  const version1Exercise = after.versions[0].days[0].workoutExercises.find((item) => item.exercise.slug === "chest-press");
  assert.equal(Number(version2Exercise?.plannedLoadValue), 9);
  assert.equal(version2Exercise?.restSeconds, 60, "Version 2 must store the patched rest time");
  assert.equal(Number(version1Exercise?.plannedLoadValue), 8);
  assert.equal(version1Exercise?.restSeconds, 120, "Version 1 must remain immutable");
  const historicalAfter = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id }, include: { exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: { orderBy: { setNumber: "asc" } } } } } });
  assert.deepEqual(historicalAfter, historicalBefore);
  assert.equal(historicalAfter.programVersionId, version1.id);
  assert.equal(historicalAfter.exerciseSessions[0].restSeconds, 120, "Existing session snapshot must remain unchanged");
  assert.equal((await getActiveProgramme(prisma, user.id))?.activeVersion?.versionNumber, 2);
  await assert.rejects(() => startWorkout(prisma, user.id, version1.days[0].id), /WORKOUT_DAY_NOT_ACTIVE/);
  const nextSession = await startWorkout(prisma, user.id, after.versions[1].days[0].id);
  const nextSessionSnapshot = await prisma.workoutSession.findUniqueOrThrow({ where: { id: nextSession.id }, include: { exerciseSessions: true } });
  assert.equal(nextSessionSnapshot.programVersionId, after.versions[1].id);
  assert.equal(nextSessionSnapshot.exerciseSessions[0].restSeconds, 60, "A new session must use the active version's patched rest time");

  await prisma.user.delete({ where: { id: user.id } });
  console.log("Verified schemaVersion 2 preview/create/activation, active resolver, workout completion on version 1, schemaVersion 1 rest/load patch to version 2, immutable session snapshots, and new-session selection of the active version.");
  await prisma.$disconnect();
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
