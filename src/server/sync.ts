import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { cardioDurationSeconds } from "@/lib/cardio";
import type { OfflineMutation } from "@/lib/offline-types";

export type SyncResult = { id: string; type: OfflineMutation["type"]; sequence: number; status: "applied" | "duplicate" | "failed"; error?: string };

function payloadHash(mutation: OfflineMutation): string { return createHash("sha256").update(JSON.stringify({ type: mutation.type, sessionId: mutation.sessionId, targetId: mutation.targetId, payload: mutation.payload })).digest("hex"); }
function asDate(value: unknown, field: string): Date { if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${field}`); return new Date(value); }
function asNumber(value: unknown, field: string): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${field}`); return value; }
function asNullableNumber(value: unknown, field: string): number | null { return value === null ? null : asNumber(value, field); }
function asOptionalNullableNumber(value: unknown, field: string): number | null { return value === undefined || value === null ? null : asNumber(value, field); }
function asBoundedInteger(value: unknown, field: string, minimum: number, maximum: number): number { const parsed = asNumber(value, field); if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`Invalid ${field}`); return parsed; }
type TimerStatus = "RUNNING" | "PAUSED" | "COMPLETED" | "SKIPPED";
export function resolveTimerReplay(requestedStatus: unknown, mutationSessionId: string, owningSessionId: string | null): { action: "orphan" } | { action: "apply"; status: TimerStatus; recoveredSessionMismatch: boolean } {
  const status = String(requestedStatus);
  if (!["RUNNING", "PAUSED", "COMPLETED", "SKIPPED"].includes(status)) throw new Error("Invalid timer status");
  if (!owningSessionId) return { action: "orphan" };
  const recoveredSessionMismatch = owningSessionId !== mutationSessionId;
  return { action: "apply", status: recoveredSessionMismatch && (status === "RUNNING" || status === "PAUSED") ? "SKIPPED" : status as TimerStatus, recoveredSessionMismatch };
}
export function validatedSyncLoad(payload: Record<string, unknown>, exercise: { loadTrackingTypeSnapshot: "KILOGRAM" | "MACHINE_LEVEL" | "BODYWEIGHT" | "REPS_ONLY" | null }) {
  const trackingType = exercise.loadTrackingTypeSnapshot;
  const weightKg = asOptionalNullableNumber(payload.weightKg, "weightKg");
  const loadValue = asOptionalNullableNumber(payload.loadValue, "loadValue");
  const claimedType = payload.loadTrackingType;
  if (claimedType !== undefined && claimedType !== null && claimedType !== trackingType) throw new Error(`Load type ${String(claimedType)} does not match session type ${trackingType ?? "LEGACY"}`);
  if (trackingType === null) {
    if (loadValue !== null) throw new Error("Typed load cannot be applied to a legacy exercise session");
    return { load: { weightKg, loadValue: null, loadTrackingType: null }, recoveredLegacyField: false };
  }
  if (weightKg !== null && loadValue !== null) throw new Error("A sync mutation cannot provide both weightKg and loadValue");
  if (weightKg !== null) {
    if (trackingType === "BODYWEIGHT" || trackingType === "REPS_ONLY") throw new Error("This exercise does not accept an external load");
    if (trackingType === "MACHINE_LEVEL" && !Number.isInteger(weightKg)) throw new Error("Machine level must be an integer");
    // Compatibility for pending mutations created by a cached pre-typed-load
    // client. The immutable server-side exercise-session snapshot determines
    // the meaning; existing database weightKg history is never rewritten.
    return { load: { weightKg: null, loadValue: weightKg, loadTrackingType: trackingType }, recoveredLegacyField: true };
  }
  if ((trackingType === "BODYWEIGHT" || trackingType === "REPS_ONLY") && loadValue !== null) throw new Error("This exercise does not accept an external load");
  if (trackingType === "MACHINE_LEVEL" && loadValue !== null && !Number.isInteger(loadValue)) throw new Error("Machine level must be an integer");
  return { load: { weightKg: null, loadValue, loadTrackingType: trackingType }, recoveredLegacyField: false };
}

async function applyMutation(tx: Prisma.TransactionClient, userId: string, mutation: OfflineMutation) {
  const payload = mutation.payload;
  if (mutation.type === "ADD_EXERCISE") {
    const session = await tx.workoutSession.findFirst({ where: { id: mutation.sessionId, userId, status: "IN_PROGRESS" }, include: { exerciseSessions: { select: { exerciseId: true, position: true } } } });
    if (!session) throw new Error("Active workout session was not found");
    const exerciseId = String(payload.exerciseId);
    if (session.exerciseSessions.some((item) => item.exerciseId === exerciseId)) throw new Error("Exercise is already part of this workout session");
    const exercise = await tx.exercise.findFirst({ where: { id: exerciseId, active: true, OR: [{ equipmentId: null }, { equipment: { available: true } }] } });
    if (!exercise) throw new Error("Active catalogue exercise was not found");
    const position = asBoundedInteger(payload.position, "position", 1, 100);
    const expectedPosition = Math.max(0, ...session.exerciseSessions.map((item) => item.position)) + 1;
    if (position !== expectedPosition) throw new Error("Ad-hoc exercise position is stale");
    const plannedSets = asBoundedInteger(payload.plannedSets, "plannedSets", 1, 20);
    const targetReps = asBoundedInteger(payload.targetReps, "targetReps", 1, 1000);
    const restSeconds = asBoundedInteger(payload.restSeconds, "restSeconds", 0, 3600);
    if (payload.autoRest !== true && payload.autoRest !== false) throw new Error("Invalid autoRest");
    if (!Array.isArray(payload.sets) || payload.sets.length !== plannedSets) throw new Error("Invalid ad-hoc exercise sets");
    const setIds = new Set<string>();
    const setLogs = payload.sets.map((value, index) => {
      if (typeof value !== "object" || !value) throw new Error("Invalid ad-hoc exercise set");
      const set = value as Record<string, unknown>; const id = String(set.id);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || setIds.has(id)) throw new Error("Invalid ad-hoc set ID");
      setIds.add(id);
      if (asBoundedInteger(set.setNumber, "setNumber", 1, plannedSets) !== index + 1) throw new Error("Invalid ad-hoc set order");
      if (asBoundedInteger(set.targetReps, "set targetReps", 1, 1000) !== targetReps) throw new Error("Ad-hoc set target reps do not match");
      return { id, setNumber: index + 1, targetReps, actualReps: targetReps, weightKg: null, loadValue: null, loadTrackingType: exercise.loadTrackingType };
    });
    await tx.exerciseSession.create({ data: { id: mutation.targetId, workoutSessionId: session.id, exerciseId: exercise.id, position, exerciseNameSnapshot: exercise.name, plannedSets, targetReps, restSeconds, autoRest: payload.autoRest, isAdHoc: true, loadTrackingTypeSnapshot: exercise.loadTrackingType, loadEntryModeSnapshot: exercise.loadEntryMode, loadMultiplierSnapshot: exercise.loadMultiplier, setLogs: { create: setLogs } } });
    return;
  }
  if (mutation.type === "ADD_SET") {
    const exerciseSessionId = String(payload.exerciseSessionId); const setNumber = asNumber(payload.setNumber, "setNumber"); const targetReps = asNumber(payload.targetReps, "targetReps");
    const exercise = await tx.exerciseSession.findFirst({ where: { id: exerciseSessionId, workoutSessionId: mutation.sessionId, workoutSession: { userId, status: "IN_PROGRESS" } } });
    if (!exercise) throw new Error("Active exercise session was not found");
    const { load, recoveredLegacyField } = validatedSyncLoad(payload, exercise);
    if (recoveredLegacyField) console.warn("Recovered legacy offline load field", { mutationId: mutation.id, mutationType: mutation.type, sequence: mutation.sequence, sessionId: mutation.sessionId, expectedLoadType: exercise.loadTrackingTypeSnapshot });
    const existing = await tx.setLog.findUnique({ where: { id: mutation.targetId }, select: { exerciseSessionId: true } });
    if (existing) {
      if (existing.exerciseSessionId !== exerciseSessionId) throw new Error("Set identifier belongs to another exercise session");
      return;
    }
    await tx.setLog.create({ data: { id: mutation.targetId, exerciseSessionId, setNumber, targetReps, actualReps: asNullableNumber(payload.actualReps, "actualReps"), ...load } });
    return;
  }
  if (mutation.type === "UPSERT_SET") {
    const set = await tx.setLog.findFirst({ where: { id: mutation.targetId, exerciseSession: { workoutSessionId: mutation.sessionId, workoutSession: { userId } } }, include: { exerciseSession: true } });
    if (!set) throw new Error("Set was not found");
    const { load, recoveredLegacyField } = validatedSyncLoad(payload, set.exerciseSession);
    if (recoveredLegacyField) console.warn("Recovered legacy offline load field", { mutationId: mutation.id, mutationType: mutation.type, sequence: mutation.sequence, sessionId: mutation.sessionId, expectedLoadType: set.exerciseSession.loadTrackingTypeSnapshot });
    await tx.setLog.update({ where: { id: set.id }, data: { actualReps: asNullableNumber(payload.actualReps, "actualReps"), ...load, completedAt: payload.completedAt === null ? null : asDate(payload.completedAt, "completedAt"), notes: typeof payload.notes === "string" ? payload.notes : null } });
    return;
  }
  if (mutation.type === "UPSERT_TIMER") {
    const setLogId = String(payload.setLogId);
    const set = await tx.setLog.findFirst({ where: { id: setLogId, exerciseSession: { workoutSession: { userId } } }, include: { exerciseSession: { select: { workoutSessionId: true } } } });
    const resolution = resolveTimerReplay(payload.status, mutation.sessionId, set?.exerciseSession.workoutSessionId ?? null);
    if (resolution.action === "orphan") {
      console.warn("Acknowledged orphaned offline timer mutation", { mutationId: mutation.id, mutationType: mutation.type, sequence: mutation.sequence, sessionId: mutation.sessionId, targetId: mutation.targetId, setLogId });
      return;
    }
    const status = resolution.status;
    if (resolution.recoveredSessionMismatch) console.warn("Recovered offline timer session mismatch", { mutationId: mutation.id, mutationType: mutation.type, sequence: mutation.sequence, suppliedSessionId: mutation.sessionId, owningSessionId: set!.exerciseSession.workoutSessionId, targetId: mutation.targetId, setLogId, requestedStatus: String(payload.status), appliedStatus: status });
    await tx.restPeriod.updateMany({ where: { status: { in: ["RUNNING", "PAUSED"] }, setLog: { exerciseSession: { workoutSession: { userId } } }, NOT: { setLogId } }, data: { status: "SKIPPED", skippedAt: new Date(), endsAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null } });
    const timerData = { status, configuredSeconds: asNumber(payload.configuredSeconds, "configuredSeconds"), startedAt: asDate(payload.startedAt, "startedAt"), endsAt: status === "RUNNING" && payload.endsAt !== null ? asDate(payload.endsAt, "endsAt") : null, pausedAt: status === "PAUSED" && payload.pausedAt !== null ? asDate(payload.pausedAt, "pausedAt") : null, pausedRemainingMs: status === "PAUSED" ? asNullableNumber(payload.pausedRemainingMs, "pausedRemainingMs") : null, pausedRemainingSeconds: status === "PAUSED" && payload.pausedRemainingMs !== null ? Math.ceil(asNumber(payload.pausedRemainingMs, "pausedRemainingMs") / 1000) : null, completedAt: status === "COMPLETED" ? asDate(payload.updatedAt, "updatedAt") : null, skippedAt: status === "SKIPPED" ? asDate(payload.updatedAt, "updatedAt") : null };
    const existing = await tx.restPeriod.findUnique({ where: { setLogId } });
    if (existing) await tx.restPeriod.update({ where: { id: existing.id }, data: timerData }); else await tx.restPeriod.create({ data: { id: mutation.targetId, setLogId, ...timerData } });
    return;
  }
  if (mutation.type === "UPDATE_CARDIO") {
    const session = await tx.workoutSession.findFirst({ where: { id: mutation.sessionId, userId } });
    if (!session || session.status !== "IN_PROGRESS") throw new Error("Cardio workout session was not found");
    if (!session.cardioPlanned) throw new Error("Cardio was not selected for this workout");
    const action = String(payload.action);
    const at = asDate(payload.at, "at");
    if (action === "START") {
      if (session.cardioStoppedAt) throw new Error("Cardio has already been completed");
      if (!session.cardioStartedAt) await tx.workoutSession.update({ where: { id: session.id }, data: { cardioStartedAt: at, cardioStoppedAt: null, cardioDurationSeconds: 0 } });
      return;
    }
    if (action === "STOP") {
      if (!session.cardioStartedAt) throw new Error("Cardio has not been started");
      if (!session.cardioStoppedAt) await tx.workoutSession.update({ where: { id: session.id }, data: { cardioStoppedAt: at, cardioDurationSeconds: cardioDurationSeconds(session.cardioStartedAt, at) } });
      return;
    }
    throw new Error("Invalid cardio action");
  }
  if (mutation.type === "FINISH_WORKOUT") {
    const session = await tx.workoutSession.findFirst({ where: { id: mutation.sessionId, userId } }); if (!session) throw new Error("Workout session was not found"); if (session.status === "COMPLETED") return;
    const completedAt = asDate(payload.completedAt, "completedAt");
    await tx.restPeriod.updateMany({ where: { setLog: { exerciseSession: { workoutSessionId: mutation.sessionId } }, status: { in: ["RUNNING", "PAUSED"] } }, data: { status: "SKIPPED", skippedAt: completedAt, endsAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null } });
    await tx.workoutSession.update({ where: { id: mutation.sessionId }, data: { status: "COMPLETED", completedAt, cardioStoppedAt: session.cardioStartedAt && !session.cardioStoppedAt ? completedAt : session.cardioStoppedAt, cardioDurationSeconds: session.cardioStartedAt && !session.cardioStoppedAt ? cardioDurationSeconds(session.cardioStartedAt, completedAt) : session.cardioDurationSeconds } });
  }
}

export async function replayOfflineMutations(prisma: PrismaClient, userId: string, mutations: OfflineMutation[]): Promise<SyncResult[]> {
  const ordered = [...mutations].sort((a, b) => a.sequence - b.sequence); const results: SyncResult[] = [];
  for (const mutation of ordered) {
    try {
      const status = await prisma.$transaction(async (tx) => {
        const hash = payloadHash(mutation); const existing = await tx.clientMutation.findUnique({ where: { userId_id: { userId, id: mutation.id } } });
        if (existing) { if (existing.payloadHash !== hash) throw new Error("Idempotency key payload conflict"); return "duplicate" as const; }
        await applyMutation(tx, userId, mutation);
        await tx.clientMutation.create({ data: { userId, id: mutation.id, status: "APPLIED", entityType: mutation.type, entityId: mutation.targetId, payloadHash: hash, appliedAt: new Date() } });
        return "applied" as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      results.push({ id: mutation.id, type: mutation.type, sequence: mutation.sequence, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mutation failed";
      console.error("Offline mutation replay failed", { mutationId: mutation.id, mutationType: mutation.type, sequence: mutation.sequence, sessionId: mutation.sessionId, targetId: mutation.targetId, errorName: error instanceof Error ? error.name : "UnknownError", error: message });
      results.push({ id: mutation.id, type: mutation.type, sequence: mutation.sequence, status: "failed", error: message });
      break;
    }
  }
  return results;
}
