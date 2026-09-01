import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { startRestForSet } from "@/server/rest-timers";

export const runtime = "nodejs";
const schema = z.object({ actualReps: z.number().int().min(0).max(999), loadValue: z.number().min(0).max(9999).nullable().optional(), weightKg: z.number().min(0).max(9999).nullable().optional(), completed: z.boolean() }).strict().superRefine((value, context) => {
  if (value.loadValue !== undefined && value.weightKg !== undefined) context.addIssue({ code: "custom", message: "Use loadValue or legacy weightKg, never both" });
});

export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string; setLogId: string }> }) {
  try {
    assertSameOriginJson(request);
    const input = schema.parse(await request.json());
    const { sessionId, setLogId } = await params;
    const result = await getPrisma().$transaction(async (tx) => {
      const existing = await tx.setLog.findFirst({ where: { id: setLogId, exerciseSession: { workoutSessionId: sessionId, workoutSession: { status: "IN_PROGRESS" } } }, include: { exerciseSession: true } });
      if (!existing) throw new Error("SET_NOT_FOUND");
      const trackingType = existing.exerciseSession.loadTrackingTypeSnapshot;
      if (trackingType === null) {
        if (input.loadValue !== undefined) throw new Error("INCOMPATIBLE_LOAD");
      } else {
        if (input.weightKg !== undefined) throw new Error("INCOMPATIBLE_LOAD");
        if ((trackingType === "BODYWEIGHT" || trackingType === "REPS_ONLY") && input.loadValue != null) throw new Error("INCOMPATIBLE_LOAD");
        if (trackingType === "MACHINE_LEVEL" && input.loadValue != null && !Number.isInteger(input.loadValue)) throw new Error("INCOMPATIBLE_LOAD");
      }
      const newlyCompleted = input.completed && !existing.completedAt;
      const set = await tx.setLog.update({ where: { id: setLogId }, data: { actualReps: input.actualReps, weightKg: trackingType === null ? (input.weightKg ?? null) : null, loadValue: trackingType === null ? null : (input.loadValue ?? null), loadTrackingType: trackingType, completedAt: input.completed ? (existing.completedAt ?? new Date()) : null } });
      const timer = newlyCompleted ? await startRestForSet(tx, setLogId) : null;
      return { set, timer };
    });
    return NextResponse.json({ set: { ...result.set, weightKg: result.set.weightKg === null ? null : Number(result.set.weightKg), loadValue: result.set.loadValue === null ? null : Number(result.set.loadValue) }, timer: result.timer });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid set values" }, { status: 400 });
    if (error instanceof Error && error.message === "SET_NOT_FOUND") return NextResponse.json({ error: "Set not found in active workout" }, { status: 404 });
    if (error instanceof Error && error.message === "INCOMPATIBLE_LOAD") return NextResponse.json({ error: "Load does not match this exercise session" }, { status: 400 });
    console.error("Set update failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Set could not be saved" }, { status: 500 });
  }
}
