import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { applyCoachImport } from "@/server/coach-import";

export const runtime = "nodejs";
const bodySchema = z.object({ json: z.string().min(2).max(100_000), confirmation: z.literal("APPLY_COACH_CHANGES") });

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const { json } = bodySchema.parse(await request.json());
    const result = await applyCoachImport(getPrisma(), json);
    revalidatePath("/"); revalidatePath("/programme"); revalidatePath("/workouts"); revalidatePath("/more/review");
    return NextResponse.json({ applied: true, kind: result.kind, program: result.program, versionNumber: result.versionNumber });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Explicit confirmation is required before applying coach changes." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Coach changes could not be applied.";
    return NextResponse.json({ error: message }, { status: message.includes("based on version") ? 409 : 400 });
  }
}
