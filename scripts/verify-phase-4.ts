import assert from "node:assert/strict";

import { getPrisma } from "../src/lib/prisma";
import { applyCoachImport, previewCoachImport } from "../src/server/coach-import";
import { setActiveProgramme } from "../src/server/active-programme";
import { getWeeklyReview, londonWeekRange } from "../src/server/weekly-review";
import { startWorkout } from "../src/server/workouts";

const priorCompleted = new Date("2026-08-23T10:00:00.000Z");
const reviewCompleted = new Date("2026-08-30T10:00:00.000Z");

async function completeChestSession(sessionId: string, completedAt: Date, levels: number[], reps: number[]) {
  const prisma = getPrisma();
  const session = await prisma.workoutSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: { orderBy: { setNumber: "asc" } } } } },
  });
  const chest = session.exerciseSessions[0];
  for (const [index, set] of chest.setLogs.entries()) await prisma.setLog.update({ where: { id: set.id }, data: { loadValue: levels[index], actualReps: reps[index], completedAt } });
  await prisma.restPeriod.create({ data: { setLogId: chest.setLogs[0].id, status: "SKIPPED", configuredSeconds: 120, startedAt: completedAt, skippedAt: completedAt, adjustments: [{ seconds: 15 }] } });
  await prisma.restPeriod.create({ data: { setLogId: chest.setLogs[1].id, status: "COMPLETED", configuredSeconds: 120, startedAt: completedAt, completedAt: new Date(completedAt.getTime() + 118_000) } });
  await prisma.workoutSession.update({ where: { id: sessionId }, data: { startedAt: new Date(completedAt.getTime() - 45 * 60_000), completedAt, status: "COMPLETED" } });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl && new URL(databaseUrl).pathname.endsWith("_test"), "Phase 4 verification refuses a non-test database");
  const prisma = getPrisma();
  await prisma.workoutSession.deleteMany();
  await prisma.programVersion.deleteMany({ where: { versionNumber: { gt: 1 } } });
  const program = await prisma.workoutProgram.findUniqueOrThrow({ where: { slug: "demo-four-day" }, include: { versions: { where: { versionNumber: 1 }, include: { days: { orderBy: { rotationOrder: "asc" } } } } } });
  const version = program.versions[0];
  await setActiveProgramme(prisma, program.id, version.id);

  const previous = await startWorkout(prisma, version.days[0].id); await completeChestSession(previous.id, priorCompleted, [8, 8, 8], [12, 12, 11]);
  const weekly = await startWorkout(prisma, version.days[0].id); await completeChestSession(weekly.id, reviewCompleted, [9, 9, 9], [12, 11, 10]);
  const historicalSession = await prisma.workoutSession.findUniqueOrThrow({ where: { id: weekly.id } });

  const review = await getWeeklyReview(prisma, "2026-08-24");
  assert.equal(review.isEmpty, false); assert.equal(review.completedSessions, 1); assert.equal(review.workingSets, 3);
  assert.match(review.report, /## CURRENT PROGRAMME/); assert.match(review.report, /Programme: Demo four-day programme \[demo-four-day\]/); assert.match(review.report, /Programme version: 1/); assert.match(review.report, /- Demo Upper A \[demo-upper-a\]/); assert.match(review.report, /Chest Press \[chest-press\]/); assert.match(review.report, /L9 × 12/); assert.match(review.report, /Progression: machine level increased/); assert.match(review.report, /Direct working sets by primary muscle: Chest 3/); assert.match(review.report, /Completed rest periods: 1 · average elapsed 118 sec/); assert.match(review.report, /## VALID VICGYM EXERCISES/); assert.match(review.report, /chest-press/); assert.match(review.report, /"program": "demo-four-day"/); assert.match(review.report, /"baseVersion": 1/); assert.match(review.report, /## VICGYM COACH RESPONSE/);
  const empty = await getWeeklyReview(prisma, "2026-08-10"); assert.equal(empty.isEmpty, true); assert.match(empty.report, /No completed workouts/);
  const dst = londonWeekRange(undefined, new Date("2026-03-29T12:00:00.000Z")); assert.equal(dst.end.toISOString(), "2026-03-29T23:00:00.000Z");

  const changes = JSON.stringify({ schemaVersion: 1, program: "demo-four-day", baseVersion: 1, changes: [
    { action: "upsert", day: "demo-upper-a", exercise: "chest-press", load: { type: "machineLevel", value: 10 }, position: 2 },
    { action: "upsert", day: "demo-upper-a", exercise: "lat-pulldown", position: 1 },
    { action: "remove", day: "demo-upper-a", exercise: "biceps-curl" },
    { action: "upsert", day: "demo-upper-a", exercise: "push-up", sets: 3, targetReps: 12, restSeconds: 90, autoRest: true, position: 5 },
  ] });
  const preview = await previewCoachImport(prisma, changes); assert.equal(preview.changed.length, 1); assert.equal(preview.added.length, 1); assert.equal(preview.removed.length, 1); assert.equal(preview.reordered.length, 2);
  await assert.rejects(() => previewCoachImport(prisma, "{"), /Invalid JSON/);
  await assert.rejects(() => previewCoachImport(prisma, JSON.stringify({ schemaVersion: 1, program: "demo-four-day", baseVersion: 1, changes: [{ day: "demo-upper-a", exercise: "not-in-vicgym", sets: 3 }] })), /Unknown or unavailable/);
  const chestEquipment = await prisma.equipment.findUniqueOrThrow({ where: { slug: "chest-press" } }); await prisma.equipment.update({ where: { id: chestEquipment.id }, data: { available: false } });
  await assert.rejects(() => previewCoachImport(prisma, JSON.stringify({ schemaVersion: 1, program: "demo-four-day", baseVersion: 1, changes: [{ day: "demo-upper-a", exercise: "chest-press", sets: 4 }] })), /Unknown or unavailable/); await prisma.equipment.update({ where: { id: chestEquipment.id }, data: { available: true } });
  const result = await applyCoachImport(prisma, changes); assert.equal(result.versionNumber, 2);
  const updated = await prisma.workoutProgram.findUniqueOrThrow({
    where: { id: program.id },
    include: {
      versions: {
        orderBy: { versionNumber: "asc" },
        include: {
          days: {
            where: { slug: "demo-upper-a" },
            include: { workoutExercises: { orderBy: { position: "asc" }, include: { exercise: true } } },
          },
        },
      },
    },
  });
  assert.equal(updated.versions.length, 2); assert.equal(updated.activeVersionId, updated.versions[1].id); assert.equal(updated.versions[0].days[0].workoutExercises.find((item) => item.exercise.slug === "chest-press")?.plannedLoadValue, null); assert.equal(Number(updated.versions[1].days[0].workoutExercises.find((item) => item.exercise.slug === "chest-press")?.plannedLoadValue), 10);
  assert.equal((await prisma.workoutSession.findUniqueOrThrow({ where: { id: historicalSession.id } })).programVersionId, version.id);
  await assert.rejects(() => previewCoachImport(prisma, changes), /based on version 1/);
  const versionCount = await prisma.programVersion.count({ where: { programId: program.id } }); await assert.rejects(() => previewCoachImport(prisma, JSON.stringify({ schemaVersion: 1, program: "demo-four-day", baseVersion: 2, changes: [{ day: "demo-upper-a", exercise: "chest-press", sets: 4 }, { day: "demo-upper-a", exercise: "unknown", sets: 3 }] })), /Unknown or unavailable/); assert.equal(await prisma.programVersion.count({ where: { programId: program.id } }), versionCount);

  await prisma.appSettings.update({ where: { id: 1 }, data: { activeProgramId: null } }); await prisma.workoutProgram.update({ where: { id: program.id }, data: { activeVersionId: null, status: "DEMO", activatedAt: null } });
  const noActive = await getWeeklyReview(prisma, "2026-08-24"); assert.equal(noActive.programSlug, null); assert.equal(noActive.versionNumber, null); assert.match(noActive.report, /No active programme is currently confirmed/); assert.match(noActive.report, /Weekly schemaVersion 1 changes cannot be imported/); assert.match(noActive.report, /schemaVersion 2 JSON/); assert.doesNotMatch(noActive.report, /"program"/); assert.doesNotMatch(noActive.report, /"baseVersion"/);

  await prisma.workoutSession.deleteMany(); await prisma.programVersion.deleteMany({ where: { programId: program.id, versionNumber: { gt: 1 } } });
  console.log("Verified London report boundaries, live programme/catalogue identifiers, no-active-programme safety, real-session report content, progression/muscle totals, strict coach validation, add/update/remove/reorder preview, atomic immutable apply, stale-version blocking, and historical-session preservation.");
  await prisma.$disconnect();
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
