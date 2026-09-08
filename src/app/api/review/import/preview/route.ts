import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { previewCoachImport } from "@/server/coach-import";
import { authenticationErrorResponse } from "@/lib/http/auth-response";
import { requireApiUser } from "@/server/auth";

export const runtime = "nodejs";
const bodySchema = z.object({ json: z.string().min(2).max(100_000) });

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const user = await requireApiUser();
    const { json } = bodySchema.parse(await request.json());
    return NextResponse.json({ preview: await previewCoachImport(getPrisma(), user.id, json) });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error); if (authResponse) return authResponse;
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Paste a JSON object before validating." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Coach changes could not be validated.";
    return NextResponse.json({ error: message }, { status: message.includes("based on version") ? 409 : 400 });
  }
}
