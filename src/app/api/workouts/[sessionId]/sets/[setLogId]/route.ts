import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { startRestForSet } from "@/server/rest-timers";

export const runtime = "nodejs";
const schema = z.object({ actualReps: z.number().int().min(0).max(999), weightKg: z.number().min(0).max(9999).nullable(), completed: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string; setLogId: string }> }) {
  try {
    assertSameOriginJson(request);
    const input = schema.parse(await request.json());
    const { sessionId, setLogId } = await params;
    const result = await getPrisma().$transaction(async (tx) => {
      const existing = await tx.setLog.findFirst({ where: { id: setLogId, exerciseSession: { workoutSessionId: sessionId, workoutSession: { status: "IN_PROGRESS" } } } });
      if (!existing) throw new Error("SET_NOT_FOUND");
      const newlyCompleted = input.completed && !existing.completedAt;
      const set = await tx.setLog.update({ where: { id: setLogId }, data: { actualReps: input.actualReps, weightKg: input.weightKg, completedAt: input.completed ? (existing.completedAt ?? new Date()) : null } });
      const timer = newlyCompleted ? await startRestForSet(tx, setLogId) : null;
      return { set, timer };
    });
    return NextResponse.json({ set: { ...result.set, weightKg: result.set.weightKg === null ? null : Number(result.set.weightKg) }, timer: result.timer });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid set values" }, { status: 400 });
    if (error instanceof Error && error.message === "SET_NOT_FOUND") return NextResponse.json({ error: "Set not found in active workout" }, { status: 404 });
    console.error("Set update failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Set could not be saved" }, { status: 500 });
  }
}
