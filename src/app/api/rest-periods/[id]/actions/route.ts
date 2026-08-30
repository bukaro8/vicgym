import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { applyTimerAction } from "@/server/rest-timers";

export const runtime = "nodejs";
const schema = z.object({ action: z.enum(["ADD_15", "SUBTRACT_15", "PAUSE", "RESUME", "SKIP", "COMPLETE"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOriginJson(request);
    const { action } = schema.parse(await request.json());
    const { id } = await params;
    return NextResponse.json({ timer: await applyTimerAction(getPrisma(), id, action) });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid timer action" }, { status: 400 });
    console.error("Timer action failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Timer could not be updated" }, { status: 500 });
  }
}
