import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { cardioDurationSeconds } from "@/lib/cardio";

const tracking = z.enum(["KILOGRAM", "MACHINE_LEVEL", "BODYWEIGHT", "REPS_ONLY"]).nullable();
const number = z.number().finite().min(0).max(9999).nullable();
const setSchema = z.object({ id: z.string().uuid(), setNumber: z.number().int().min(1).max(100), targetReps: z.number().int().min(1).max(1000), actualReps: z.number().int().min(0).max(999).nullable(), weightKg: number, loadValue: number.optional(), loadTrackingType: tracking.optional(), completedAt: z.string().datetime().nullable(), notes: z.string().max(500).nullable().optional() });
const exerciseSchema = z.object({ id: z.string().uuid(), exerciseId: z.string().uuid(), position: z.number().int().min(1).max(100), plannedSets: z.number().int().min(1).max(20), targetReps: z.number().int().min(1).max(1000), restSeconds: z.number().int().min(0).max(3600), autoRest: z.boolean(), isAdHoc: z.boolean().optional(), loadTrackingType: tracking.optional(), sets: z.array(setSchema).min(1).max(100) });
export const completionSnapshotSchema = z.object({ id: z.string().uuid(), programVersionId: z.string().uuid(), status: z.literal("COMPLETED"), completedAt: z.string().datetime(), cardioStartedAt: z.string().datetime().nullable().optional(), cardioStoppedAt: z.string().datetime().nullable().optional(), exercises: z.array(exerciseSchema).min(1).max(100) });

export class CompletionValidationError extends Error {}
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new CompletionValidationError(message); }

/** Called inside the transaction which also writes the completion receipt. */
export async function completeWorkoutSnapshot(tx: Prisma.TransactionClient, userId: string, sessionId: string, raw: unknown) {
  const parsed = completionSnapshotSchema.safeParse(raw);
  if (!parsed.success) throw new CompletionValidationError(`Invalid workout snapshot: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const snapshot = parsed.data;
  const session = await tx.workoutSession.findFirst({ where: { id: sessionId, userId }, include: { exerciseSessions: { include: { setLogs: true } } } });
  check(session, "Workout session was not found");
  check(snapshot.id === session.id && snapshot.programVersionId === session.programVersionId, "Workout snapshot does not match this session");
  check(session.status === "IN_PROGRESS", "Workout was completed by another request. Keep the local copy for reconciliation.");
  const end = new Date(snapshot.completedAt);
  check(end >= session.startedAt && end.getTime() <= Date.now() + 300000, "Invalid workout completion time");
  const unique = (values: Array<string | number>) => new Set(values).size === values.length;
  check(unique(snapshot.exercises.map((item) => item.id)) && unique(snapshot.exercises.map((item) => item.exerciseId)) && unique(snapshot.exercises.map((item) => item.position)), "Duplicate exercise or position in workout");
  const setIds = snapshot.exercises.flatMap((item) => item.sets.map((set) => set.id));
  check(unique(setIds), "Duplicate set identifiers in workout");
  check(session.exerciseSessions.every((item) => snapshot.exercises.some((local) => local.id === item.id)), "Local snapshot is missing server exercises. Keep both copies for reconciliation.");
  for (const item of snapshot.exercises) {
    let exercise = session.exerciseSessions.find((existing) => existing.id === item.id);
    if (!exercise) {
      check(item.isAdHoc, "Unknown planned exercise session");
      const catalogue = await tx.exercise.findFirst({ where: { id: item.exerciseId, active: true, OR: [{ equipmentId: null }, { equipment: { available: true } }] } });
      check(catalogue, "Extra exercise is not available in the catalogue");
      exercise = await tx.exerciseSession.create({ data: { id: item.id, workoutSessionId: session.id, exerciseId: catalogue.id, exerciseNameSnapshot: catalogue.name, position: item.position, plannedSets: item.plannedSets, targetReps: item.targetReps, restSeconds: item.restSeconds, autoRest: item.autoRest, isAdHoc: true, loadTrackingTypeSnapshot: catalogue.loadTrackingType, loadEntryModeSnapshot: catalogue.loadEntryMode, loadMultiplierSnapshot: catalogue.loadMultiplier }, include: { setLogs: true } });
    }
    check(exercise.exerciseId === item.exerciseId && exercise.position === item.position, "Exercise snapshot does not match server session");
    check((item.loadTrackingType ?? null) === exercise.loadTrackingTypeSnapshot, `${exercise.exerciseNameSnapshot}: incompatible load type`);
    check(unique(item.sets.map((set) => set.setNumber)), `${exercise.exerciseNameSnapshot}: duplicate set number`);
    check(exercise.setLogs.every((set) => item.sets.some((local) => local.id === set.id)), `${exercise.exerciseNameSnapshot}: snapshot is missing server sets`);
    for (const set of item.sets) {
      const label = `${exercise.exerciseNameSnapshot}, set ${set.setNumber}`;
      const type = exercise.loadTrackingTypeSnapshot;
      const load = set.loadValue ?? null;
      check((set.loadTrackingType ?? null) === type, `${label}: incompatible load type`);
      check(type === null ? load === null : set.weightKg === null, `${label}: ambiguous legacy load`);
      check(type !== "MACHINE_LEVEL" || load === null || Number.isInteger(load), `${label}: machine level must be a whole number`);
      check(!["BODYWEIGHT", "REPS_ONLY"].includes(type ?? "") || load === null, `${label}: external load is not supported`);
      const completedAt = set.completedAt ? new Date(set.completedAt) : null;
      check(!completedAt || set.actualReps !== null, `${label}: completed sets require actual reps`);
      check(!completedAt || (completedAt >= session.startedAt && completedAt <= end), `${label}: invalid completion time`);
      const existing = await tx.setLog.findUnique({ where: { id: set.id } });
      check(!existing || (existing.exerciseSessionId === exercise.id && existing.setNumber === set.setNumber), `${label}: set belongs to a different exercise`);
      const data = { actualReps: set.actualReps, weightKg: set.weightKg, loadValue: load, loadTrackingType: type, completedAt, notes: set.notes ?? null };
      if (existing) await tx.setLog.update({ where: { id: set.id }, data });
      else await tx.setLog.create({ data: { id: set.id, exerciseSessionId: exercise.id, setNumber: set.setNumber, targetReps: set.targetReps, ...data } });
    }
  }
  const cardioStartedAt = snapshot.cardioStartedAt ? new Date(snapshot.cardioStartedAt) : null;
  const cardioStoppedAt = snapshot.cardioStoppedAt ? new Date(snapshot.cardioStoppedAt) : null;
  check(!cardioStartedAt || (session.cardioPlanned && cardioStartedAt >= session.startedAt && cardioStoppedAt && cardioStoppedAt >= cardioStartedAt && cardioStoppedAt <= end), "Invalid cardio interval");
  check(!cardioStoppedAt || cardioStartedAt, "Cardio stop requires a start");
  await tx.restPeriod.updateMany({ where: { setLog: { exerciseSession: { workoutSessionId: session.id } }, status: { in: ["RUNNING", "PAUSED"] } }, data: { status: "SKIPPED", skippedAt: end, endsAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null } });
  await tx.workoutSession.update({ where: { id: session.id }, data: { status: "COMPLETED", completedAt: end, cardioStartedAt, cardioStoppedAt, cardioDurationSeconds: cardioStartedAt && cardioStoppedAt ? cardioDurationSeconds(cardioStartedAt.toISOString(), cardioStoppedAt.toISOString()) : 0 } });
}
