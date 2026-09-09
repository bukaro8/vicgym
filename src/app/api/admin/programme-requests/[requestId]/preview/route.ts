import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { AdminRequiredError, AuthenticationRequiredError, requireAdminUser } from "@/server/auth";
import { previewRequestProgramme } from "@/server/admin-programme-requests";

const bodySchema = z.object({ json: z.string().min(2).max(100_000) }).strict();
export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try { assertSameOriginJson(request); await requireAdminUser(); const { requestId } = await context.params; const { json } = bodySchema.parse(await request.json()); return NextResponse.json({ preview: await previewRequestProgramme(getPrisma(), requestId, json) }); }
  catch (error) { if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 }); if (error instanceof AdminRequiredError) return NextResponse.json({ error: error.message }, { status: 403 }); if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : "Programme could not be validated" }, { status: error instanceof z.ZodError ? 400 : 409 }); }
}
