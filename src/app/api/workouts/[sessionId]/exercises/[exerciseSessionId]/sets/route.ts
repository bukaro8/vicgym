import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
const schema = z.object({}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string; exerciseSessionId: string }> }) {
  try {
    assertSameOriginJson(request);
    schema.parse(await request.json());
    const { sessionId, exerciseSessionId } = await params;
    const set = await getPrisma().$transaction(async (tx) => {
      const exercise = await tx.exerciseSession.findFirst({ where: { id: exerciseSessionId, workoutSessionId: sessionId, workoutSession: { status: "IN_PROGRESS" } }, include: { setLogs: { orderBy: { setNumber: "desc" }, take: 1 } } });
      if (!exercise) throw new Error("EXERCISE_NOT_FOUND");
      return tx.setLog.create({ data: { exerciseSessionId, setNumber: (exercise.setLogs[0]?.setNumber ?? 0) + 1, targetReps: exercise.targetReps, actualReps: exercise.targetReps } });
    });
    return NextResponse.json({ set: { ...set, weightKg: null } }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (error instanceof Error && error.message === "EXERCISE_NOT_FOUND") return NextResponse.json({ error: "Exercise not found in active workout" }, { status: 404 });
    console.error("Add set failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Set could not be added" }, { status: 500 });
  }
}
