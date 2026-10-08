import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { requireAdminUser, AuthenticationRequiredError, AdminRequiredError } from "@/server/auth";
import { adminCoachApply, adminCoachPreview, adminCoachReport, CoachingTargetError } from "@/server/admin-coaching";

const paramsSchema = z.object({ userId: z.uuid(), action: z.enum(["report", "preview", "apply"]) });
const bodySchema = z.object({ json: z.string().min(2).max(100_000), confirmation: z.literal("APPLY_COACH_CHANGES").optional() }).strict();
type Context = { params: Promise<{ userId: string; action: string }> };
function failure(error: unknown) {
  const status = error instanceof AuthenticationRequiredError ? 401 : error instanceof AdminRequiredError ? 403 : error instanceof RequestPolicyError ? error.status : error instanceof CoachingTargetError ? 409 : 400;
  return NextResponse.json({ error: error instanceof z.ZodError ? "Invalid coaching request." : error instanceof Error ? error.message : "Coaching request failed." }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireAdminUser();
    const { userId, action } = paramsSchema.parse(await context.params);
    if (action !== "report") return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    const review = await adminCoachReport(getPrisma(), actor, userId, new URL(request.url).searchParams.get("week") ?? undefined);
    return NextResponse.json({ review }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireAdminUser();
    assertSameOriginJson(request);
    const { userId, action } = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());
    if (action === "preview") return NextResponse.json({ preview: await adminCoachPreview(getPrisma(), actor, userId, body.json) }, { headers: { "Cache-Control": "no-store" } });
    if (action !== "apply") return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    if (body.confirmation !== "APPLY_COACH_CHANGES") return NextResponse.json({ error: "Explicit confirmation is required." }, { status: 400 });
    const result = await adminCoachApply(getPrisma(), actor, userId, body.json);
    for (const path of ["/", "/programme", "/workouts", `/admin/users/${userId}`, "/admin/users"]) revalidatePath(path);
    return NextResponse.json({ applied: true, kind: result.kind, program: result.program, versionNumber: result.versionNumber }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
