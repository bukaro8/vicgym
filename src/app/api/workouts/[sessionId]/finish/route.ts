import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { cardioDurationSeconds } from "@/lib/cardio";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
const schema = z.object({ confirmIncomplete: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    assertSameOriginJson(request);
    const { confirmIncomplete } = schema.parse(await request.json());
    const { sessionId } = await params;
    const completedAt = new Date();
    await getPrisma().$transaction(async (tx) => {
      const session = await tx.workoutSession.findUnique({ where: { id: sessionId }, include: { exerciseSessions: { include: { setLogs: true } } } });
      if (!session || session.status !== "IN_PROGRESS") throw new Error("SESSION_NOT_ACTIVE");
      const incomplete = session.exerciseSessions.some((exercise) => exercise.setLogs.filter((set) => set.completedAt).length < exercise.plannedSets);
      if (incomplete && !confirmIncomplete) throw new Error("INCOMPLETE_CONFIRMATION_REQUIRED");
      await tx.restPeriod.updateMany({ where: { status: { in: ["RUNNING", "PAUSED"] } }, data: { status: "SKIPPED", skippedAt: completedAt, endsAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null } });
      await tx.workoutSession.update({ where: { id: sessionId }, data: { status: "COMPLETED", completedAt, cardioStoppedAt: session.cardioStartedAt && !session.cardioStoppedAt ? completedAt : session.cardioStoppedAt, cardioDurationSeconds: session.cardioStartedAt && !session.cardioStoppedAt ? cardioDurationSeconds(session.cardioStartedAt, completedAt) : session.cardioDurationSeconds } });
    });
    revalidatePath("/");
    revalidatePath("/workouts");
    return NextResponse.json({ summaryUrl: `/workouts/${sessionId}/summary` });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid finish request" }, { status: 400 });
    if (error instanceof Error && error.message === "INCOMPLETE_CONFIRMATION_REQUIRED") return NextResponse.json({ error: "Confirm that you want to finish with incomplete sets" }, { status: 409 });
    if (error instanceof Error && error.message === "SESSION_NOT_ACTIVE") return NextResponse.json({ error: "Workout is not active" }, { status: 409 });
    console.error("Workout finish failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Workout could not be finished" }, { status: 500 });
  }
}
