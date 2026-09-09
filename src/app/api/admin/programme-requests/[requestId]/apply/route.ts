import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { applyRequestProgramme } from "@/server/admin-programme-requests";
import { AdminRequiredError, AuthenticationRequiredError, requireAdminUser } from "@/server/auth";
import { notifyUserProgrammeReady } from "@/server/programme-request-notifications";

const bodySchema = z.object({ json: z.string().min(2).max(100_000), confirmation: z.literal("CREATE_REQUEST_PROGRAMME") }).strict();
export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try { assertSameOriginJson(request); await requireAdminUser(); const { requestId } = await context.params; const { json } = bodySchema.parse(await request.json()); const prisma = getPrisma(); const result = await applyRequestProgramme(prisma, requestId, json); await notifyUserProgrammeReady(prisma, requestId); revalidatePath("/admin/requests"); revalidatePath(`/admin/requests/${requestId}`); return NextResponse.json({ applied: true, program: result.program, versionNumber: result.versionNumber }); }
  catch (error) { if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 }); if (error instanceof AdminRequiredError) return NextResponse.json({ error: error.message }, { status: 403 }); if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : "Programme could not be applied" }, { status: error instanceof z.ZodError ? 400 : 409 }); }
}
