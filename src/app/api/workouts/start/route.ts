import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { authenticationErrorResponse } from "@/lib/http/auth-response";
import { requireApiUser } from "@/server/auth";
import { startWorkout } from "@/server/workouts";

export const runtime = "nodejs";
const schema = z.object({ workoutDayId: z.string().uuid(), cardioPlanned: z.boolean().default(false) });

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const user = await requireApiUser();
    const { workoutDayId, cardioPlanned } = schema.parse(await request.json());
    const session = await startWorkout(getPrisma(), user.id, workoutDayId, cardioPlanned);
    return NextResponse.json({ sessionId: session.id, exerciseSessionId: session.exerciseSessions[0]?.id, resumed: "resumed" in session && session.resumed });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error); if (authResponse) return authResponse;
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid workout day" }, { status: 400 });
    if (error instanceof Error && error.message === "WORKOUT_DAY_NOT_ACTIVE") return NextResponse.json({ error: "That day is not in the active programme" }, { status: 409 });
    console.error("Workout start failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Workout could not be started" }, { status: 500 });
  }
}
