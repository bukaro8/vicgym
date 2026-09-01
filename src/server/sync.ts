import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { OfflineMutation } from "@/lib/offline-types";

export type SyncResult = { id: string; status: "applied" | "duplicate" | "failed"; error?: string };

function payloadHash(mutation: OfflineMutation): string { return createHash("sha256").update(JSON.stringify({ type: mutation.type, sessionId: mutation.sessionId, targetId: mutation.targetId, payload: mutation.payload })).digest("hex"); }
function asDate(value: unknown, field: string): Date { if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${field}`); return new Date(value); }
function asNumber(value: unknown, field: string): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${field}`); return value; }
function asNullableNumber(value: unknown, field: string): number | null { return value === null ? null : asNumber(value, field); }
function asOptionalNullableNumber(value: unknown, field: string): number | null { return value === undefined || value === null ? null : asNumber(value, field); }
function validatedLoad(payload: Record<string, unknown>, exercise: { loadTrackingTypeSnapshot: "KILOGRAM" | "MACHINE_LEVEL" | "BODYWEIGHT" | "REPS_ONLY" | null }) {
  const trackingType = exercise.loadTrackingTypeSnapshot;
  const weightKg = asOptionalNullableNumber(payload.weightKg, "weightKg");
  const loadValue = asOptionalNullableNumber(payload.loadValue, "loadValue");
  if (trackingType === null) {
    if (loadValue !== null) throw new Error("Typed load cannot be applied to a legacy exercise session");
    return { weightKg, loadValue: null, loadTrackingType: null };
  }
  if (weightKg !== null) throw new Error("Legacy weightKg cannot be applied to a typed exercise session");
  if ((trackingType === "BODYWEIGHT" || trackingType === "REPS_ONLY") && loadValue !== null) throw new Error("This exercise does not accept an external load");
  if (trackingType === "MACHINE_LEVEL" && loadValue !== null && !Number.isInteger(loadValue)) throw new Error("Machine level must be an integer");
  return { weightKg: null, loadValue, loadTrackingType: trackingType };
}

async function applyMutation(tx: Prisma.TransactionClient, mutation: OfflineMutation) {
  const payload = mutation.payload;
  if (mutation.type === "ADD_SET") {
    const exerciseSessionId = String(payload.exerciseSessionId); const setNumber = asNumber(payload.setNumber, "setNumber"); const targetReps = asNumber(payload.targetReps, "targetReps");
    const exercise = await tx.exerciseSession.findFirst({ where: { id: exerciseSessionId, workoutSessionId: mutation.sessionId, workoutSession: { status: "IN_PROGRESS" } } });
    if (!exercise) throw new Error("Active exercise session was not found");
    const load = validatedLoad(payload, exercise);
    await tx.setLog.upsert({ where: { id: mutation.targetId }, create: { id: mutation.targetId, exerciseSessionId, setNumber, targetReps, actualReps: asNullableNumber(payload.actualReps, "actualReps"), ...load }, update: {} });
    return;
  }
  if (mutation.type === "UPSERT_SET") {
    const set = await tx.setLog.findFirst({ where: { id: mutation.targetId, exerciseSession: { workoutSessionId: mutation.sessionId } }, include: { exerciseSession: true } });
    if (!set) throw new Error("Set was not found");
    const load = validatedLoad(payload, set.exerciseSession);
    await tx.setLog.update({ where: { id: set.id }, data: { actualReps: asNullableNumber(payload.actualReps, "actualReps"), ...load, completedAt: payload.completedAt === null ? null : asDate(payload.completedAt, "completedAt"), notes: typeof payload.notes === "string" ? payload.notes : null } });
    return;
  }
  if (mutation.type === "UPSERT_TIMER") {
    const setLogId = String(payload.setLogId); const set = await tx.setLog.findFirst({ where: { id: setLogId, exerciseSession: { workoutSessionId: mutation.sessionId } } }); if (!set) throw new Error("Timer set was not found");
    const status = String(payload.status); if (!["RUNNING", "PAUSED", "COMPLETED", "SKIPPED"].includes(status)) throw new Error("Invalid timer status");
    await tx.restPeriod.updateMany({ where: { status: { in: ["RUNNING", "PAUSED"] }, NOT: { setLogId } }, data: { status: "SKIPPED", skippedAt: new Date(), endsAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null } });
    const timerData = { status: status as "RUNNING" | "PAUSED" | "COMPLETED" | "SKIPPED", configuredSeconds: asNumber(payload.configuredSeconds, "configuredSeconds"), startedAt: asDate(payload.startedAt, "startedAt"), endsAt: payload.endsAt === null ? null : asDate(payload.endsAt, "endsAt"), pausedAt: payload.pausedAt === null ? null : asDate(payload.pausedAt, "pausedAt"), pausedRemainingMs: asNullableNumber(payload.pausedRemainingMs, "pausedRemainingMs"), pausedRemainingSeconds: payload.pausedRemainingMs === null ? null : Math.ceil(asNumber(payload.pausedRemainingMs, "pausedRemainingMs") / 1000), completedAt: status === "COMPLETED" ? asDate(payload.updatedAt, "updatedAt") : null, skippedAt: status === "SKIPPED" ? asDate(payload.updatedAt, "updatedAt") : null };
    const existing = await tx.restPeriod.findUnique({ where: { setLogId } });
    if (existing) await tx.restPeriod.update({ where: { id: existing.id }, data: timerData }); else await tx.restPeriod.create({ data: { id: mutation.targetId, setLogId, ...timerData } });
    return;
  }
  if (mutation.type === "FINISH_WORKOUT") {
    const session = await tx.workoutSession.findUnique({ where: { id: mutation.sessionId } }); if (!session) throw new Error("Workout session was not found"); if (session.status === "COMPLETED") return;
    const completedAt = asDate(payload.completedAt, "completedAt");
    await tx.restPeriod.updateMany({ where: { setLog: { exerciseSession: { workoutSessionId: mutation.sessionId } }, status: { in: ["RUNNING", "PAUSED"] } }, data: { status: "SKIPPED", skippedAt: completedAt, endsAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null } });
    await tx.workoutSession.update({ where: { id: mutation.sessionId }, data: { status: "COMPLETED", completedAt } });
  }
}

export async function replayOfflineMutations(prisma: PrismaClient, mutations: OfflineMutation[]): Promise<SyncResult[]> {
  const ordered = [...mutations].sort((a, b) => a.sequence - b.sequence); const results: SyncResult[] = [];
  for (const mutation of ordered) {
    try {
      const status = await prisma.$transaction(async (tx) => {
        const hash = payloadHash(mutation); const existing = await tx.clientMutation.findUnique({ where: { id: mutation.id } });
        if (existing) { if (existing.payloadHash !== hash) throw new Error("Idempotency key payload conflict"); return "duplicate" as const; }
        await applyMutation(tx, mutation);
        await tx.clientMutation.create({ data: { id: mutation.id, status: "APPLIED", entityType: mutation.type, entityId: mutation.targetId, payloadHash: hash, appliedAt: new Date() } });
        return "applied" as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      results.push({ id: mutation.id, status });
    } catch (error) { results.push({ id: mutation.id, status: "failed", error: error instanceof Error ? error.message : "Mutation failed" }); break; }
  }
  return results;
}
